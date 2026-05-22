<?php
// First-party, privacy-minimal LEAD collector for the AutonomIA questionnaire
// (ia.itera.es/cuestionario.html). Zero third-party, no Cloudflare Worker.
//
// Mirrors the pattern of `_a.php`: same-origin POST, append one JSON line per
// lead to a store kept OUTSIDE the public docroot so it is never web-readable.
//
// Accepts POST JSON: { email, answers, score:{overall,dims}, level, source }
// Persists:          { ts, kind:"quiz", email, answers, score, level, source }
// Returns JSON:      { ok:true, mailed:bool } | { ok:false, error:"..." }
//
// GDPR-minimal: we store only what the visitor submitted. No raw IP, no UA.

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

// --- markdown-lite → safe HTML (escape first, then **bold** + [text](url)) --
// The plan strings embed visitor open-text, so we MUST escape before adding
// any markup, exactly mirroring the front-end's safe-by-construction renderer.
function md_lite(string $text): string {
    $esc = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    // [text](http(s)://… | /… ) — reject any other scheme.
    $esc = preg_replace_callback(
        '/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/',
        static fn($m) => '<a href="' . $m[2] . '">' . $m[1] . '</a>',
        $esc
    );
    // **bold**
    $esc = preg_replace('/\*\*([^*]+)\*\*/', '<strong>$1</strong>', $esc);
    return $esc;
}

// --- method gate -----------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

// --- read + parse body (cap size to avoid abuse) ---------------------------
$raw  = file_get_contents('php://input', false, null, 0, 65536) ?: '';
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_json']);
    exit;
}

// --- honeypot (drop silently if a bot filled it) ---------------------------
if (!empty($data['website'])) {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

// --- validate email --------------------------------------------------------
$email = trim((string) ($data['email'] ?? ''));
if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'email']);
    exit;
}

// --- build the lead record (only fields the user produced) -----------------
$record = [
    'ts'      => gmdate('c'),
    'kind'    => 'quiz',
    'email'   => $email,
    'answers' => is_array($data['answers'] ?? null) ? $data['answers'] : null,
    'score'   => is_array($data['score'] ?? null) ? $data['score'] : null,
    'level'   => isset($data['level']) ? substr((string) $data['level'], 0, 64) : null,
    'source'  => isset($data['source']) ? substr((string) $data['source'], 0, 64) : 'cuestionario',
];

// --- persist OUTSIDE docroot (parent of /autonomia/), like _a.php ----------
$dir = __DIR__ . '/../_leads';
if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
    // Fallback: a denied dir inside docroot if the parent is not writable.
    $dir = __DIR__ . '/_leads';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    }
}

$line    = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
$written = @file_put_contents($dir . '/leads.jsonl', $line, FILE_APPEND | LOCK_EX);

if ($written === false) {
    // Never silently lose a lead: report the failure so the front-end can
    // offer the mailto fallback.
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'store']);
    exit;
}

