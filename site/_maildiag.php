<?php
// TEMP diagnostic for ITEAA-1781 — reports why mail() fails on IONOS.
// Guarded by a token; deleted in the same heartbeat. No secrets exposed.
header('Content-Type: application/json');
if (($_GET['t'] ?? '') !== 'iteaa1781diag') { http_response_code(404); exit; }

$res = @mail(
    'mejora.mi.negocio+autonomia-diag@gmail.com',
    'AutonomIA maildiag',
    'diag body',
    "From: AutonomIA <no-reply@itera.es>\r\nContent-Type: text/plain; charset=utf-8\r\n",
    '-fhola@itera.es'
);

echo json_encode([
    'php_version'      => PHP_VERSION,
    'mail_exists'      => function_exists('mail'),
    'disable_functions'=> ini_get('disable_functions'),
    'sendmail_path'    => ini_get('sendmail_path'),
    'SMTP'             => ini_get('SMTP'),
    'smtp_port'        => ini_get('smtp_port'),
    'mail_result'      => $res,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
