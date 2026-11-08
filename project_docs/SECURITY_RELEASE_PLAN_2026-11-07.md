# Percorso di rilascio delle correzioni

> **Stato attuale: Supabase rilasciato e verificato.** Migrazioni ricevute e RLS applicate, scheduler v18 e dispatcher v11 attivi, cron HTTP 200. [Dettagli del rilascio](SECURITY_DEPLOYMENT_2026-11-08.md). Frontend pronto; push GitHub impedito dall'autenticazione assente. L'utente ha già autorizzato la pubblicazione e accettato di separare il problema del PC.

> **Ultima verifica dell'8 novembre:** [pacchetto di backup e prove di rollback](SECURITY_BACKUP_RESTORE_2026-11-08.md) completato per il perimetro documentato, inclusa continuità Auth HTTP e conservazione delle nuove attività. Nessuna pubblicazione. Prima del rilascio rimangono la prova della credenziale cron candidata, i dispositivi dedicati e l'identificazione del deployment Cloudflare recuperabile.

> **Aggiornamento successivo dell'8 novembre:** accesso Life Habits ripristinato; letture live di schema/policy/grants, sorgenti Edge e risposte cron completate. Fixture delle 70 policy attuali: 104 controlli superati. Nessun rilascio; restano i prerequisiti di backup/ripristino, credenziale cron esatta e verifica dei flussi/dispositivi. Vedi lo stato esterno aggiornato nel [rapporto](SECURITY_VERIFICATION_2026-11-08.md).

> Stato aggiornato all'8 novembre: [revisione di continuità](SECURITY_VERIFICATION_2026-11-08.md). Correzioni e verifiche locali completate; nessun rilascio. Accesso Supabase al progetto corretto ancora negato anche dopo il nuovo collegamento. La preparazione additiva delle ricevute deve precedere le nuove Edge Functions; backup/ripristino e cron live restano da verificare. Le sezioni successive conservano la cronologia precedente.

Per riprendere in una nuova sessione, leggere prima [HANDOFF_SECURITY.md](HANDOFF_SECURITY.md): contiene lo stato finale verificato, il vincolo di continuità operativa e i punti da riesaminare criticamente. Questo documento conserva anche passaggi intermedi della sessione.

## Situazione confermata

- Hosting: Cloudflare Pages.
- Branch di produzione: `main`.
- Push su `main`: pubblicazione automatica del sito, secondo quanto confermato dall'utente.
- Creato localmente il branch `security/app-hardening-preview` e il commit frontend **`e549877`**, con 14 file. Nessun push o deploy effettuato; main resta su `b976ea7`. Le modifiche Supabase e il contesto esportato restano fuori dal commit. È stata usata un'identità locale Codex per il solo comando di commit, senza modificare la configurazione Git dell'utente.
- Il comando `npm run build` nel repository esegue solo TypeScript e Vite. I workflow presenti sono backup schedulati/manuali: non è stato trovato un workflow di deploy Supabase al push.
- L'utente ha confermato anche il comando effettivo `npm run build` e l'output `dist` configurati su Cloudflare: questi corrispondono alla build statica del repository.

## Primo rilascio: frontend, dopo una preview

Le modifiche frontend non richiedono nuove RPC o nuove colonne: mantengono le chiamate Supabase attuali. Comprendono sanitizzazione dei contenuti, protezione degli URL delle notifiche, correzione dell'editor e aggiornamenti compatibili del lockfile. È stata verificata e preservata anche l'apertura dei link in nuova scheda, aggiungendo noopener/noreferrer ai link con target blank.

1. Build settings acquisiti: `npm run build`, output `dist`. Quel comando non modifica il database e non distribuisce funzioni Supabase.
2. Commit frontend preparato: `e549877`. I CSV, gli archivi e le modifiche backend non sono inclusi. I manifest del commit contengono solo i test frontend e le loro dipendenze; nel working tree restano separatamente le aggiunte per i test database/backend. Non creare commit o push su main durante questa fase.
3. Pubblicare il branch dedicato come preview Cloudflare, verificando che le preview siano abilitate e che il branch di produzione resti main. La preview è un sito separato dalla pubblicazione principale; non crea un database Supabase separato.
4. Controllare sulla preview login ordinario, navigazione, liste, contenuti, formattazione e link, media e visualizzazione dei calendari con account autorizzati. Se la preview usa Supabase di produzione, le operazioni di scrittura agiscono sul database reale: niente broadcast, reset password, modifiche a clienti o invii di prova a terzi. Per provare scritture complete serve un ambiente isolato o una procedura su dati di prova concordata.
5. Solo dopo la verifica della preview, decidere il merge su main. Prima del rilascio va identificato il precedente deployment Cloudflare recuperabile. Un rollback del sito non ripristina automaticamente database o funzioni Supabase.

