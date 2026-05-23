<?php
// TEMP (ITEAA-1781): isolate exactly which headers IONOS sendmail tolerates.
header('Content-Type: application/json');
if (($_GET['t'] ?? '') !== 'iteaa1781diag') { http_response_code(404); exit; }
$to = 'mejora.mi.negocio+autonomia-diag@gmail.com';

$cases = [
    'plain_only'             => "Content-Type: text/plain; charset=utf-8\r\n",
    'replyto_plain'          => "Reply-To: hola@itera.es\r\nContent-Type: text/plain; charset=utf-8\r\n",
    'mime_html'              => "MIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n",
    'replyto_mime_html'      => "Reply-To: hola@itera.es\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n",
    'replyto_visitor_plain'  => "Reply-To: visitor@gmail.com\r\nContent-Type: text/plain; charset=utf-8\r\n",
];
$out = [];
foreach ($cases as $k => $hdr) { $out[$k] = (bool) @mail($to, "diag3 $k", "body", $hdr); }
echo json_encode($out, JSON_PRETTY_PRINT);
