# Handoff — completare la sicurezza senza regressioni operative

> **Chiusura del rilascio, 8 novembre 2026:** Supabase e frontend pubblicati. Commit applicativo `b92ffd9` su `main`; Cloudflare Pages deployment `9aa2ecdf-d7bd-424d-8c42-8a6cec99d623` riuscito. Dominio produzione, login, SW, manifest e asset HTTP 200; asset applicativi identici alla build verificata. Cron ancora HTTP 200. Backup/rollback, limiti e riferimenti di recupero nel [rapporto finale](SECURITY_DEPLOYMENT_2026-11-08.md). La correzione del ripristino notifiche per singolo dispositivo è ora distribuita. Nessun reset, logout, cambio di chiavi o richiesta generale di nuovi permessi. I precedenti blocchi GitHub e stati «non pubblicato» sotto sono **cronologia superata**, non lavoro ancora da eseguire.

> **Rilascio backend completato l'8 novembre:** [stato effettivo del deploy](SECURITY_DEPLOYMENT_2026-11-08.md). SQL ricevute e RLS/trigger applicati; scheduler v18 e dispatcher v11 attivi con cron HTTP 200. Il 401 del primo scheduler è stato recuperato e corretto: il cron usa una credenziale service_role valida distinta dalla chiave di ambiente, ora verificata tramite la Data API privata. Nessuna rotazione di chiavi, reset, logout o cancellazione globale. Restano pubblicazione frontend e accesso GitHub, già richiesto; non chiedere nuovamente autorizzazione al deploy, concessa esplicitamente. Le sezioni successive sono cronologia.

> **Prove finali dell'8 novembre:** [backup e ripristino verificati](SECURITY_BACKUP_RESTORE_2026-11-08.md). Backup privato escluso da Git; 53 tabelle e 87 media acquisiti, rollback di configurazione con conservazione delle nuove attività provato su PostgreSQL 17; login/refresh/provisioning Auth v2.197.0 provati prima/dopo candidato e rollback; 573 letture mirate su 71 profili preservate. Nessun deploy o SQL applicativo remoto. Non chiedere nuovamente gli export già acquisiti. Restano le tre verifiche distribuite indicate nel nuovo rapporto.

> **Collegamento successivo dell'8 novembre: accesso Supabase ripristinato.** Acquisiti schema attuale, tutte le 70 policy delle tabelle selezionate, grants dei log e sorgenti Edge attuali. Scheduler confermato HTTP 200 nei log; fixture aggiornata alle 70 policy: 104 controlli superati. Dettagli nel rapporto sotto. Nessuna modifica remota; backup/ripristino, credenziale cron esatta e dispositivi restano da validare. Il permission denied citato nei paragrafi precedenti è storico e non è più un blocco.

> **Aggiornamento 8 novembre 2026:** leggere prima [SECURITY_VERIFICATION_2026-11-08.md](SECURITY_VERIFICATION_2026-11-08.md). La revisione ha corretto dispositivi push, feedback multipli/replay, compatibilità del body cron, date di Roma, concorrenza/errori parziali e manutenzione SQL. Le nuove Edge Functions richiedono prima `prepare_push_delivery_candidate.sql`, separato dalla patch RLS. Suite locale, fixture esportata e aggiornamento PWA sullo stesso origin sono stati rieseguiti; nessuna pubblicazione. Dopo «plugin collegato», l'accesso diretto al progetto Life Habits restituisce ancora permission denied. Backup/ripristino e verifica cron live restano condizioni mancanti: **rilascio fermo**, vulnerabilità live non dichiarate chiuse. I paragrafi seguenti descrivono il precedente passaggio e non sostituiscono questo stato.

Aggiornato il **7 novembre 2026**, timezone utente Europe/Rome. Questo è il punto di ripresa prioritario: gli altri report conservano anche stati intermedi ormai superati. Ricontrollare sempre lo stato attuale prima di agire.

## Mandato dell'utente: vincolo determinante

