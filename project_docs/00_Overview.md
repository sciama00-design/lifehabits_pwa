# 00 - Panoramica del Progetto

## LifeHabits (NT_wll_v2)

### Scopo dell'Applicazione
LifeHabits è una piattaforma di coaching digitale progettata per facilitare la gestione e il monitoraggio del percorso di crescita di atleti e clienti. L'obiettivo principale è fornire un hub centralizzato dove i coach possono assegnare piani, abitudini e contenuti multimediali personalizzati, mentre i clienti possono fruire di questi contenuti e tenere traccia dei propri progressi.

L'applicazione si focalizza sull'engagement a lungo termine attraverso un'interfaccia utente moderna, notifiche visive e un sistema di "Bacheca" per annunci importanti.

### Stack Tecnologico
L'applicazione è costruita con tecnologie moderne per garantire prestazioni e scalabilità:

*   **Frontend Check:** React 19, Vite, TypeScript
*   **Styling:** TailwindCSS 4, Framer Motion (per animazioni fluide)
*   **Backend / Database:** Supabase (PostgreSQL, Auth, Storage)
*   **Routing:** React Router v7
*   **Icons:** Lucide React
*   **Other Libraries:** Recharts (grafici), Date-fns (date), TipTap (Rich Text Editor)

### Attori Principali
Il sistema prevede due ruoli distinti:

1.  **Coach (Amministratore):** Gestisce la piattaforma, crea contenuti, assegna piani e monitora i clienti.
2.  **Cliente (Atleta):** Fruisce dei contenuti assegnati, visualizza la bacheca e interagisce con i piani di allenamento/abitudini.

### Struttura Generale
L'applicazione è divisa in due sezioni principali protette da guardie di autenticazione:
*   `/coach/*`: Area riservata ai Coach.
*   `/`: Area riservata ai Clienti (Home, Habits, Videos).

Inoltre, esistono pagine pubbliche per l'autenticazione (`/login`, `/reset-password`) e per gestire scadenze (`/scaduto`).
