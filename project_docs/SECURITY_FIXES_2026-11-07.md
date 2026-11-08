# Correzioni di sicurezza — stato e verifiche

Punto di ripresa della nuova sessione: [HANDOFF_SECURITY.md](HANDOFF_SECURITY.md). I conteggi e gli stati riportati sotto includono verifiche intermedie; non usarli come autorizzazione al deploy.

7 novembre 2026. Seguito di `SECURITY_AUDIT_2026-11-07.md`.

## Stato effettivo

Le correzioni sono presenti **nel workspace**. Non è stato eseguito alcun deploy, aggiornamento del database remoto, invio push reale o cambiamento degli account esistenti. L'utente ha confermato che esiste un solo ambiente e ha richiesto di intervenire soltanto senza interrompere l'operatività. Il progetto Supabase dell'app non è tra quelli accessibili al connettore attuale.

I test locali documentati sotto dimostrano i comportamenti sul codice e sulle fixture. Non dimostrano compatibilità con policy, trigger, credenziali cron e dati attualmente distribuiti. **I problemi in produzione non possono essere considerati chiusi prima dell'applicazione e della verifica delle correzioni.**

Aggiornamento: ricevute cinque esportazioni del progetto reale; analizzate 55 policy e verificata la patch su una ricostruzione locale delle policy con dati sintetici (65 controlli). Vedere [esame del contesto reale](SECURITY_LIVE_CONTEXT_REVIEW_2026-11-07.md). Restano da acquisire struttura completa, corpi delle funzioni e configurazione delle Edge Functions/cron; nessuna modifica è stata applicata alla produzione.

Aggiornamento successivo: ricevuta la sesta esportazione con struttura e funzioni. Superati **82 controlli** sulla ricostruzione delle tabelle pubbliche e delle funzioni esportate; aggiunta protezione candidata dei registri notifiche, che nello snapshot hanno RLS disattivata. Struttura e codice delle sei funzioni sono ora disponibili; restano da verificare servizi reali Auth/Storage, policy non esportate, funzioni Edge distribuite, cron, deploy frontend e dati storici. I precedenti conteggi descrivono le verifiche precedenti.

| Rilievo | Intervento nel workspace | Stato |
| --- | --- | --- |
| F01 — ruolo | Trigger che impedisce promozioni ordinarie; nuovi profili senza ruolo derivato da user metadata; RPC client/coach preservate | SQL candidato, verificato localmente |
| F02 — relazioni | Assegnazioni iniziali riservate a provisioning/admin; coach già autorizzati possono aggiungere/rimuovere colleghi; preflight su relazioni incoerenti | SQL candidato, verificato localmente |
| F03 — HTML | DOMPurify centralizzato in tutti i cinque sink HTML; contenuti esistenti sanitizzati al rendering | Implementato nel frontend, test superati |
| F04 — media | Mutazioni negate ai client, mantenendo cartelle legacy e gestione della libreria condivisa tra coach/admin | Mitigazione SQL candidata; isolamento tra coach e lettura privata non introdotti |
| F05 — push | Identità verificata con Auth; destinatari autorizzati; feedback con testo derivato dal server; broadcast solo admin; cron solo chiave server esatta; URL verificati nei due service worker | Implementato, test locali; funzioni non distribuite |
| F06 — profili | Lettura limitata a sé stessi, relazioni autorizzate, directory colleghi per coach e amministratori | SQL candidato, verificato localmente |
| F07 — assegnazioni | Client limitato al completamento; prescrizioni gestite dai coach; controllo proprietario per daily completions | SQL candidato, verificato localmente |
| F08 — regole | Scrittura limitata a coach autorizzato/destinatario assegnato; ricontrollo delle regole persistite nello scheduler | SQL candidato e backend implementati, test locali |

È stata inclusa anche la riparazione delle policy della bacheca: le policy permissive storiche non devono aggirare il controllo dei destinatari.

## Flussi preservati e controllati

- Creazione cliente da coach e creazione coach da admin attraverso le firme RPC esistenti.
- Modifica del nome, consenso privacy, ricerca coach e gestione dei colleghi di un cliente già assegnato.
- Creazione/rinnovo dei piani, lettura del piano del cliente, completamento giornaliero e modifica del programma da coach.
- Lettura pubblica dei media esistenti e upload/modifica/cancellazione da coach, compresi percorsi legacy.
- Test push su sé stessi, feedback client → coach, annunci del coach ai suoi clienti, broadcast amministrativo e cron con credenziale server.
- Formattazione rich text, liste, link e immagini sicuri. L'editor evita estensioni Link duplicate e callback `onChange` artificiali al caricamento/aggiornamento esterno.

Le azioni di toolbar dell'editor sono controllate anche nel sorgente; l'input e il rendering sono esercitati in React/jsdom. Non è una prova su browser/dispositivo reale o su notifiche iOS.

## Verifiche ripetibili

Eseguite con Node 24:

```sh
npm ci
npm run test:security
npm run build
```

