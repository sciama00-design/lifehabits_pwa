# 01 - Attori e Ruoli

## 1. Coach (Amministratore)
Il Coach è l'utente amministratore della piattaforma. Ha il controllo completo sui contenuti e sulla gestione degli utenti.

### Capacità Principali:
*   **Gestione Clienti:**
    *   Visualizzare la lista completa dei clienti attivi e scaduti.
    *   Creare nuovi account cliente (generazione automatica credenziali).
    *   Accedere al dettaglio di ogni singolo cliente.
    *   Eliminare account cliente.
    *   Gestire le date di scadenza abbonamento (rinnovare/bloccare accesso).
*   **Gestione Contenuti (Libreria):**
    *   Creare, modificare ed eliminare Abitudini (Habits).
    *   Creare, modificare ed eliminare Video.
    *   Caricare file PDF.
    *   Organizzare i contenuti in una libreria centrale riutilizzabile.
*   **Assegnazione Piani (Piani di Lavoro):**
    *   Creare "Piani" personalizzati per ogni cliente (es. "Piano Mensile", "Masterclass").
    *   Definire date di inizio e fine per ogni piano.
    *   Associare abitudini e video specifici a un piano.
*   **Comunicazione (Bacheca):**
    *   Pubblicare annunci globali visibili a tutti o a gruppi specifici di clienti.
    *   Caricare immagini di copertina per gli annunci.
    *   Impostare scadenze per la visibilità degli annunci (es. visibile per 7 giorni).
*   **Monitoraggio Sistema:**
    *   Visualizzare statistiche tecniche (spazio database occupato, storage utilizzato).

---

## 2. Cliente (Atleta)
Il Cliente è l'utente finale che utilizza la piattaforma per il proprio percorso di miglioramento.

### Capacità Principali:
*   **Dashboard Personale:**
    *   Visualizzare un saluto personalizzato.
    *   Vedere a colpo d'occhio le attività in scadenza o programmate per oggi.
    *   Leggere gli ultimi annunci dalla Bacheca pubblicati dal Coach.
    *   Accedere rapidamente alle statistiche di Abitudini e Video assegnati.
*   **Gestione Abitudini:**
    *   Visualizzare la lista delle abitudini assegnate dal Coach.
    *   Filtrare le abitudini in base al "Piano" attivo (se presente).
    *   Segnare le abitudini come "Completate" (check-in giornaliero).
*   **Libreria Video:**
    *   Accedere ai contenuti video esclusivi assegnati.
    *   Riprodurre i video direttamente in piattaforma.
*   **Profilo:**
    *   Gestire le impostazioni base (tema scuro/chiaro).
    *   Effettuare il logout.

### Limitazioni:
*   Il Cliente NON può creare contenuti.
*   Il Cliente NON può vedere altri clienti o le loro attività.
*   L'accesso del Cliente è vincolato alla data di scadenza dell'abbonamento (gestita dal Coach). Se scaduto, viene reindirizzato alla pagina `/scaduto`.