L'utente ha chiesto un audit di sicurezza, inizialmente con sottoagenti Luna, poi di correggere i problemi **«SE E SOLO SE non interrompe l'operatività dell'app»**. Per il passaggio di sessione ribadisce: **gli utenti in produzione non devono accorgersi delle modifiche; tutto deve continuare in modo fluido**.

Il prossimo agente deve **rivedere criticamente anche il lavoro del precedente agente**, non limitarsi a fidarsi dei test o delle dichiarazioni di compatibilità. Correggere accessi abusivi senza alterare accessi e azioni legittimi. Non promettere il 100% di assenza di problemi. Se una correzione richiede cambiamenti percepibili, preparare una transizione e spiegare il limite; non introdurli silenziosamente e non dichiarare chiusa la vulnerabilità.

L'utente ora vuole soltanto l'handoff e riprenderà in un'altra sessione. Nessun nuovo deploy, merge o modifica remota durante questo passaggio.

## Stato Git e pubblicazione: leggere attentamente

- Repository: `https://github.com/sciama00-design/lifehabits_pwa.git`.
- CWD del repository nell'ambiente precedente: `/home/dev/projects/lifehabits/lifehabits_pwa`.
- Branch locale corrente: **`security/app-hardening-preview`**.
- HEAD locale: **`e549877a8f1b8a5055826142fc586b9a74db2e69`**, commit frontend di **14 file**.
- `main` locale: **`b976ea709dc01cfe2103a2c94e535744fe0908ec`** all'ultima verifica. Questo NON prova lo stato remoto attuale: l'utente può aver agito su GitHub nel frattempo.
- Il commit frontend ha autore locale `Codex <codex@local.invalid>`; non è stata modificata la configurazione Git globale. È già stato pubblicato in una preview, quindi **non riscriverlo con amend/force push**.
- **Molto lavoro backend e documentazione è ancora non committato.** Non eseguire `git reset --hard`, `git clean`, checkout forzati o `git add .` indiscriminato.
- Indice Git vuoto all'handoff. `package.json` e lockfile hanno differenze residue volute: HEAD include solo test/dipendenze frontend; il working tree aggiunge PGlite e script database/backend. Non sono una corruzione del commit.
- Un altro workspace ottenuto da un clone GitHub potrebbe NON contenere questo handoff, le patch backend o i dati di contesto, che sono locali. Riprendere nello stesso workspace o trasferire esplicitamente i file locali prima di abbandonarlo.

### Autorizzazioni e accesso agli account

L'utente ha autorizzato il push **del solo branch di preview**. Il tentativo dell'agente è fallito per credenziali GitHub assenti; l'utente ha poi fornito la preview funzionante. Non è stato effettuato dall'agente alcun merge/push su main, deploy Edge Functions, applicazione SQL o invio di notifiche reali.

Il plugin GitHub è stato suggerito ma non ne è stata confermata l'installazione/connessione. Il connettore Supabase disponibile allora mostrava altri progetti, non Life Habits. **Riscoprire le capacità attuali**: non reiterare questi blocchi se nella nuova sessione gli account sono stati collegati. Non chiedere token/password in chat e non stampare segreti.

La precedente autorizzazione al push preview non va interpretata come approvazione indiscriminata a cambiare l'unico database o a pubblicare tutte le patch insieme. Preparare risultati verificabili e un percorso di ripristino prima di un rilascio di produzione.

## Infrastruttura e contesto già acquisiti: non richiederli da capo

| Elemento | Dato confermato |
| --- | --- |
| Hosting | Cloudflare Pages |
| Branch produzione | main, deploy automatico al push |
| Build | `npm run build` |
| Output | `dist` |
| Effetto build nel repository | TypeScript + Vite; non applica SQL né distribuisce Edge Functions |
| Progetto Supabase | `gkbxiyzmtrxukpoaqdqn` |
| Ambienti backend | Uno solo; l'utente non ha staging |
| Dispatcher distribuito | `push-dispatcher`, gateway Verify JWT **disattivo** |
| Scheduler distribuito | `push-scheduler`, gateway Verify JWT **attivo** |
| Cron notifiche | `push-scheduler-job`, attivo, `* * * * *`, HTTP POST a push-scheduler |
| Credenziale cron | JWT con ruolo dichiarato service_role; chiave non condivisa |
| Altro cron | cleanup-internal-logs, `0 0 * * *`, pulizia cron.job_run_details |

