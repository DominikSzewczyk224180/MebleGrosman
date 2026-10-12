<?php
/* POST {password}: logowanie do panelu, zwraca token ważny 7 dni. */
declare(strict_types=1);
require __DIR__ . '/lib.php';
cors();
require_method('POST');
rate_limit('login', 8, 900);   // 8 prób na 15 minut z jednego adresu

if (($CONFIG['admin_password'] ?? '') === 'ZMIEN-TO-HASLO') {
    fail('Panel nie ma jeszcze ustawionego hasła (config.php na serwerze).', 503);
}
$in = json_body();
if (!password_ok((string)($in['password'] ?? ''))) {
    usleep(400000);
    fail('Nieprawidłowe hasło.', 401);
}
json_out(make_token() + ['maxVideoMB' => (int)($CONFIG['max_video_mb'] ?? 50)]);
