<?php
/* GET: lista realizacji dla strony i panelu (publiczna). */
declare(strict_types=1);
require __DIR__ . '/lib.php';
cors(true);
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) fail('Niedozwolona metoda.', 405);

$file = data_file();
$mtime = @filemtime($file) ?: 0;
$etag = '"' . md5($mtime . ':' . @filesize($file)) . '"';
header('ETag: ' . $etag);
header('Cache-Control: no-cache');
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
echo json_encode(read_data(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