Il ruolo nel CSV del cron è **decodificato**, non verifica firma, scadenza o uguaglianza alla `SUPABASE_SERVICE_ROLE_KEY` attuale. Il nuovo scheduler confronta la chiave esattamente: **questa compatibilità è ancora da provare senza esporre segreti**. L'indicatore Succeeded del job SQL non dimostra un HTTP 200 o una notifica consegnata. Corpo HTTP e risoluzione completa della credenziale non sono nel CSV del cron.

### Preview frontend già pubblicata

URL: **https://805386ae.lifehabits-pwa.pages.dev/**

L'utente ha detto «Sembra andare tutto». È un riscontro positivo generico, non una matrice completa di test per ruoli e dispositivi. La parte pubblica è stata controllata dall'agente: HTTP 200 e asset corrispondenti byte per byte alla build isolata del frontend preparato:

- JS: `/assets/index-ft523kIl.js`.
- CSS: `/assets/index-DVXp7Eb0.css`.
- Manifest, registerSW e sw.js: corrispondenti alla build isolata.
- CSP, nosniff, X-Frame-Options DENY e Referrer-Policy: presenti come nel repository.

Non è stato osservato un browser autenticato dell'utente, né una consegna push reale. Il confronto degli asset non certifica lo stato del branch remoto o l'assenza di commit ulteriori: controllare la PR effettiva. Confronto utile: https://github.com/sciama00-design/lifehabits_pwa/compare/main...security/app-hardening-preview

Una preview frontend **non isola Supabase**: se usa le variabili di produzione, una scrittura agisce sul database reale. Non creare/modificare dati di clienti reali, resettare password o inviare broadcast per testare. Un dominio preview non esercita automaticamente cache e aggiornamento PWA dei dispositivi già installati sul dominio di produzione.

## Cosa contiene il commit frontend

`git show --stat e549877` è la fonte esatta. Include:

- DOMPurify in `src/lib/sanitizeRichHtml.ts`, usato nei cinque sink HTML persistiti: TextPostModal, ContentCard, MediaViewer, ClientDashboard e CoachBoard.
- Preservazione di target blank con rel noopener/noreferrer, rimuovendo rel opener. Non perdere l'apertura dei link in nuova scheda in ulteriori refactor.
- RichTextEditor: StarterKit con Link disabilitato per evitare duplicati; aggiornamenti esterni setContent con emitUpdate false, mantenendo onChange per input utente.
- Service worker principale e custom: URL delle notifiche limitati alla propria origine, inclusi assoluti same-origin.
- Lockfile con aggiornamenti di sicurezza compatibili e test HTML/componenti in jsdom.
- `project_docs/FRONTEND_SECURITY_RELEASE.md` con scope e validazione.

Non include modifiche SQL, funzioni Supabase, cron, PGlite o esportazioni reali. Le normali chiamate frontend alle API Supabase non sono state cambiate.

## Cosa resta nel working tree: candidato, non produzione

### SQL

`src/database/security/apply_security_fixes_candidate.sql` è **una bozza revisionabile, NON una migrazione da applicare alla cieca**. È fuori da `supabase/migrations` e non è mai stata eseguita sul progetto remoto.

Intende correggere: modifica autonoma del ruolo; autoassociazione coach/client; esposizione profili/piani; UPDATE completo delle assegnazioni da client; regole push arbitrarie; mutazioni media da client; policy bacheca residue; accesso ai due registri notifiche con RLS disattivata nello snapshot.

Preserva: firme delle RPC esistenti, creazione client/coach, directory coach per collaborazioni, elenco/gestione colleghi dei clienti già assegnati, completamenti giornalieri, URL pubblici e gestione media condivisa tra coach/admin.

