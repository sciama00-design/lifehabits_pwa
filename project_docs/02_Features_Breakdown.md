# 02 - Dettaglio Funzionalità e Flussi

## 1. Gestione Libreria Contenuti (Coach)
La "Libreria" è il cuore pulsante dei contenuti. Permette al Coach di creare un repository centrale di attività riutilizzabili.

### Funzionalità:
*   **Creazione:**
    *   **Titolo:** Nome breve e descrittivo.
    *   **Descrizione:** Testo dettagliato (Rich Text) che spiega l'attività.
    *   **Tipo:** "Video", "Abitudine" (Habit), o "PDF/Altro".
    *   **Link:** URL esterno (YouTube, Vimeo, Drive, ecc.).
    *   **Copertina (Thumbnail):** Immagine rappresentativa caricata dallo storage.
*   **Modifica/Eliminazione:** I contenuti possono essere aggiornati o rimossi. La rimozione dalla libreria NON rimuove necessariamente l'assegnazione se già fatta (dipende dall'implementazione specifica, ma solitamente sono entità separate).
*   **Filtri:** Visualizzazione per Tipo (Video, Habit, Tutti) e ricerca testuale.
*   **"I Miei Contenuti":** Filtro rapido per vedere solo i contenuti creati dall'utente corrente (utile se ci sono più coach).

---

## 2. Gestione Clienti e Assegnazioni (Coach)
Il fulcro della personalizzazione avviene nella scheda Cliente.

### Funzionalità Piano (Subscription Plan):
*   Un "Piano" è un contenitore temporale (es. "Fase 1: Massa", "Start 2024").
*   **Creazione:** Nome, Descrizione, Data Inizio, Data Fine (o durata in settimane/mesi).
*   **Stato:** I piani scaduti vengono evidenziati visivamente.
*   **Associazione:** Le abitudini e i video vengono assegnati all'interno di un Piano o come "extra" (senza piano specifico).

### Assegnazione Contenuti (Habits/Videos):
*   **Da Libreria:** Il Coach può selezionare un item dalla Libreria e assegnarlo al cliente.
*   **Creazione Ad-Hoc:** È possibile creare un contenuto "al volo" specifico per quel cliente, senza passare dalla libreria globale.
*   **Check Completamento:** Il cliente può spuntare le abitudini. Il Coach vede lo stato di completamento (monitoraggio).

### Bacheca Personale (Bacheca):
*   Il Coach può pubblicare post specifici visibili SOLO a quel cliente.
*   Utile per comunicazioni 1:1, feedback, o messaggi motivazionali privati.
*   Supporta formattazione ricca e immagini.

---

## 3. Bacheca Globale (Coach -> Tutti)
Serve per comunicazioni "broadcast".

### Funzionalità:
*   **Targeting:** Selezione dei clienti destinatari (Tutti, Selezione Multipla).
*   **Scadenza Post:** I messaggi possono avere una "data di scadenza" (es. 24h, 7gg) dopo la quale non sono più visibili, per mantenere la bacheca pulita.
*   **Pinning/Priorità:** (Opzionale/Visuale) I post recenti appaiono in alto.
*   **Immagini:** Supporto per immagini e allegati visuali.

---

## 4. Dashboard Cliente (Atleta)
L'interfaccia cliente è ottimizzata per l'uso quotidiano (Mobile First).

### Sezioni:
*   **Header:** Saluto personalizzato e data odierna.
*   **Bacheca:** Carousel orizzontale degli ultimi avvisi non letti o importanti.
*   **Prossimamente (Upcoming):** Lista delle prossime 3 attività in scadenza.
*   **Accesso Rapido:** Due grandi card per "Abitudini" e "Video" con contatori (es. "3 da fare").

### Interazione:
*   **Toggle:** Checkbox per segnare le abitudini come fatte.
*   **Player Video:** Modale o pagina dedicata per vedere i video (YouTube/Vimeo integrati).
*   **Visualizzazione Post:** Cliccando su un post della bacheca si apre un dettaglio (modale) con il contenuto completo.
