# Meble Grosman: strona www

Statyczna strona (HTML, CSS, JS), gotowa pod GitHub Pages.

## Wdrożenie
1. Utwórz repozytorium i wrzuć zawartość tego folderu do katalogu głównego.
2. Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Własna domena: dodaj plik `CNAME` z nazwą domeny i ustaw rekordy DNS.

## Struktura
- `index.html`: cała treść strony
- `css/style.css`: wygląd (kolory i fonty w zmiennych na górze pliku)
- `js/main.js`: hero z lamelami, oferta, filtry galerii, lightbox, Facebook, godziny otwarcia
- `img/`: zdjęcia (webp) i logo

## Podmiana zdjęć
Zdjęcia w `img/` mają 414x414 px. Najlepiej podmienić je na oryginały (min. 1200 px) pod tymi samymi nazwami.
Slajdy w hero ustawia się w `js/main.js` (tablica `slides`).