Usa transazione, lock_timeout 2s e statement_timeout 30s, preflight che abortisce su alcune incoerenze e sostituzione dei set di policy interessati. **Questo non prova assenza di blocchi o compatibilità con policy non esportate.** Non riscrive dati storici e non ripara assegnazioni abusive già esistenti.

### Backend push

File modificati/non committati: `supabase/functions/push-dispatcher/index.ts`, `push-scheduler/index.ts`, `_shared/push-policy.js`, `_tests/*`, `supabase/config.toml`, script diagnostici.

Il dispatcher candidato verifica getUser e autorizza destinatari/operazioni; deriva dal server il messaggio feedback e verifica un feedback recente, anziché fidarsi del testo inviato dal client. Lo scheduler ricontrolla ruolo coach e relazioni delle regole prima di inviare. I percorsi cron richiedono il bearer esattamente uguale alla chiave server configurata.

`config.toml` candidato mantiene **dispatcher false / scheduler true**, coerentemente con le impostazioni riferite dall'utente. Dispatcher false non significa assenza di protezione nel candidato: l'autenticazione è nel codice. Non modificare i toggle per tentativi.

## Contesto reale disponibile su disco

`project_docs/live-context/` contiene:

- `Supabase Snippet Untitled query.csv`: 55 policy su un sottoinsieme delle tabelle.
- `(1).csv`: 204 grants per le tabelle selezionate; NON tutti i grants di tutte le tabelle.
- `(2).csv`: firme/ACL/configurazione di 6 funzioni.
- `(3).csv`: trigger su auth.users e profiles.
- `(4).csv`: bucket media pubblico, senza limiti MIME/dimensione nel risultato.
- `(5).csv`: JSON con PostgreSQL 17.6, 18 tabelle, 137 colonne, 61 vincoli, 12 trigger, codice di 6 funzioni. Sedici tabelle sono pubbliche; due sono Storage.
- `push-dispatcher.zip` (`source/index.ts`) e `push-scheduler.zip` (`index.ts`): versioni effettivamente distribuite prima delle patch, da confrontare con il candidato.
- `cron-context.csv`: classificazione del cron, senza token.
- `DA_COMPILARE.md`: raccolta delle conferme; alcuni campi residui sono ignoti, non è necessario far ricompilare tutto all'utente.

Conferme importanti: role ammette admin; is_admin legge profiles; handle_new_user copia ruolo da raw_user_meta_data; nessun trigger utente sulle tabelle pubbliche selezionate; policy allow_all_read_test sui piani; RLS off sui due registri notifiche. Il dispatcher distribuito usa service_role senza autenticazione applicativa e ha gateway JWT off. La bacheca esportata ha già il filtro corretto e non la vecchia SELECT universale.

L'utente riferisce alcune query senza righe. Per i trigger l'assenza è coerente con il nuovo snapshot; non assumere invece che i dati storici siano tutti sani soltanto perché non è presente un CSV delle query di anomalie. Una relazione abusiva tra due ruoli formalmente validi non si distingue da una collaborazione legittima con il solo controllo dei ruoli.

## Revisione indipendente obbligatoria prima di concludere

Questi sono **punti di verifica**, non affermazioni che tutto sia già sbagliato o risolto:

