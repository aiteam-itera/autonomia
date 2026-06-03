<?php
// First-party, privacy-first analytics collector for AutonomIA (ia.itera.es).
// Zero third-party, zero cookies, no raw IP stored. Appends one TSV line per
// event to a log file kept OUTSIDE the public docroot.
//
// Accepts:
//   - POST  (navigator.sendBeacon JSON: {event, props, url, ts})
//   - GET   ?e=<event>&u=<url>   (pixel / no-sendBeacon fallback)
//
// Privacy model: the only per-visitor identifier is a daily-rotating salted
// hash of IP+UA. The salt is constant but the date component rotates every day,
// so the same visitor is de-dupable WITHIN a day yet cannot be correlated
// ACROSS days. Raw IP and User-Agent are never written to disk.

declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');

// Allowlisted events — anything else is dropped to keep the log clean.
const ALLOWED = [
    'page_view',
    'hero_cta_click',
    'quiz_start',
    'quiz_step_complete',
    'quiz_finish',
    'quiz_email_cta_click',
    'contact_form_submit',
    'calculadora_finish',
    'assessment_start',
    'assessment_complete',
    'assessment_email_submit',
];

// Constant salt — combined with the rotating date so cross-day correlation is
// impossible. Not a secret that grants access; just prevents trivial reversal.
const SALT = 'autonomia-fp-2026';

function client_ip(): string {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $k) {
        if (!empty($_SERVER[$k])) {
            $v = explode(',', (string) $_SERVER[$k])[0];
            return trim($v);
        }
    }
    return '';
}

function is_bot(string $ua): bool {
    if ($ua === '') return false;
    return (bool) preg_match('/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|curl|wget|python-requests|lighthouse/i', $ua);
}

function clean_path(string $url): string {
    if ($url === '') return '/';
    $p = parse_url($url, PHP_URL_PATH);
    if (!is_string($p) || $p === '') $p = '/';
    return substr($p, 0, 128);
}

function utm_source(string $url): string {
    if ($url === '') return '';
    $q = parse_url($url, PHP_URL_QUERY);
    if (!is_string($q) || $q === '') return '';
    parse_str($q, $parts);
    $s = isset($parts['utm_source']) ? (string) $parts['utm_source'] : '';
    if ($s === '') return '';
    $s = preg_replace('/[^a-zA-Z0-9_\-.]/', '', $s);
    return substr((string) $s, 0, 64);
}

function ref_host(): string {
    $r = $_SERVER['HTTP_REFERER'] ?? '';
    if ($r === '') return '';
    $h = parse_url($r, PHP_URL_HOST);
    return is_string($h) ? substr($h, 0, 96) : '';
}

$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

// Read payload (POST JSON preferred, GET fallback).
$event = '';
$url = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input', false, null, 0, 4096) ?: '';
    $data = json_decode($raw, true);
    if (is_array($data)) {
        $event = (string) ($data['event'] ?? '');
        $url = (string) ($data['url'] ?? '');
    }
} else {
    $event = (string) ($_GET['e'] ?? '');
    $url = (string) ($_GET['u'] ?? '');
}

// Always answer fast; never break the page.
http_response_code(204);

if (!in_array($event, ALLOWED, true)) {
    exit;
}
if (is_bot($ua)) {
    exit;
}

$day = gmdate('Y-m-d');
$visitor = substr(hash('sha256', $day . '|' . SALT . '|' . client_ip() . '|' . $ua), 0, 16);

$src_url = $url === '' ? ($_SERVER['HTTP_REFERER'] ?? '') : $url;
$line = implode("\t", [
    gmdate('c'),
    $visitor,
    $event,
    clean_path($src_url),
    ref_host(),
    utm_source($src_url),
]) . "\n";

// Store the log OUTSIDE the docroot (parent of /autonomia/). Fall back to a
// protected dir inside docroot if the parent is not writable.
$dir = __DIR__ . '/../_analytics';
if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
    $dir = __DIR__ . '/_analytics';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    }
}

@file_put_contents($dir . '/a.log', $line, FILE_APPEND | LOCK_EX);
