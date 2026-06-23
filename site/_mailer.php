<?php
// Dependency-free authenticated SMTP sender for AutonomIA emails.
//
// Purpose (ITEA-2402): allow a branded, SPF/DKIM-aligned `From:` (e.g.
// hola@ia.itera.es) via authenticated IONOS SMTP. IONOS shared-hosting
// sendmail rejects any custom From/-f on mail() (verified ITEAA-1781), so the
// only path to a branded sender is authenticated SMTP.
//
// SAFE FALLBACK: if no _smtp_config.php is present (credentials not provisioned)
// autonomia_smtp_config() returns null and callers transparently keep using
// PHP mail(). Deploying this file therefore changes nothing until the config
// lands — zero behaviour change without credentials.
//
// Config is injected at DEPLOY TIME (deploy.yml writes _smtp_config.php from
// GitHub Actions secrets/vars) so no credential is ever committed to git.

declare(strict_types=1);

// Returns the SMTP config array or null if not provisioned / incomplete.
function autonomia_smtp_config(): ?array {
    static $cfg = false; // sentinel: false = not yet loaded
    if ($cfg !== false) {
        return $cfg;
    }
    $cfg = null;
    $f = __DIR__ . '/_smtp_config.php';
    if (is_file($f)) {
        $c = @include $f;
        if (is_array($c) && !empty($c['host']) && !empty($c['user']) && !empty($c['pass'])) {
            $cfg = [
                'host'   => (string) $c['host'],
                'port'   => (int) ($c['port'] ?? 587),
                'user'   => (string) $c['user'],
                'pass'   => (string) $c['pass'],
                'from'   => (string) (!empty($c['from']) ? $c['from'] : $c['user']),
                'secure' => strtolower((string) ($c['secure'] ?? 'starttls')), // starttls|tls|none
            ];
        }
    }
    return $cfg;
}

// Extract the bare address from a "Name <addr@host>" or "addr@host" string.
function autonomia_addr(string $v): string {
    if (preg_match('/<([^>]+)>/', $v, $m)) {
        return trim($m[1]);
    }
    return trim($v);
}

// RFC 2047 encode a header value if it contains non-ASCII bytes.
function autonomia_enc_header(string $v): string {
    if (preg_match('/[\x80-\xFF]/', $v)) {
        return '=?UTF-8?B?' . base64_encode($v) . '?=';
    }
    return $v;
}

// Read a (possibly multi-line) SMTP reply. Returns [code, fullText].
// Continuation lines look like "250-..."; the final line is "250 ...".
function autonomia_smtp_read($fp): array {
    $text = '';
    $code = 0;
    while (($line = fgets($fp, 8192)) !== false) {
        $text .= $line;
        $code = (int) substr($line, 0, 3);
        // 4th char is '-' for continuation, ' ' (or absent) for the last line.
        if (strlen($line) < 4 || $line[3] !== '-') {
            break;
        }
    }
    return [$code, $text];
}

function autonomia_smtp_cmd($fp, string $cmd, array $okCodes, ?array &$err): bool {
    fwrite($fp, $cmd . "\r\n");
    [$code, $text] = autonomia_smtp_read($fp);
    if (!in_array($code, $okCodes, true)) {
        // Never surface the raw AUTH base64 in the error.
        $safe = (stripos($cmd, 'AUTH') === 0 || preg_match('#^[A-Za-z0-9+/=]{8,}$#', $cmd)) ? '[redacted]' : $cmd;
        $err = ['cmd' => $safe, 'code' => $code, 'reply' => trim($text)];
        return false;
    }
    return true;
}