1. **Stato reale e diff:** verificare remoto/main/PR/deployment prima di pubblicare. Il push main avvia Cloudflare. Conservare il lavoro locale e separare frontend/backend; niente commit di tutto.
2. **Qualità dei test:** leggere i test e cercare falsi positivi, non fidarsi del numero di assert. La fixture dà deliberatamente grants larghi; non prova i grants reali. Le 55 policy non coprono tutte le 16 tabelle pubbliche. Auth e Storage completi, trigger interni Storage, dati reali e flussi HTTP Supabase non sono replicati.
3. **RPC e manutenzione:** riesaminare guard_profile_role e gli altri trigger anche con bootstrap/restore/SQL amministrativo e service_role senza profilo. Non usare current_user dentro un SECURITY DEFINER come prova del chiamante: sarebbe l'owner. Il ripristino Auth attuale passa metadata e non è stato validato con il nuovo default client; non reintrodurre fiducia nei metadata utente per risolverlo.
4. **Relazioni e contenuti:** controllare tutte le forme legittime di collaborazione e dei dati legacy, incluse relazioni primarie, colleghi, eventuali piani senza legame esplicito, consultazione condivisa, rinnovo piani e archiviazione. La sostituzione ampia delle policy richiede confronto completo, non solo nomi coincidenti.
5. **Registri interni:** acquisire i grants reali dei due log prima del ripristino/release; non erano nel primo export. Il candidato ne cambia RLS e privilegi. Preparare una reversibilità concreta, non promettere un rollback dal solo CSV parziale.
6. **Cron e input:** verificare chiave effettiva rispetto al confronto esatto del candidato, firma/scadenza, corpo della richiesta e risposta HTTP. Il vecchio scheduler tollerava un body non parseabile con fallback a {}; il candidato lo rifiuta: valutare il job reale. isValidTime accetta solo HH:mm: controllare eventuali tempi legacy con secondi. Provare confini data Europa/Roma, mezzanotte/DST, deduplicazione e assenza di duplicati o invii persi.
7. **Dispositivi push:** oggi il codice candidato può cancellare tutte le sottoscrizioni con uno stesso user_id quando UN dispositivo restituisce 404/410. È un punto concreto da correggere/verificare prima del backend: provare almeno due dispositivi e pulire soltanto la sottoscrizione scaduta, preservando quella valida. Controllare anche errori parziali e scrittura dei registri.
8. **Autorizzazione push:** riprovare self-test, client→coach dopo feedback, annunci coach→propri client, broadcast amministrativo e regole schedulate. Considerare preferenze disabilitate, isolamento tra coach, fallimenti DB e invocazioni ripetute: autorizzare una relazione non aggiunge da solo rate limiting/idempotenza.
9. **Frontend/PWA:** controllare veramente sessione, editor, nuovi tab, immagini/PDF/video, calendari e aggiornamento da vecchio service worker allo stesso origin, con stato non salvato. La preview a dominio diverso non dimostra la continuità della PWA già installata. Non sfruttare utenti reali per test distruttivi.
10. **Rischi non chiusi:** password iniziale condivisa nei nuovi client, bucket pubblico/isolamento tra coach volutamente mantenuto, accesso storico dopo scadenza abbonamento, backup/artifact/CI e 12 avvisi npm bassi/medi residui. Non definirli risolti. Credenziali uniche/inviti richiedono una transizione che non blocchi accessi esistenti; niente reset massivi o logout forzati non concordati.

Anche un miglioramento apparentemente sicuro può cambiare un comportamento: in questa sessione sono già state trovate/corrette regressioni nelle policy dei colleghi, nella lettura pubblica dei media e nei link target blank. Cercarne altre prima del rilascio backend.

## Test ripetibili e limiti delle evidenze

Ambiente di verifica: Node 24.21.0. jsdom 31 richiede Node ^22.22.2 o ^24.15.0 o >=26; evitare di confondere un errore dell'ambiente test con un bug dell'app.

Nel working tree completo:

```sh
npm ci --ignore-scripts
npm run test:security
node scripts/test-cron-context-export.mjs
python3 scripts/build-live-security-fixture.py /tmp/lifehabits-live-schema.sql
LIFEHABITS_SCHEMA_SQL=/tmp/lifehabits-live-schema.sql npm run test:database
npm run build
git diff --check
```

Risultati precedenti: 80 controlli SQL nella fixture standard; 82 con struttura/funzioni/policy esportate; tre test unitari sanitizer, test componenti/editor jsdom, cinque test policy push e tre test handler/SW. La query export cron ha sei casi sintetici e il caso job assente. I conteggi possono cambiare con nuove verifiche: non usarli come criterio di sufficienza.

