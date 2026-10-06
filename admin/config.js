/* Ustawienia panelu (wersja pokazowa: zmiany zapisują się tylko na urządzeniu).
   Hasło nie jest tu zapisane wprost, tylko jako skrót SHA-256.
   Zmiana hasła: w konsoli przeglądarki wpisz
     crypto.subtle.digest("SHA-256", new TextEncoder().encode("NOWE_HASLO"))
       .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")))
   i wklej wynik poniżej. */
window.MG_ADMIN = {
  passwordSha256: "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5", // 12345
  maxVideoMB: 50
};
