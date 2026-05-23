<?php
// TEMP (ITEAA-1781): is the fix deployed, and which exact mail() call fails?
header('Content-Type: application/json');
if (($_GET['t'] ?? '') !== 'iteaa1781diag') { http_response_code(404); exit; }

$src = @file_get_contents(__DIR__ . '/_submit.php') ?: '';

// Replay the two production mail() calls in isolation.
$visitor = 'mejora.mi.negocio+autonomia-diag@gmail.com';
$recHdr  = "Reply-To: hola@itera.es\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n";
$rec     = (bool) @mail($visitor, 'Tu plan personalizado AutonomIA · 30/60/90 días', '<p>hola</p>', $recHdr);

$intHdr_local  = "Reply-To: x@gmail.com\r\nContent-Type: text/plain; charset=utf-8\r\n";
$int_to_local  = (bool) @mail('hola@itera.es', '[AutonomIA] test', 'body', $intHdr_local);   // local mailbox
$int_to_gmail  = (bool) @mail($visitor,        '[AutonomIA] test', 'body', $intHdr_local);   // external

echo json_encode([
    'fix_deployed_no_dash_f'   => (strpos($src, '-fhola@itera.es') === false),
    'fix_deployed_no_from_hdr' => (strpos($src, 'From: AutonomIA') === false),
    'recommendation_mail'      => $rec,
    'internal_to_hola_local'   => $int_to_local,
    'internal_to_gmail'        => $int_to_gmail,
], JSON_PRETTY_PRINT);