- **Database:** 59 controlli positivi/negativi su PostgreSQL tramite PGlite, con `pgcrypto`, ruoli distinti, RLS, trigger e RPC reali. Verificate doppia applicazione idempotente, interruzione atomica del preflight su relazioni incoerenti e compatibilità con l'assenza di tabelle opzionali. Il test dimostra prima della patch i due bypass principali su fixture e poi ne verifica il blocco.
- **HTML:** test dei payload script/event handler/URL pericolosi, corpus SVG/MathML, rendering del vero componente e input del vero editor; copertura di tutti i sink.
- **Push:** test di autorizzazione e degli handler reali con Auth/DB/trasporto push simulati; chiamanti anonimi respinti e operazioni legittime mantenute. Test dei click notifiche su entrambi i service worker.
- **Build:** TypeScript, bundle e generazione del service worker completati. Restano gli avvisi preesistenti su dimensioni bundle e import statici/dinamici dello storage.
- **Lint globale:** non pulito già prima delle modifiche: 115 errori e 22 warning nella verifica iniziale, 113 errori e 22 warning nella verifica successiva. Non è stato presentato come controllo superato e non sono state riscritte aree estranee all'intervento per azzerarlo.

## Dipendenze

Eseguito `npm audit fix --ignore-scripts` senza `--force`, mantenendo gli intervalli compatibili dichiarati e aggiornando il lockfile. Il controllo npm è passato da **34 avvisi (23 alti)** a **12 avvisi (0 alti, 0 critici; 10 medi e 2 bassi)**. Dopo gli aggiornamenti sono stati verificati build, editor e test di sicurezza.

Gli avvisi residui riguardano le catene `typescript-eslint`/`minimatch` e `vite-plugin-pwa`/`workbox-build`/`glob`/`deepmerge`. Il resolver propone downgrade forzati di pacchetti principali: non sono stati applicati per rispettare il vincolo di compatibilità. Servono aggiornamenti upstream oppure una valutazione dedicata delle sostituzioni. L'assenza di avvisi alti non equivale a una certificazione di assenza di vulnerabilità.

## Gate prima di modificare l'unico ambiente

1. Accedere al progetto corretto e raccogliere lo schema effettivo con le query di sola lettura in `src/database/security/README.md`. Includere policy, grants, trigger sulle tabelle e funzioni RPC: gli script di setup nel repository divergono tra loro.
2. Confrontare le relazioni coach/client e i ruoli con un elenco affidabile. La patch rifiuta relazioni con ruoli incoerenti; non può riconoscere automaticamente una relazione abusiva tra due ruoli formalmente validi. Non modifica né elimina i dati storici.
3. Verificare come il cron attuale chiama scheduler/dispatcher. Il codice proposto richiede la chiave server esatta per i percorsi cron: se il job attuale usa la chiave anonima, distribuire la funzione senza prima correggere il job interromperebbe gli invii. I vecchi script diagnostici sono stati aggiornati a leggere credenziali da variabili d'ambiente e non sono stati eseguiti.
4. Esaminare compatibilità dei flussi esterni al frontend, inclusi provisioning e ripristino backup: non devono assegnare ruoli privilegiati attraverso user metadata. Conservare un backup recuperabile e lo snapshot delle definizioni precedenti prima di una futura migrazione.
5. Dopo la verifica della configurazione reale, generare una migrazione con la CLI Supabase e definire la procedura di ripristino adatta allo schema effettivo. Il candidato è intenzionalmente fuori da `supabase/migrations`, quindi non viene applicato da un normale deploy delle migrazioni.

Il candidato usa una transazione, `lock_timeout = 2s` e `statement_timeout = 30s`. Questo riduce il rischio di attese prolungate, ma non costituisce una garanzia di zero interruzioni; per questo non è stato applicato all'unico ambiente.

## Modifiche deliberatamente non applicate

- **Bucket privato e isolamento per coach:** cambierebbero la disponibilità degli URL già pubblicati e la libreria condivisa. Occorre un inventario verificato dei file e dei proprietari prima di introdurli. Anche quote MIME/dimensione sono rimaste invariate in assenza di un inventario degli upload legittimi.
- **Scadenza abbonamento nel backend:** occorre decidere se i clienti debbano mantenere accesso allo storico; non è stato alterato questo comportamento.
- **Credenziali iniziali condivise:** è emersa durante l'intervento la password iniziale costante in `useClients.ts` e nelle istruzioni della UI. Rimane un rischio, ulteriore rispetto agli otto rilievi iniziali. Non sono state reimpostate password né cambiata la procedura di consegna delle credenziali: occorre introdurre credenziali uniche/inviti con una transizione concordata, preservando l'accesso dei clienti già attivi.
- **Backup e CI:** visibilità/retention degli artifact, autorizzazioni GitHub e fissaggio delle action restano da verificare separatamente; non sono state modificate policy di conservazione o procedure di backup non verificabili dal workspace.

Skill utilizzate: Supabase, Supabase Postgres Best Practices e Ponytail. Le analisi e le implementazioni parallele sono state affidate ai tre sottoagenti Luna già richiesti dall'utente.
