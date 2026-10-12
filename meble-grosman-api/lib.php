<?php
/* Meble Grosman: wspólne funkcje backendu (PHP 8.0+).
   Dane: data/realizacje.json (lista realizacji), media/ (zdjęcia i filmy z panelu). */
declare(strict_types=1);

$CONFIG = require __DIR__ . '/config.php';

const DATA_DIR = __DIR__ . '/data';
const MEDIA_DIR = __DIR__ . '/media';
const CATS = ['kuchnie', 'szafy', 'lazienki', 'salon', 'inne'];
const TOKEN_TTL = 7 * 86400;   // logowanie w panelu ważne 7 dni

/* ---------- odpowiedzi ---------- */
function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $code = 400): void
{
    json_out(['error' => $message], $code);
}

function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) fail('Niedozwolona metoda.', 405);
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if (strlen($raw) > 2_000_000) fail('Za duże zapytanie.', 413);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/* ---------- CORS: front na GitHub Pages, backend na tym serwerze ---------- */
function cors(bool $public = false): void
{
    global $CONFIG;
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($public) {
        header('Access-Control-Allow-Origin: *');
    } elseif ($origin !== '' && in_array($origin, $CONFIG['allowed_origins'], true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-MG-Token');
    header('Access-Control-Max-Age: 86400');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/* ---------- limity prób (ochrona przed zgadywaniem hasła i spamem) ---------- */
function rate_limit(string $bucket, int $max, int $window): void
{
    $file = DATA_DIR . '/limity.json';
    $fp = fopen($file, 'c+');
    if (!$fp) return;
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $all = $raw ? (json_decode($raw, true) ?: []) : [];
    $now = time();
    foreach ($all as $k => $hits) {
        $all[$k] = array_values(array_filter($hits, fn($t) => $t > $now - 86400));
        if (!$all[$k]) unset($all[$k]);
    }
    $key = $bucket . ':' . hash('sha256', client_ip());
    $recent = array_filter($all[$key] ?? [], fn($t) => $t > $now - $window);
    $blocked = count($recent) >= $max;
    if (!$blocked) $all[$key][] = $now;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($all));
    flock($fp, LOCK_UN);
    fclose($fp);
    if ($blocked) fail('Za dużo prób. Spróbuj ponownie za kilka minut.', 429);
}

/* ---------- logowanie: podpisany token, bez sesji na serwerze ---------- */
function secret(): string
{
    $file = DATA_DIR . '/sekret.key';
    if (!is_file($file)) {
        file_put_contents($file, bin2hex(random_bytes(32)), LOCK_EX);
        @chmod($file, 0600);
    }
    return trim((string)file_get_contents($file));
}

function make_token(): array
{
    $exp = (string)(time() + TOKEN_TTL);
    return ['token' => $exp . '.' . hash_hmac('sha256', $exp, secret()), 'expires' => (int)$exp];
}

function require_auth(): void
{
    $token = $_SERVER['HTTP_X_MG_TOKEN'] ?? '';
    if (!preg_match('/^(\d{10})\.([a-f0-9]{64})$/', $token, $m)) fail('Zaloguj się ponownie.', 401);
    if ((int)$m[1] < time()) fail('Sesja wygasła. Zaloguj się ponownie.', 401);
    if (!hash_equals(hash_hmac('sha256', $m[1], secret()), $m[2])) fail('Zaloguj się ponownie.', 401);
}

function password_ok(string $given): bool
{
    global $CONFIG;
    $stored = (string)($CONFIG['admin_password'] ?? '');
    if ($stored === '' || $stored === 'ZMIEN-TO-HASLO') return false;
    if (str_starts_with($stored, '$2y$') || str_starts_with($stored, '$argon2')) return password_verify($given, $stored);
    return hash_equals($stored, $given);
}

/* ---------- dane realizacji z blokadą pliku (dwa telefony naraz nic nie zepsują) ---------- */
function data_file(): string
{
    return DATA_DIR . '/realizacje.json';
}

function read_data(): array
{
    $raw = @file_get_contents(data_file());
    $data = $raw ? json_decode($raw, true) : null;
    if (!is_array($data)) $data = ['items' => []];
    if (!isset($data['items']) || !is_array($data['items'])) $data['items'] = [];
    return $data;
}

/** Wykonuje zmianę pod blokadą i zapisuje wynik. $fn dostaje dane i zwraca nowe dane. */
function update_data(callable $fn): array
{
    $fp = fopen(data_file(), 'c+');
    if (!$fp) fail('Nie można zapisać danych na serwerze.', 500);
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $data = $raw ? json_decode($raw, true) : null;
    if (!is_array($data)) $data = ['items' => []];
    if (!isset($data['items']) || !is_array($data['items'])) $data['items'] = [];
    $next = $fn($data);
    $json = json_encode($next, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, $json . "\n");
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $next;
}

/* ---------- walidacja wpisów ---------- */
const MEDIA_RE = '#^media/\d{4}/\d{2}/[a-f0-9]{16}\.(webp|jpg|png|mp4|mov|webm|m4v)$#';
const FRONT_RE = '#^img/[\w.-]+\.(webp|jpg|png)$#';   // zdjęcia, które są na stronie od początku

function valid_path($p, bool $allowFront = true): bool
{
    if (!is_string($p)) return false;
    if (preg_match(MEDIA_RE, $p)) return is_file(__DIR__ . '/' . $p);
    return $allowFront && (bool)preg_match(FRONT_RE, $p);
}

function clean_text($s, int $max): string
{
    $s = is_string($s) ? $s : '';
    $s = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', strip_tags($s)) ?? '');
    return mb_substr($s, 0, $max);
}

function clean_item(array $it, bool $isNew): ?array
{
    $type = $it['type'] ?? '';
    if (!in_array($type, ['image', 'video'], true)) return null;
    $cat = in_array($it['cat'] ?? '', CATS, true) ? $it['cat'] : 'inne';
    $id = is_string($it['id'] ?? null) && preg_match('/^[\w-]{3,64}$/', $it['id']) ? $it['id'] : null;
    if (!$id) return null;
    $src = $it['src'] ?? null;
    if (!valid_path($src, !$isNew)) return null;
    $out = [
        'id' => $id, 'type' => $type, 'cat' => $cat,
        'title' => clean_text($it['title'] ?? '', 160),
        'src' => $src,
    ];
    foreach (['thumb', 'poster'] as $k) {
        if (isset($it[$k]) && valid_path($it[$k], !$isNew)) $out[$k] = $it[$k];
    }
    foreach (['w', 'h', 'tw', 'th', 'bytes', 'duration'] as $k) {
        if (isset($it[$k]) && is_numeric($it[$k])) $out[$k] = max(0, (int)$it[$k]);
    }
    if (isset($it['color']) && is_string($it['color']) && preg_match('/^#[0-9a-f]{6}$/i', $it['color'])) $out['color'] = $it['color'];
    $out['featured'] = !empty($it['featured']);
    $out['date'] = is_string($it['date'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $it['date']) ? $it['date'] : date('Y-m-d');
    return $out;
}

/** Zmiany z panelu jako operacje: add, update, delete, move (tak samo jak w admin.js). */
function apply_ops(array $data, array $ops): array
{
    $items = $data['items'];
    foreach ($ops as $op) {
        if (!is_array($op)) continue;
        $kind = $op['op'] ?? '';
        if ($kind === 'add' && is_array($op['items'] ?? null)) {
            $new = [];
            foreach ($op['items'] as $it) {
                $c = is_array($it) ? clean_item($it, true) : null;
                if ($c) $new[] = $c;
            }
            $items = array_merge($new, $items);
        } elseif ($kind === 'update') {
            foreach ($items as &$it) {
                if ($it['id'] !== ($op['id'] ?? null)) continue;
                $f = is_array($op['fields'] ?? null) ? $op['fields'] : [];
                if (array_key_exists('title', $f)) $it['title'] = clean_text($f['title'], 160);
                if (isset($f['cat']) && in_array($f['cat'], CATS, true)) $it['cat'] = $f['cat'];
                if (array_key_exists('featured', $f)) $it['featured'] = (bool)$f['featured'];
            }
            unset($it);
        } elseif ($kind === 'delete') {
            $items = array_values(array_filter($items, fn($it) => $it['id'] !== ($op['id'] ?? null)));
        } elseif ($kind === 'move') {
            $i = array_search($op['id'] ?? null, array_column($items, 'id'), true);
            if ($i === false) continue;
            $moved = array_splice($items, $i, 1)[0];
            $j = false;
            if (!empty($op['beforeId'])) $j = array_search($op['beforeId'], array_column($items, 'id'), true);
            elseif (!empty($op['afterId'])) {
                $j = array_search($op['afterId'], array_column($items, 'id'), true);
                if ($j !== false) $j++;
            }
            array_splice($items, $j === false ? $i : $j, 0, [$moved]);
        }
    }
    $data['items'] = array_values($items);
    $data['updated'] = date('Y-m-d');
    return $data;
}

/** Pliki z media/, których po zmianie nie używa już żadna realizacja. */
function orphaned_files(array $before, array $after): array
{
    $paths = function (array $data): array {
        $out = [];
        foreach ($data['items'] as $it) {
            foreach (['src', 'thumb', 'poster'] as $k) {
                if (isset($it[$k]) && is_string($it[$k]) && preg_match(MEDIA_RE, $it[$k])) $out[$it[$k]] = true;
            }
        }
        return $out;
    };
    return array_keys(array_diff_key($paths($before), $paths($after)));
}
