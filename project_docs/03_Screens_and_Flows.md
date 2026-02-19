# 03 - Schermate e Flussi

## Mappa del Sito (Sitemap)

### Area Pubblica
1.  **Login (`/login`)**:
    *   Form email/password.
    *   Pulsante "Recupera Password".
2.  **Reset Password (`/reset-password`)**:
    *   Input nuova password.
    *   Conferma.
3.  **Abbonamento Scaduto (`/scaduto`)**:
    *   Pagina di blocco per utenti con data `subscription_end` passata.
    *   Invito a contattare il coach.

### Area Cliente (`/`) - *Richiede Auth & Abbonamento Attivo*
1.  **Dashboard (`/`)**:
    *   Home page.
    *   Widget Bacheca.
    *   Widget Prossime Scadenze.
    *   Link rapidi a Habits/Videos.
2.  **Abitudini (`/habits`)**:
    *   Lista completa abitudini.
    *   Filtro per Piano (Dropdown se presenti più piani).
    *   Stato completamento (Check).
3.  **Video (`/videos`)**:
    *   Griglia video assegnati.
    *   Player video (apertura modale o pagina dettaglio).
4.  **Impostazioni Profilo (`/profile`)**:
    *   Gestione tema.
    *   Logout.

### Area Coach (`/coach`) - *Richiede Auth & Ruolo Coach*
1.  **Dashboard (`/coach/dashboard`)**:
    *   KPI: Clienti Attivi, In Scadenza.
    *   Link a Bacheca.
2.  **Lista Clienti (`/coach/clients`)**:
    *   Tabella/Griglia clienti.
    *   Ricerca per nome/email.
    *   Pulsante "Nuovo Cliente" (Modale creazione rapida).
3.  **Dettaglio Cliente (`/coach/clients/:id`)**:
    *   *Sottosezioni (Tab):*
        *   **Anagrafica:** Dati, Piani, Delete.
        *   **Bacheca:** Post privati.
        *   **Abitudini:** Lista, Assegna Nuova, Modifica esistente.
        *   **Video:** Lista, Assegna Nuovo, Modifica esistente.
4.  **Libreria (`/coach/library`)**:
    *   Griglia tutti i contenuti.
    *   Filtri (Tipo, Autore).
    *   Modale Creazione/Modifica Contenuto.
5.  **Bacheca Globale (`/coach/board`)**:
    *   Lista tutti i post inviati.
    *   Form creazione nuovo post (con upload immagine).
6.  **System Monitor (`/coach/system`)**:
    *   Grafici spazio disco e DB.
7.  **Settings (`/coach/settings`)**:
    *   Logout.
    *   Opzioni app.

## Flussi Critici

### 1. Onboarding Nuovo Cliente
1.  Coach va su `/coach/clients`.
2.  Clicca "+".
3.  Inserisce Nome, Email.
4.  Sistema crea utente su Supabase Auth (pwd default: `lifehabits2026`).
5.  Sistema crea record su tabella `profiles`.
6.  Coach viene reindirizzato al dettaglio cliente per assegnare un piano.

### 2. Assegnazione Abitudine
1.  Coach va su Dettaglio Cliente -> Tab Abitudini.
2.  Clicca "+".
3.  Sceglie "Da Libreria" o "Crea Nuovo".
4.  Seleziona l'item.
5.  Conferma assegnazione (Linkando opzionalmente a un Piano ID).
6.  Cliente vede l'abitudine nella sua Dashboard/Habits page.

### 3. Pubblicazione Annuncio
1.  Coach va su `/coach/board`.
2.  Scrive Titolo, Testo.
3.  Carica Immagine (Opzionale).
4.  Seleziona Destinatari (Tutti o selezione manuale).
5.  Imposta Scadenza (es. 7 giorni).
6.  Pubblica.
7.  I Clienti vedono il post nella loro Home fino alla scadenza.
