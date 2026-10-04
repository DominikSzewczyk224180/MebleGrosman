# Meble Grosman: strona www

Statyczna strona (HTML, CSS, JS) na GitHub Pages, z automatycznym feedem postów z Facebooka.

## Wdrożenie
1. Wrzuć zawartość tego folderu do katalogu głównego repozytorium (razem z ukrytym folderem `.github`).
2. Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Własna domena: dodaj plik `CNAME` z nazwą domeny i ustaw rekordy DNS.

## Struktura
- `index.html`: treść strony
- `css/style.css`: wygląd (kolory i fonty w zmiennych na górze pliku)
- `js/main.js`: lamele w hero, oferta, galeria z lightboxem, feed z Facebooka, godziny otwarcia
- `img/`: zdjęcia i logo, `img/fb/`: zdjęcia z postów (zapisuje je automat)
- `data/facebook.json`: posty z Facebooka (zapisuje je automat)
- `scripts/fetch_facebook.py` i `.github/workflows/facebook.yml`: automat pobierający posty

## Facebook: jak to działa
Co 4 godziny GitHub Action pyta Graph API o ostatnie posty strony, zmniejsza zdjęcia,
zapisuje je w `img/fb/` i tworzy `data/facebook.json`. Strona czyta ten plik i układa
z niego karty. Token leży w sekretach GitHuba, więc nikt nie wyciągnie go z kodu strony,
a odwiedzający nie ładują skryptów Facebooka.

Dopóki w `data/facebook.json` nie ma postów, sekcja pokazuje okno Facebooka
wczytywane dopiero po kliknięciu (oficjalna wtyczka strony).

## Facebook: jednorazowa konfiguracja (ok. 15 minut)
1. **Dostęp do strony.** Właściciel dodaje Cię na stronie Meble Grosman:
   Ustawienia > Dostęp do strony > Dodaj nową osobę. Wystarczy dostęp częściowy.
2. **Aplikacja Meta.** developers.facebook.com > Moje aplikacje > Utwórz aplikację.
   Wybierz przypadek użycia związany z zarządzaniem stroną (albo "Inne" i typ "Firma").
   Aplikacja może zostać w trybie deweloperskim, przegląd przez Meta nie jest potrzebny.
3. **Token użytkownika.** developers.facebook.com/tools/explorer, wybierz swoją aplikację,
   dodaj uprawnienia `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`,
   kliknij Generate Access Token i zaznacz stronę Meble Grosman.
4. **Token długoterminowy.** Kliknij ikonę "i" przy tokenie > Open in Access Token Tool >
   Extend Access Token. Skopiuj nowy, dłuższy token.
5. **Token strony.** W Graph API Explorer wklej ten token w pole Access Token i wykonaj
   zapytanie `me/accounts?fields=name,access_token`. Skopiuj `access_token` przy Meble Grosman.
   To token strony bez daty wygaśnięcia (w Access Token Debugger zobaczysz "Expires: Never").
6. **Sekret na GitHubie.** Repozytorium > Settings > Secrets and variables > Actions >
   New repository secret. Nazwa `FB_PAGE_TOKEN`, wartość: token strony z kroku 5.
7. **Pierwsze uruchomienie.** Zakładka Actions > "Facebook posty" > Run workflow.
   Po minucie w repo pojawią się posty, a po kolejnej strona je pokaże.

## Facebook: gdy coś nie działa
- **Czerwony przebieg w Actions** (GitHub wyśle maila). Najczęściej token przestał działać,
  np. po zmianie hasła właściciela albo odebraniu dostępu. Wygeneruj nowy (kroki 3 do 6).
  Do tego czasu strona pokazuje ostatnie pobrane posty.
- **Błąd 403 przy `git push`.** Settings > Actions > General > Workflow permissions >
  "Read and write permissions".
- **W aplikacji włączone "Require App Secret".** Dodaj drugi sekret `FB_APP_SECRET`.
- **Wersja Graph API.** Domyślnie v26.0. Zmienisz ją zmienną `FB_GRAPH_VERSION` w workflow.

## Podmiana zdjęć
Zdjęcia w `img/` mają 414x414 px. Najlepiej podmienić je na oryginały (min. 1200 px) pod tymi samymi nazwami.
Slajdy w hero ustawia się w `js/main.js` (tablica `slides`).
