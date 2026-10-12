<?php
/* POST multipart (file, kind=image|video): zapisuje plik w media/RRRR/MM/ i zwraca ścieżkę. */
declare(strict_types=1);
require __DIR__ . '/lib.php';
cors();
require_method('POST');
require_auth();
rate_limit('upload', 400, 3600);

$f = $_FILES['file'] ?? null;
if (!$f || !is_array($f) || is_array($f['error'])) fail('Brak pliku.');
$errors = [
    UPLOAD_ERR_INI_SIZE => 'Plik jest większy niż limit serwera (upload_max_filesize).',
    UPLOAD_ERR_FORM_SIZE => 'Plik jest za duży.',
    UPLOAD_ERR_PARTIAL => 'Plik wysłał się tylko częściowo. Spróbuj jeszcze raz.',
    UPLOAD_ERR_NO_FILE => 'Brak pliku.',
];
if ($f['error'] !== UPLOAD_ERR_OK) fail($errors[$f['error']] ?? 'Błąd wysyłania pliku.', 400);

$kind = ($_POST['kind'] ?? '') === 'video' ? 'video' : 'image';
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
$images = ['image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png'];
$videos = ['video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/webm' => 'webm', 'video/x-m4v' => 'm4v'];
$allowed = $kind === 'video' ? $videos : $images;
if (!isset($allowed[$mime])) fail('Nieobsługiwany format pliku (' . $mime . ').', 415);

$limit = $kind === 'video' ? (int)($CONFIG['max_video_mb'] ?? 50) * 1048576 : 15 * 1048576;
if ($f['size'] > $limit) fail('Plik jest za duży.', 413);
if ($kind === 'image' && @getimagesize($f['tmp_name']) === false) fail('To nie wygląda na zdjęcie.', 415);

$sub = date('Y') . '/' . date('m');
$dir = MEDIA_DIR . '/' . $sub;
if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) fail('Nie można utworzyć folderu na serwerze.', 500);
$name = bin2hex(random_bytes(8)) . '.' . $allowed[$mime];
if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) fail('Nie można zapisać pliku na serwerze.', 500);
@chmod($dir . '/' . $name, 0644);

json_out(['path' => 'media/' . $sub . '/' . $name, 'bytes' => (int)$f['size']]);
