<?php
/* Sprawdzenie konfiguracji serwera po wgraniu plików (nie pokazuje żadnych haseł). */
declare(strict_types=1);
require __DIR__ . '/lib.php';
cors(true);
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');
$mb = fn($v) => (int)$v . (preg_replace('/[\d.]/', '', (string)$v) ?: '');
$checks = [
    'PHP 8.0 lub nowszy' => version_compare(PHP_VERSION, '8.0.0', '>=') ? 'OK (' . PHP_VERSION . ')' : 'ZA STARY (' . PHP_VERSION . ')',
    'Zapis w data/' => is_writable(DATA_DIR) ? 'OK' : 'BRAK UPRAWNIEŃ',
    'Zapis w media/' => is_writable(MEDIA_DIR) ? 'OK' : 'BRAK UPRAWNIEŃ',
    'Hasło panelu ustawione' => ($CONFIG['admin_password'] ?? '') !== 'ZMIEN-TO-HASLO' ? 'OK' : 'NIE (ustaw w config.php)',
    'Rozpoznawanie plików (fileinfo)' => class_exists('finfo') ? 'OK' : 'BRAK',
    'Wysyłka maili' => !empty($CONFIG['smtp']['host']) && !empty($CONFIG['smtp']['pass'])
        ? 'SMTP (' . $CONFIG['smtp']['host'] . ':' . (int)($CONFIG['smtp']['port'] ?? 465) . ')'
        : 'mail() serwera (zalecane SMTP, patrz config.php)',
    'Ostatnia wysyłka' => last_mail_log(),
    'Ochrona data/ (.htaccess)' => is_file(DATA_DIR . '/.htaccess') ? 'OK' : 'BRAK PLIKU data/.htaccess',
    'Ochrona media/ (.htaccess)' => is_file(MEDIA_DIR . '/.htaccess') ? 'OK' : 'BRAK PLIKU media/.htaccess',
    'Główny .htaccess' => is_file(__DIR__ . '/.htaccess') ? 'OK' : 'BRAK PLIKU .htaccess',
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'post_max_size' => ini_get('post_max_size'),
    'Realizacji w danych' => (string)count(read_data()['items']),
];
foreach ($checks as $k => $v) echo $k . str_repeat('.', max(2, 36 - mb_strlen($k))) . ' ' . $v . "\n";
