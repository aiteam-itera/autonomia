<?php
// CI self-test for the branded IONOS SMTP sender (ITEA-2402).
//
// Run AFTER deploy.yml has written site/_smtp_config.php from Actions
// secrets/vars. Reuses the exact config + handshake the live site uses:
// connect → EHLO → STARTTLS → AUTH LOGIN. Proves the credentials actually
// authenticate, giving "does it work?" a definitive answer in the CI log
// WITHOUT sending a message and WITHOUT ever printing the password.
//
// Exit codes: 0 = PASS or SKIP (not provisioned); 1 = FAIL (auth/connect error).

declare(strict_types=1);

require __DIR__ . '/../site/_mailer.php';

$cfg = autonomia_smtp_config();
if ($cfg === null) {
    fwrite(STDOUT, "SMTP-SELFTEST: SKIP — no _smtp_config.php (credentials not provisioned); site uses mail() fallback.\n");
    exit(0);
}

$err = null;
$ok = autonomia_smtp_verify($cfg, $err);
if ($ok) {
    fwrite(STDOUT, sprintf(
        "SMTP-SELFTEST: PASS — authenticated to %s:%d as %s (From: %s, secure: %s).\n",
        $cfg['host'], $cfg['port'], $cfg['user'], $cfg['from'], $cfg['secure']
    ));
    exit(0);
}

fwrite(STDOUT, "SMTP-SELFTEST: FAIL — " . json_encode($err, JSON_UNESCAPED_SLASHES) . "\n");
exit(1);
