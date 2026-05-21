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

// --- method gate -----------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

// --- read + parse body (cap size to avoid abuse) ---------------------------
$raw  = file_get_contents('php://input', false, null, 0, 16384) ?: '';
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
    $mailed = (bool) @mail($to, $subject, $body, $headers);
}

http_response_code(200);
echo json_encode(['ok' => true, 'mailed' => $mailed]);