// Open a socket and complete EHLO/STARTTLS/AUTH LOGIN. Returns an authenticated
// stream resource on success, or null on failure (with $err populated). The
// caller owns the returned socket and must fclose() it.
function autonomia_smtp_open(array $cfg, ?array &$err = null) {
    $err = null;
    $host = $cfg['host'];
    $port = $cfg['port'];
    $secure = $cfg['secure'];

    $transport = ($secure === 'tls') ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
    $ctx = stream_context_create([
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true],
    ]);
    $errno = 0; $errstr = '';
    $fp = @stream_socket_client($transport, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        $err = ['cmd' => 'connect', 'code' => $errno, 'reply' => $errstr];
        return null;
    }
    stream_set_timeout($fp, 20);

    [$code] = autonomia_smtp_read($fp); // greeting
    if ($code !== 220) { $err = ['cmd' => 'greeting', 'code' => $code, 'reply' => '']; @fclose($fp); return null; }

    $ehloHost = autonomia_addr($cfg['from']);
    $ehloDomain = (strpos($ehloHost, '@') !== false) ? substr(strrchr($ehloHost, '@'), 1) : 'localhost';

    if (!autonomia_smtp_cmd($fp, 'EHLO ' . $ehloDomain, [250], $err)) { @fclose($fp); return null; }

    if ($secure === 'starttls') {
        if (!autonomia_smtp_cmd($fp, 'STARTTLS', [220], $err)) { @fclose($fp); return null; }
        $crypto = STREAM_CRYPTO_METHOD_TLS_CLIENT;
        if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
            $crypto = STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
        }
        if (!@stream_socket_enable_crypto($fp, true, $crypto)) {
            $err = ['cmd' => 'starttls-handshake', 'code' => 0, 'reply' => 'tls negotiation failed'];
            @fclose($fp);
            return null;
        }
        if (!autonomia_smtp_cmd($fp, 'EHLO ' . $ehloDomain, [250], $err)) { @fclose($fp); return null; }
    }

    // AUTH LOGIN
    if (!autonomia_smtp_cmd($fp, 'AUTH LOGIN', [334], $err)) { @fclose($fp); return null; }
    if (!autonomia_smtp_cmd($fp, base64_encode($cfg['user']), [334], $err)) { @fclose($fp); return null; }
    if (!autonomia_smtp_cmd($fp, base64_encode($cfg['pass']), [235], $err)) { @fclose($fp); return null; }

    return $fp;
}

// Verify credentials/connectivity without sending a message (connect → EHLO →
// STARTTLS → AUTH LOGIN → QUIT). Returns true if AUTH succeeded.
function autonomia_smtp_verify(array $cfg, ?array &$err = null): bool {
    $fp = autonomia_smtp_open($cfg, $err);
    if ($fp === null) { return false; }
    @fwrite($fp, "QUIT\r\n");
    @fclose($fp);
    return true;
}

// Send one message over authenticated SMTP. Returns true only on a fully
// accepted send (server returned 250 to the final dot). $extraHeaders is an
// assoc array, e.g. ['Reply-To' => 'hola@itera.es']. On failure, $err carries
// a credential-safe diagnostic.
function autonomia_smtp_send(array $cfg, string $to, string $subject, string $body, array $extraHeaders = [], bool $isHtml = true, ?array &$err = null): bool {
    $err = null;
    $fp = autonomia_smtp_open($cfg, $err);
    if ($fp === null) { return false; }

    $ehloHost = autonomia_addr($cfg['from']);
    $ehloDomain = (strpos($ehloHost, '@') !== false) ? substr(strrchr($ehloHost, '@'), 1) : 'localhost';

    try {
        $fromAddr = autonomia_addr($cfg['from']);
        $toAddr = autonomia_addr($to);
        if (!autonomia_smtp_cmd($fp, 'MAIL FROM:<' . $fromAddr . '>', [250], $err)) { return false; }
        if (!autonomia_smtp_cmd($fp, 'RCPT TO:<' . $toAddr . '>', [250, 251], $err)) { return false; }
        if (!autonomia_smtp_cmd($fp, 'DATA', [354], $err)) { return false; }

        // Build headers.
        $headers = [];
        $headers['Date'] = date('r');
        $headers['From'] = $cfg['from'];
        $headers['To'] = $to;
        $headers['Subject'] = autonomia_enc_header($subject);
        $headers['Message-ID'] = '<' . bin2hex(random_bytes(12)) . '@' . $ehloDomain . '>';
        foreach ($extraHeaders as $k => $v) {
            $headers[$k] = $v;
        }
        $headers['MIME-Version'] = '1.0';
        $headers['Content-Type'] = ($isHtml ? 'text/html' : 'text/plain') . '; charset=utf-8';
        $headers['Content-Transfer-Encoding'] = '8bit';

        $msg = '';
        foreach ($headers as $k => $v) {
            $msg .= $k . ': ' . str_replace(["\r", "\n"], '', (string) $v) . "\r\n";
        }
        $msg .= "\r\n";
        // Dot-stuff: lines beginning with '.' must be doubled.
        $normalized = preg_replace('/\r\n|\r|\n/', "\r\n", $body);
        $normalized = preg_replace('/^\./m', '..', $normalized);
        $msg .= $normalized . "\r\n.";

        if (!autonomia_smtp_cmd($fp, $msg, [250], $err)) { return false; }

        @fwrite($fp, "QUIT\r\n");
        return true;
    } finally {
        @fclose($fp);
    }
}