Il generatore Python crea SOLO DDL per il database di test usa-e-getta, non un backup Supabase completo. I DROP/TRUNCATE del runner sono SOLO per PGlite: non trasferirli al progetto reale. I vecchi script `test_notification.*` e `scripts/test-push.ts`, invece, invocano servizi reali: **non eseguirli come se fossero test unitari**, potrebbero inviare notifiche.

Il commit frontend isolato contiene solo `npm run test:html` e build: non contiene PGlite o la suite backend. È stato verificato con installazione pulita in una copia temporanea. Il browser locale ha controllato avvio anonimo e redirect con HTTPS bloccato e profilo vuoto. Non ha verificato accessi autenticati o device reali. Le copie e gli script in /tmp non sono affidabili come materiale persistente per la nuova sessione.

Il lint globale era già non pulito: 115 errori/22 warning iniziali, 113/22 nell'ultima verifica riportata. La build passa, ma non dichiarare il lint superato. npm audit era passato da 34 avvisi (23 alti) a 12 (10 medi, 2 bassi, zero alti/critici), senza force. Verificare nuovamente se si cambiano dipendenze; non applicare automaticamente i downgrade proposti dal resolver.

## Ordine di ripresa consigliato

1. Leggere questo handoff e controllare stato Git/remoto e tool attualmente connessi. Salvaguardare tutto il working tree; i report storici non sono uno stato remoto aggiornato.
2. Rivedere il commit frontend e la preview, verificare i normali flussi e il passaggio PWA. Accertare se l'utente abbia già creato/mergiato una PR. Se non lo ha fatto, separare la decisione del rilascio frontend da quella del backend.
3. Fare una revisione indipendente delle patch SQL/Edge e dei test, concentrandosi sui punti concreti sopra. Correggere localmente i difetti e ampliare i test per i casi operativi mancanti. Se utile e disponibile, rispettare la preferenza precedente per sottoagenti Luna nell'audit.
4. Prima di toccare l'unico backend, predisporre backup verificato, definizioni/ACL complete precedenti, rollback che conservi i dati e prova quanto più fedele possibile in ambiente isolato. Non presumere che Cloudflare preview faccia staging del database. La CLI Supabase non era installata nel precedente ambiente; scoprire disponibilità/comandi prima di usarla.
5. Trasformare il candidato in una migrazione solo quando schema corrente e compatibilità sono dimostrati; seguire la skill Supabase, che richiede il comando CLI per creare le migrazioni, senza inventare un nome numerato. Non incollare il candidato live perché «i test passano».
6. Presentare all'utente un riepilogo breve e netto di cosa cambia, cosa è verificato, cosa resta rischioso, ordine di pubblicazione e ripristino. Non sommergerlo con gli stessi export già disponibili. Le conferme servono per i passaggi esterni effettivi, a lavoro locale concreto e revisionabile.
7. Dopo eventuali rilasci, verificare frontend, API, invocazioni cron HTTP effettive, dispositivi e assenza di errori per i ruoli normali. Non limitarsi a build verde o job SQL Succeeded. Aggiornare stato e problemi residui senza chiamare «tutto a posto» il solo frontend.

## Documenti di supporto

- `SECURITY_AUDIT_2026-11-07.md`: findings iniziali, non stato corrente.
- `SECURITY_FIXES_2026-11-07.md`: implementazioni e rinvii, con aggiornamenti cronologici.
- `SECURITY_LIVE_CONTEXT_REVIEW_2026-11-07.md`: lettura delle esportazioni e conferme successive.
- `SECURITY_RELEASE_PLAN_2026-11-07.md`: separazione frontend/Supabase e storia pubblicazione preview.
- `FRONTEND_SECURITY_RELEASE.md`: scope del commit frontend.
- `../src/database/security/README.md`: preflight e limiti SQL.

Non è necessaria una nuova implementazione solo per «ripartire». Prima leggere, verificare e correggere quanto già preparato. **Obiettivo conclusivo: sicurezza migliorata con continuità dei flussi legittimi, non soltanto un numero maggiore di test passati.**
