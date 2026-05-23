<?php
// TEMP (ITEAA-1781): reset OPcache so updated _submit.php/_contact.php bytecode
// is picked up on IONOS (validate_timestamps appears off). Token-guarded; deleted same heartbeat.
header('Content-Type: application/json');
if (($_GET['t'] ?? '') !== 'iteaa1781reset') { http_response_code(404); exit; }
$enabled = function_exists('opcache_get_status');
$reset   = $enabled && function_exists('opcache_reset') ? opcache_reset() : null;
echo json_encode([
    'opcache_funcs'         => $enabled,
    'reset'                 => $reset,
    'validate_timestamps'   => ini_get('opcache.validate_timestamps'),
    'revalidate_freq'       => ini_get('opcache.revalidate_freq'),
], JSON_PRETTY_PRINT);
