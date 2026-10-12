<?php
/* Ustawienia backendu Meble Grosman. Ten plik nie jest dostępny z przeglądarki. */
return [
    // Hasło do panelu: ustaw mocne (min. 10 znaków) i przekaż klientce.
    // Można też wkleić skrót z password_hash(), np. '$2y$10$...'.
    'admin_password' => 'ZMIEN-TO-HASLO',

    // Strony, które mogą korzystać z panelu (front na GitHub Pages).
    'allowed_origins' => [
        'https://meblegrosman.pl',
        'https://www.meblegrosman.pl',
        'https://dominikszewczyk224180.github.io',
    ],

    // Formularz kontaktowy
    'mail_to' => 'sklepgrosman@gmail.com',
    'mail_from' => 'formularz@meblegrosman.pl',

    // Maksymalny rozmiar filmu w MB (serwer musi mieć upload_max_filesize i post_max_size większe)
    'max_video_mb' => 50,
];