Questa fase protegge il frontend, ma **non chiude le vulnerabilità del database o del backend**. Nessun file SQL candidato viene eseguito da `npm run build`; nessuna Edge Function viene distribuita da quel comando.

## Secondo rilascio: Supabase separato

La patch SQL candidata e le nuove Edge Functions restano da applicare con una procedura distinta, dopo verifica dei dati storici, backup e ripristino adatti allo schema reale, compatibilità del cron e controlli HTTP effettivi. Il solo ruolo service_role decodificato dal cron non dimostra la corrispondenza esatta alla chiave server configurata.

Il dispatcher proposto mantiene il gateway JWT disattivo, come attualmente, verificando e autorizzando il chiamante nel codice. Lo scheduler mantiene il gateway JWT attivo e restringe le invocazioni alla chiave server. Non va pubblicata una modifica di questi controlli senza la verifica del job reale.

## Evidenza disponibile

- `npm run test:security`: superato, inclusi 80 controlli SQL sulla fixture standard, test di rendering/input rich text, tre test del sanitizer e otto test di policy/handler/service worker push.
- Ricostruzione delle tabelle pubbliche, vincoli, funzioni e policy esportate: 82 controlli superati. Auth e Storage completi non sono replicati.
- `npm run build`: superato dopo la correzione dei link in nuova scheda. Restano avvisi di bundle grande e import storage statici/dinamici.
- Il contenuto frontend del commit è stato esportato in una copia isolata, dove sono passati installazione pulita, `npm run test:html` e `npm run build`. Il controllo Chromium del sito compilato ha verificato avvio anonimo e redirect delle rotte protette su desktop/mobile con HTTPS bloccato, senza credenziali o accessi ai dati Supabase.
- Lint globale: ancora non pulito per gli errori già documentati; non viene presentato come controllo superato.

Non è stata provata la preview Cloudflare né l'app distribuita. Le verifiche locali non sono una garanzia di assenza assoluta di regressioni.

Prossima azione esterna proposta: push del solo commit frontend sul branch `security/app-hardening-preview` per ottenere una preview Cloudflare, senza push/merge su main e senza deploy Supabase. Questa pubblicazione non è ancora stata eseguita.

L'utente ha autorizzato il push della preview. È stato tentato `git push origin e549877:refs/heads/security/app-hardening-preview`, senza force, ma Git si è fermato prima dell'invio perché l'ambiente non dispone di credenziali GitHub (`could not read Username`). Nessun push riuscito e nessun link/build Cloudflare verificabile. Il commit resta locale; main e Supabase non sono stati aggiornati da questa operazione. Per continuare serve l'integrazione GitHub oppure lo stesso comando eseguito dal terminale autenticato dell'utente. Non occorre ricommittare le modifiche backend presenti nel working tree.

## Preview ricevuta e verificata

L'utente ha successivamente fornito `https://805386ae.lifehabits-pwa.pages.dev/`, riferendo che sembra funzionare. La preview risponde HTTP 200. Sono stati letti soltanto HTML e asset statici pubblici, senza login, scritture o richieste al database.

JavaScript `/assets/index-ft523kIl.js`, CSS `/assets/index-DVXp7Eb0.css`, manifest, registerSW e sw.js corrispondono byte per byte ai file della build isolata del contenuto frontend del commit `e549877`. Gli header CSP, nosniff, X-Frame-Options DENY e Referrer-Policy sono presenti come previsto dal repository. Questo conferma l'identità degli asset pubblicati; non sostituisce la lettura del commit remoto o dei file della futura PR.

Il riscontro funzionale dell'utente è positivo ma generico: non è stato registrato un elenco di flussi autenticati provati e non è stata osservata la consegna reale delle notifiche. Il browser autenticato e i dispositivi degli utenti non sono stati controllati dall'agente. Non si dichiara una garanzia assoluta di assenza di regressioni.

Il frontend è candidato al passaggio successivo su main, limitatamente al commit preparato, dopo revisione della differenza tra i branch e dei normali flussi nell'anteprima. Il confronto è `https://github.com/sciama00-design/lifehabits_pwa/compare/main...security/app-hardening-preview`. Ci si aspetta una PR con il solo intervento frontend, senza modifiche SQL, funzioni Supabase, cron o esportazioni live-context; la selezione locale comprendeva 14 file.

Nessun merge o push su main è stato eseguito dall'agente. La pubblicazione in produzione è un'azione separata, e il merge su main avvia il deploy automatico Cloudflare. I problemi backend restano aperti fino al rilascio Supabase dedicato.

Riferimenti: [Cloudflare Pages — preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [DOMPurify — gestione target blank](https://github.com/cure53/DOMPurify/blob/main/demos/hooks-target-blank-demo.html).
