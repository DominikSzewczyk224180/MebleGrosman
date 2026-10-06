# Meble Grosman: strona www

Statyczna strona (HTML, CSS, JS) na GitHub Pages, z automatycznym feedem postów z Facebooka.

## Wdrożenie
1. Wrzuć zawartość tego folderu do katalogu głównego repozytorium (razem z ukrytym folderem `.github`).
2. Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Własna domena: dodaj plik `CNAME` z nazwą domeny i ustaw rekordy DNS.

## Struktura
- `index.html`, `css/style.css`, `js/main.js`: strona
- `data/realizacje.json`: galeria i zdjęcia w "Co dla Ciebie zrobimy" (edytuje je panel)
- `img/realizacje/`, `video/`: zdjęcia i filmy dodane z panelu
- `admin/`: panel do dodawania realizacji (wejście: link "Panel" na samym dole strony)
- `data/facebook.json`, `img/fb/`, `data/instagram.json`, `img/ig/`: posty pobierane automatem
- `scripts/fetch_facebook.py` i `.github/workflows/facebook.yml`: automat Facebook i Instagram

## Panel: dodawanie realizacji z telefonu
Adres: `/admin/` (link "Panel" w stopce). Hasło: `12345`, zmiana w `admin/config.js`.

Panel zmniejsza zdjęcia na telefonie (1600 px i miniatura 640 px), filmom robi kadr
podglądu i zapisuje wszystko w repozytorium jednym commitem. GitHub Pages publikuje
zmianę po 1-2 minutach. W panelu można też zmienić opis, kategorię, kolejność,
zaznaczyć "Duży kafelek" albo usunąć realizację.

Na stronie galeria wczytuje tylko pierwszą porcję kafelków (małe miniatury),
pełne zdjęcia i filmy pobierają się dopiero po otwarciu.

### Jednorazowo: klucz dostępu dla telefonu klientki
1. GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens >
   Generate new token.
2. Nazwa np. "Panel Meble Grosman", ważność najdłuższa możliwa (zapisz sobie datę odnowienia).
3. Repository access: Only select repositories > `MebleGrosman`.
4. Repository permissions > Contents: **Read and write** (Metadata: Read doda się sam).
5. Generate token i skopiuj klucz.
6. Na telefonie klientki otwórz panel, wpisz hasło i wklej klucz. Można też wysłać link
   `https://dominikszewczyk224180.github.io/MebleGrosman/admin/#klucz=TU_KLUCZ`:
   klucz zapisze się na telefonie i zniknie z adresu. Bezpieczniej zrobić to na miejscu,
   bo link z kluczem zostaje w historii czatu.
7. Zgubiony telefon albo koniec współpracy: usuń token na GitHubie i panel od razu traci dostęp.

### Bezpieczeństwo
Hasło to tylko zamek na drzwiach panelu, bo kod strony może podejrzeć każdy.
Zmiany da się zrobić wyłącznie z kluczem, który jest zapisany tylko na telefonie klientki
i ma dostęp do jednego repozytorium.

### Filmy
- Limit 50 MB na film (`maxVideoMB` w `admin/config.js`). Cała strona na GitHub Pages może
  mieć do ok. 1 GB, panel pokazuje zajęte miejsce.
- iPhone: Ustawienia > Aparat > Formaty > "Najbardziej zgodne". Wtedy filmy odtwarzają się
  też na Androidzie i Windowsie.
- Długie filmy lepiej wrzucać na Facebooka albo YouTube.

## Facebook i Instagram: jak to działa
Sekcja "Nowości prosto z naszego Facebooka" pokazuje profil w telefonie i działa od razu,
bez żadnej konfiguracji: wczytuje oficjalną wtyczkę strony Facebooka (okładka, nazwa, posty).

Opcjonalnie możesz włączyć własny feed przez Graph API. Wtedy co 4 godziny GitHub Action
pobiera ostatnie posty, zmniejsza zdjęcia, zapisuje je w `img/fb/` i tworzy `data/facebook.json`.
Telefon pokazuje wtedy posty w stylu strony, ładuje się szybciej i nie wczytuje skryptów
ani plików cookie Facebooka. Token leży w sekretach GitHuba, nie w kodzie strony.
Strona sama wybiera wersję: są posty w `data/facebook.json`, to własny feed, nie ma, to wtyczka.

Instagram nie ma oficjalnego okna do osadzenia profilu, więc obok Facebooka jest karta z linkiem.
Jeśli konto Instagram jest firmowe i połączone ze stroną na Facebooku, ten sam automat
pobiera też 3 ostatnie posty z Instagrama i pokazuje je jako miniatury pod kartą.

## Facebook: konfiguracja własnego feedu (opcjonalna, ok. 15 minut)
1. **Dostęp do strony.** Właściciel dodaje Cię na stronie Meble Grosman:
   Ustawienia > Dostęp do strony > Dodaj nową osobę. Wystarczy dostęp częściowy.
2. **Aplikacja Meta.** developers.facebook.com > Moje aplikacje > Utwórz aplikację.
   Wybierz przypadek użycia związany z zarządzaniem stroną (albo "Inne" i typ "Firma").
   Aplikacja może zostać w trybie deweloperskim, przegląd przez Meta nie jest potrzebny.
3. **Token użytkownika.** developers.facebook.com/tools/explorer, wybierz swoją aplikację,
   dodaj uprawnienia `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`
   (oraz `instagram_basic`, jeśli konto Instagram jest firmowe i połączone ze stroną na FB),
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
- **W telefonie nic nie widać (wersja z wtyczką).** Część blokerów reklam ukrywa wtyczki
  Facebooka. Na zwykłej przeglądarce posty się pokażą, a własny feed przez API jest na to odporny.
- **Błąd 403 przy `git push`.** Settings > Actions > General > Workflow permissions >
  "Read and write permissions".
- **W aplikacji włączone "Require App Secret".** Dodaj drugi sekret `FB_APP_SECRET`.
- **Wersja Graph API.** Domyślnie v26.0. Zmienisz ją zmienną `FB_GRAPH_VERSION` w workflow.

## Zdjęcia
Najprościej przez panel. Ręcznie: wpisy w `data/realizacje.json` (kolejność w pliku to kolejność
na stronie, `featured: true` daje duży kafelek, `cat`: kuchnie, szafy, lazienki, salon, inne).
Pierwsze zdjęcia mają 414x414 px, bo pochodzą z Facebooka. Oryginały w pełnej rozdzielczości
najlepiej dodać przez panel, a stare wersje usunąć.

## Hero
Animacja w hero to rysunek SVG w `index.html` (projekt kuchni z wymiarami, montaż frontów, LED).
Nie zależy od jakości zdjęć. Kolory frontów do wyboru ustawia się w `js/main.js` (tablica `fronts`).
