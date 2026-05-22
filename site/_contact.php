<?php
// First-party, privacy-minimal CONTACT/LEAD collector for AutonomIA
// (home #contacto form + herramienta/madurez.html email gate). Zero
// third-party, no Cloudflare Worker.
//
// Mirrors `_a.php` / `_submit.php`: same-origin POST, append one JSON line per
// lead to a store OUTSIDE the public docroot so it is never web-readable.
//
// Accepts POST JSON: { name, email, sector, message, source, paquete,
//                      score?, level?, website(honeypot) }
// Persists:          { ts, kind:"contact", ...sanitised fields... }
// Returns JSON:      { ok:true, mailed:bool } | { ok:false, error:"..." }

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

$raw  = file_get_contents('php://input', false, null, 0, 16384) ?: '';
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_json']);
    exit;
}

// Honeypot: bots fill the hidden `website` field — drop silently.
if (!empty($data['website'])) {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

$email = trim((string) ($data['email'] ?? ''));
if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'email']);
    exit;
}

$s = static function ($v, int $max): string {
    return substr(trim((string) $v), 0, $max);
};

$record = [
    'ts'      => gmdate('c'),
    'kind'    => 'contact',
    'name'    => $s($data['name'] ?? '', 120),
    'email'   => $email,
    'sector'  => $s($data['sector'] ?? '', 64),
    'message' => $s($data['message'] ?? '', 4000),
    'paquete' => $s($data['paquete'] ?? '', 64),
    'level'   => isset($data['level']) ? $s($data['level'], 64) : null,
    'score'   => isset($data['score']) ? $s($data['score'], 16) : null,
    'source'  => $s($data['source'] ?? 'home', 64),
];

$dir = __DIR__ . '/../_leads';
if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
    $dir = __DIR__ . '/_leads';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    }
}

$line    = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
$written = @file_put_contents($dir . '/leads.jsonl', $line, FILE_APPEND | LOCK_EX);

if ($written === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'store']);
    exit;
}

$mailed = false;
$to      = 'hola@itera.es';
$subject = '[AutonomIA] Nuevo contacto: ' . ($record['name'] !== '' ? $record['name'] : $email);
$body =
    "Nuevo lead del formulario de contacto.\n\n" .
    "Nombre:  {$record['name']}\n" .
    "Email:   {$email}\n" .
    "Sector:  {$record['sector']}\n" .
    "Paquete: {$record['paquete']}\n" .
    "Fuente:  {$record['source']}\n" .
    ($record['level'] ? "Nivel:   {$record['level']} ({$record['score']})\n" : '') .
    "\nMensaje:\n{$record['message']}\n";
$headers = "From: AutonomIA <no-reply@itera.es>\r\nReply-To: {$email}\r\nContent-Type: text/plain; charset=utf-8\r\n";
if (function_exists('mail')) {
    $mailed = (bool) @mail($to, $subject, $body, $headers, '-fhola@itera.es');
}

http_response_code(200);
echo json_encode(['ok' => true, 'mailed' => $mailed]);
