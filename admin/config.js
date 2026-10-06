/* Ustawienia panelu. Hasło nie jest tu zapisane wprost, tylko jako skrót SHA-256.
   Zmiana hasła: w konsoli przeglądarki wpisz
     crypto.subtle.digest("SHA-256", new TextEncoder().encode("NOWE_HASLO"))
       .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")))
   i wklej wynik poniżej.

   Uwaga: hasło to tylko zamek na drzwiach panelu. Zmiany na stronie da się zrobić
   wyłącznie z kluczem dostępu GitHuba, który jest zapisany tylko na telefonie klientki. */
window.MG_ADMIN = {
  owner: "dominikszewczyk224180",   // konto GitHub z repozytorium strony
  repo: "MebleGrosman",             // nazwa repozytorium
  branch: "main",
  passwordSha256: "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5", // 12345
  maxVideoMB: 50,                   // większe filmy panel odrzuci
  siteLimitMB: 1000                 // GitHub Pages: strona może mieć do ok. 1 GB
};
