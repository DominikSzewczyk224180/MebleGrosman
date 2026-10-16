<?php
/* POST: formularz kontaktowy ze strony, wysyła e-mail do firmy. */
declare(strict_types=1);
require __DIR__ . '/lib.php';
cors();
require_method('POST');

$in = json_body();
// pułapka na boty: ukryte pole musi zostać puste, a formularz nie mógł być wysłany w 2 sekundy
if (!empty($in['website'])) json_out(['ok' => true]);
$opened = (int)($in['ts'] ?? 0);
$age = (int)(microtime(true) * 1000) - $opened;
if ($opened <= 0 || $age < 2000 || $age > 86400000) fail('Odśwież stronę i spróbuj ponownie.');
rate_limit('contact', 5, 3600);

$name = clean_text($in['name'] ?? '', 100);
$email = trim((string)($in['email'] ?? ''));
$phone = preg_replace('/[^\d+ ()-]/', '', (string)($in['phone'] ?? '')) ?? '';
$phone = mb_substr(trim($phone), 0, 30);
$topics = ['Kuchnia', 'Szafa lub garderoba', 'Przedpokój', 'Łazienka', 'Salon', 'Inne'];
$topic = in_array($in['topic'] ?? '', $topics, true) ? $in['topic'] : 'Inne';
$message = trim(str_replace("\r", '', strip_tags((string)($in['message'] ?? ''))));
$message = mb_substr($message, 0, 4000);

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Sprawdź adres e-mail.');
if ($email === '' && strlen(preg_replace('/\D/', '', $phone) ?? '') < 9) fail('Podaj e-mail albo numer telefonu, żebyśmy mogli odpowiedzieć.');
if (mb_strlen($message) < 10) fail('Napisz kilka słów o tym, czego potrzebujesz.');

$to = (string)$CONFIG['mail_to'];
$subject = 'Zapytanie ze strony: ' . $topic . ($name !== '' ? ' (' . $name . ')' : '');
$body = "Nowe zapytanie ze strony meblegrosman.pl\n\n"
    . "Czego dotyczy: $topic\n"
    . 'Imię: ' . ($name !== '' ? $name : '-') . "\n"
    . 'E-mail: ' . ($email !== '' ? $email : '-') . "\n"
    . 'Telefon: ' . ($phone !== '' ? $phone : '-') . "\n\n"
    . "Wiadomość:\n$message\n\n"
    . "---\nWysłano " . date('Y-m-d H:i') . ". Odpowiedz na tego maila, żeby napisać do klienta.\n";

$sent = send_mail($to, $subject, $body, $email);
if (!$sent) fail('Nie udało się wysłać wiadomości. Zadzwoń do nas albo napisz na ' . $to . '.', 500);
json_out(['ok' => true]);
