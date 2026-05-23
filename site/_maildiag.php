<?php
// TEMP diagnostic for ITEAA-1781 — finds a From/envelope combo IONOS accepts.
// Guarded by a token; deleted in the same heartbeat. No secrets exposed.
header('Content-Type: application/json');
if (($_GET['t'] ?? '') !== 'iteaa1781diag') { http_response_code(404); exit; }

$to = 'mejora.mi.negocio+autonomia-diag@gmail.com';
$ct = "Content-Type: text/plain; charset=utf-8\r\n";

$cases = [
    'from_noreply_env_hola'   => ["From: AutonomIA <no-reply@itera.es>\r\n".$ct, '-fhola@itera.es'],
    'from_hola_env_hola'      => ["From: AutonomIA <hola@itera.es>\r\n".$ct,     '-fhola@itera.es'],
    'from_hola_no_env'        => ["From: AutonomIA <hola@itera.es>\r\n".$ct,     ''],
    'from_noreply_env_noreply'=> ["From: AutonomIA <no-reply@itera.es>\r\n".$ct, '-fno-reply@itera.es'],
    'no_from_no_env'          => [$ct,                                            ''],
];

$out = [];
foreach ($cases as $k => [$hdr, $env]) {
    $out[$k] = $env === ''
        ? (bool) @mail($to, "diag $k", "body", $hdr)
        : (bool) @mail($to, "diag $k", "body", $hdr, $env);
}

echo json_encode([
    'php_version'   => PHP_VERSION,
    'sendmail_path' => ini_get('sendmail_path'),
    'results'       => $out,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
