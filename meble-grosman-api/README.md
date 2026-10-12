# Backend Meble Grosman (serwer SEOHOST)

Front strony jest na GitHub Pages (`meblegrosman.pl`), a ten folder to backend pod adresem
`https://api.meblegrosman.pl/`. Obsługuje:

- `realizacje.php`: lista realizacji dla strony i panelu (publiczna)
- `login.php`, `upload.php`, `zapisz.php`: panel klientki (logowanie, wysyłka zdjęć i filmów, zmiany)
- `kontakt.php`: formularz "Napisz do nas" (wysyła e-mail na `mail_to`)
- `status.php`: szybkie sprawdzenie konfiguracji serwera

Dane: `data/realizacje.json` (lista) i `media/` (pliki z panelu). Bez bazy danych.

## Instalacja
1. W panelu SEOHOST dodaj subdomenę `api.meblegrosman.pl` na swoim serwerze i włącz dla niej SSL (Let's Encrypt).
2. Ustaw PHP 8.0 lub nowsze.
3. Wgraj całą zawartość tego folderu do katalogu subdomeny, razem z ukrytymi plikami `.htaccess` i `.user.ini`.
4. W `config.php` wpisz mocne hasło w `admin_password` i przekaż je klientce. Dopóki zostaje `ZMIEN-TO-HASLO`, panel nie wpuści nikogo.
5. Otwórz `https://api.meblegrosman.pl/status.php`. Wszystko powinno mieć OK, a `upload_max_filesize` i `post_max_size` co najmniej 64M. Jeśli są mniejsze, ustaw je w opcjach PHP w panelu SEOHOST.
6. Jeśli `data/` lub `media/` pokazują BRAK UPRAWNIEŃ, ustaw tym folderom prawa 755 albo 775.

## DNS (strefa domeny meblegrosman.pl w SEOHOST)
| Typ   | Nazwa | Wartość |
|-------|-------|---------|
| A     | @     | 185.199.108.153 |
| A     | @     | 185.199.109.153 |
| A     | @     | 185.199.110.153 |
| A     | @     | 185.199.111.153 |
| CNAME | www   | dominikszewczyk224180.github.io. |
| A     | api   | adres IP Twojego serwera SEOHOST |
| TXT   | @     | v=spf1 a:api.meblegrosman.pl ~all |

Domyślne rekordy A i CNAME dla `@` i `www` (parking SEOHOST) usuń. Rekord TXT pozwala serwerowi
wysyłać maile z formularza w imieniu domeny. Gdyby lądowały w spamie, zapytaj support SEOHOST
o ich wpis SPF do poczty wychodzącej i dopisz go przed `~all`.

## Bezpieczeństwo
- `config.php`, `lib.php` i `data/` nie są dostępne z przeglądarki (`.htaccess`).
- Pliki są sprawdzane po zawartości, nie po nazwie. W `media/` nie da się uruchomić skryptu.
- Logowanie: 8 prób na 15 minut z jednego adresu. Token jest ważny 7 dni.
- Panel przyjmuje zmiany tylko ze stron wpisanych w `allowed_origins`.
- Formularz: ukryte pole na boty, minimalny czas wypełnienia i 5 wiadomości na godzinę z jednego adresu.

## Kopia zapasowa
Zdjęcia i lista realizacji to dane klientki: `data/realizacje.json` i cały folder `media/`.
Warto je co jakiś czas pobrać albo włączyć kopie zapasowe w SEOHOST.