// --- send the visitor their personalized plan (ITEAA-1537) -----------------
// Single-opt-in transactional email: the visitor explicitly submitted their
// address to receive the recommendation they just saw on screen. We reuse the
// deterministic plan computed client-side (no LLM, no content drift) and the
// host's mail() — no Resend/SES/Cloudflare, no new secrets. Best-effort: a
// mail failure never loses the lead (already persisted above).
$recommended = false;
$rec = is_array($data['recommendation'] ?? null) ? $data['recommendation'] : null;
if ($rec !== null) {
    $secsHtml = '';
    $sections = [
        'En 30 días — primer quick win' => (string) ($rec['plan30'] ?? ''),
        'En 60 días — automatización guiada' => (string) ($rec['plan60'] ?? ''),
        'En 90 días — gobernanza y medida' => (string) ($rec['plan90'] ?? ''),
    ];
    foreach ($sections as $h => $txt) {
        if ($txt === '') { continue; }
        $secsHtml .= '<h3 style="margin:18px 0 4px;font-size:16px;color:#0b1f3a;">'
            . htmlspecialchars($h, ENT_QUOTES, 'UTF-8') . '</h3>'
            . '<p style="margin:0;line-height:1.5;color:#1c2b3a;">' . md_lite($txt) . '</p>';
    }

    $prodHtml = '';
    if (is_array($rec['products'] ?? null)) {
        foreach ($rec['products'] as $p) {
            if (!is_array($p)) { continue; }
            $name = htmlspecialchars((string) ($p['name'] ?? ''), ENT_QUOTES, 'UTF-8');
            $why  = htmlspecialchars((string) ($p['why'] ?? ''), ENT_QUOTES, 'UTF-8');
            $url  = (string) ($p['url'] ?? '');
            $url  = preg_match('#^(https?://|/)#', $url) ? $url : '#';
            if ($name === '') { continue; }
            $prodHtml .= '<li style="margin:4px 0;"><a href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8')
                . '" style="color:#1565c0;">' . $name . '</a> — ' . $why . '</li>';
        }
    }

    $pkg = is_array($rec['package'] ?? null) ? $rec['package'] : [];
    $pkgHtml = '';
    if (!empty($pkg['title'])) {
        $pTitle = htmlspecialchars((string) $pkg['title'], ENT_QUOTES, 'UTF-8');
        $pPitch = htmlspecialchars((string) ($pkg['pitch'] ?? ''), ENT_QUOTES, 'UTF-8');
        $pHref  = (string) ($pkg['ctaHref'] ?? '');
        $pHref  = preg_match('#^(https?://|/)#', $pHref) ? $pHref : 'https://ia.itera.es/';
        if (strpos($pHref, '/') === 0) { $pHref = 'https://ia.itera.es' . $pHref; }
        $pLabel = htmlspecialchars((string) ($pkg['ctaLabel'] ?? 'Ver más'), ENT_QUOTES, 'UTF-8');
        $pkgHtml = '<div style="margin:22px 0;padding:16px;background:#f3f7fc;border-radius:8px;">'
            . '<p style="margin:0 0 6px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#5a6b7b;">Paquete recomendado</p>'
            . '<p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#0b1f3a;">' . $pTitle . '</p>'
            . '<p style="margin:0 0 12px;line-height:1.5;color:#1c2b3a;">' . $pPitch . '</p>'
            . '<a href="' . htmlspecialchars($pHref, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;padding:10px 18px;background:#1565c0;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">' . $pLabel . '</a></div>';
    }

    $intro   = (string) ($rec['intro'] ?? '');
    $lvl     = htmlspecialchars((string) ($record['level'] ?? ''), ENT_QUOTES, 'UTF-8');
    $scoreN  = is_array($record['score']) ? (string) ($record['score']['overall'] ?? '?') : '?';
    $htmlMail =
        '<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1c2b3a;">'
        . '<p style="font-size:13px;color:#5a6b7b;margin:0 0 4px;">AutonomIA · Diagnóstico de madurez en IA</p>'
        . '<h1 style="font-size:22px;color:#0b1f3a;margin:0 0 6px;">Tu plan personalizado 30 / 60 / 90 días</h1>'
        . '<p style="margin:0 0 16px;color:#5a6b7b;">Madurez global: <strong>' . htmlspecialchars($scoreN, ENT_QUOTES, 'UTF-8') . '/100</strong>'
        . ($lvl !== '' ? ' · Nivel: <strong>' . $lvl . '</strong>' : '') . '</p>'
        . ($intro !== '' ? '<p style="margin:0 0 8px;line-height:1.55;">' . md_lite($intro) . '</p>' : '')
        . $secsHtml
        . ($prodHtml !== '' ? '<h3 style="margin:18px 0 4px;font-size:16px;color:#0b1f3a;">Productos que encajan</h3><ul style="margin:0;padding-left:18px;line-height:1.5;">' . $prodHtml . '</ul>' : '')
        . $pkgHtml
        . '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px;">'
        . '<p style="font-size:12px;color:#8595a5;line-height:1.5;margin:0;">Recibes este correo porque solicitaste tu diagnóstico en ia.itera.es. '
        . 'Conservamos tus respuestas un máximo de 90 días; escribe a <a href="mailto:hola@itera.es" style="color:#1565c0;">hola@itera.es</a> para pedir su borrado. '
        . '¿Hablamos? Responde a este email y te ayudamos a dar el primer paso.</p></div>';

    $vHeaders = "From: AutonomIA <no-reply@itera.es>\r\n"
        . "Reply-To: hola@itera.es\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/html; charset=utf-8\r\n";
    if (function_exists('mail')) {
        $recommended = (bool) @mail($email, 'Tu plan personalizado AutonomIA · 30/60/90 días', $htmlMail, $vHeaders, '-fhola@itera.es');
    }
}

// --- best-effort internal notification (never blocks capture) --------------
$mailed = false;
$to     = 'hola@itera.es';
$subject = '[AutonomIA] Nuevo diagnóstico: ' . $email;
$overall = is_array($record['score']) ? ($record['score']['overall'] ?? '?') : '?';
$body =
    "Nuevo lead del cuestionario de madurez.\n\n" .
    "Email:  {$email}\n" .
    "Nivel:  {$record['level']}\n" .
    "Score:  {$overall}/100\n" .
    "Fuente: {$record['source']}\n\n" .
    "Respuestas (JSON):\n" . json_encode($record['answers'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
$headers = "From: AutonomIA <no-reply@itera.es>\r\nReply-To: {$email}\r\nContent-Type: text/plain; charset=utf-8\r\n";
if (function_exists('mail')) {
    $mailed = (bool) @mail($to, $subject, $body, $headers, '-fhola@itera.es');
}

http_response_code(200);
echo json_encode(['ok' => true, 'mailed' => $mailed, 'recommended' => $recommended]);
