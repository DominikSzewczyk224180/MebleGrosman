<?php
/* POST {ops:[...]}: zmiany z panelu (dodanie, edycja, kolejność, usunięcie). Zwraca aktualną listę. */
declare(strict_types=1);
require __DIR__ . '/lib.php';
cors();
require_method('POST');
require_auth();
rate_limit('save', 600, 3600);

$in = json_body();
$ops = $in['ops'] ?? null;
if (!is_array($ops) || count($ops) > 200) fail('Nieprawidłowe zmiany.');

$removed = [];
$data = update_data(function (array $data) use ($ops, &$removed) {
    $next = apply_ops($data, $ops);
    $removed = orphaned_files($data, $next);
    return $next;
});
// pliki usuniętych realizacji znikają z serwera
foreach ($removed as $p) {
    $full = __DIR__ . '/' . $p;
    if (preg_match(MEDIA_RE, $p) && is_file($full)) @unlink($full);
}
json_out($data);
