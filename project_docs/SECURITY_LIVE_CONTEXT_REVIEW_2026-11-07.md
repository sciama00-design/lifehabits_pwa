# Esame delle esportazioni del progetto reale

7 novembre 2026. Analisi locale dei file forniti in `project_docs/live-context/`. Nessuna connessione al database remoto, modifica in produzione o lettura dei record degli utenti.

Aggiornamento: ricevuto anche `Supabase Snippet Untitled query (5).csv`, con la struttura e il codice delle funzioni. La verifica aggiuntiva descritta in fondo supera i limiti della prima analisi delle sole policy; le sezioni iniziali conservano la provenienza delle osservazioni.

## Materiale ricevuto

| File | Contenuto | Righe |
| --- | --- | --- |
| `Supabase Snippet Untitled query.csv` | Policy delle tabelle selezionate e Storage | 55 |
| `Supabase Snippet Untitled query (1).csv` | Privilegi di tabella per anon/authenticated/service_role | 204 |
| `Supabase Snippet Untitled query (2).csv` | Firme, SECURITY DEFINER, configurazione e ACL di sei funzioni | 6 |
| `Supabase Snippet Untitled query (3).csv` | Trigger su auth.users e profiles | 1 |
| `Supabase Snippet Untitled query (4).csv` | Bucket media | 1 |

Non è presente un file salvato chiamato `queries-results`. Non risultano esportazioni dei trigger aggiuntivi né delle due query sulle relazioni incoerenti. La loro assenza non dimostra da sola che quelle query siano state eseguite e abbiano restituito zero righe.

## Cosa emerge

- **Piani leggibili senza filtro di proprietà:** su `subscription_plans` compare `allow_all_read_test`, SELECT permissiva per PUBLIC con `USING (true)`. Sono inoltre esportati grants SELECT a `anon` e `authenticated`. Questa policy elimina il filtro per cliente anche quando RLS è abilitata: le policy permissive si combinano con OR. Non è stato tentato alcun accesso attraverso la Data API reale, della quale resta da verificare anche l'esposizione dello schema. La patch candidata elimina già questa policy sostituendo il set delle policy dei piani.
- **Profili:** SELECT universale e UPDATE della propria riga senza restrizione delle colonne. Nell'esportazione dei trigger su auth.users/profiles appare soltanto `on_auth_user_created`: nessun trigger di protezione del ruolo risulta in quel risultato. Per confermare l'intera catena verso admin mancano il vincolo della colonna role e il corpo effettivo di `is_admin()`.
- **Relazioni coach/client:** la policy INSERT ammette `coach_id = auth.uid()` senza controllo esplicito del ruolo o dell'autorità sul cliente. Per concludere la verifica complessiva servono anche vincoli e trigger effettivi della tabella.
- **Assegnazioni e notifiche:** le policy esportate permettono UPDATE delle righe del cliente e gestione delle regole identificate dal solo coach_id del chiamante, coerentemente con i rischi del primo audit. Restano da completare i controlli su trigger, vincoli e funzioni distribuite.
- **Storage:** `media` è pubblico, senza limiti MIME/dimensione nel risultato; le policy concedono gestione del bucket a tutti gli autenticati. La correzione proposta continua a preservare gli URL e la condivisione tra coach.
- **Bacheca:** l'esportazione include la policy corretta di relazione e destinatario. Non contiene la vecchia policy di lettura universale né quella con il confronto tautologico. Il vecchio difetto della bacheca non risulta presente in questo snapshot delle policy.
- **Funzioni:** sono presenti tutte e sei le firme attese. Risultano SECURITY DEFINER, con `proconfig = null` e privilegi EXECUTE anche per PUBLIC/anon. Queste informazioni non includono il codice né dimostrano da sole un bypass: le guardie interne sono ancora da verificare.

## Come interpretare risultati senza righe

- Query dei trigger aggiuntivi su assignments/clients_info/notification_rules: zero righe significa nessun trigger utente corrispondente, nel contesto e con la visibilità della sessione che ha eseguito la query. Non significa che le tabelle siano vuote o che RLS sia assente.
- Query delle relazioni coach/client con ruoli incoerenti: zero righe significa nessuna incoerenza che soddisfa quel predicato. Non dimostra che tutte le relazioni siano state autorizzate: una relazione abusiva tra un coach e un client con ruoli formalmente validi non viene rilevata.
- Query delle regole push incoerenti: zero righe significa nessuna regola che soddisfa quel predicato; non prova che il cron o l'autorizzazione delle Edge Functions siano corretti.

Non è possibile attribuire con certezza questi risultati vuoti alle query specifiche senza la conferma dell'utente o un'esportazione che li rappresenti esplicitamente.

## Verifica locale svolta

Le 55 policy del CSV sono state ricostruite in un PostgreSQL PGlite isolato, sullo schema e sulle funzioni del repository, con utenti e dati sintetici. Prima della patch è stata verificata la lettura anonima di un piano fittizio tramite `allow_all_read_test`. Dopo l'applicazione della patch candidata, la lettura anonima e quella di un altro cliente sono negate; i flussi autorizzati restano verificati. Il runner ha superato **65 controlli**, inclusa l'idempotenza della patch.

Il test non replica ancora il database reale: i corpi delle funzioni, la struttura esatta delle tabelle e lo stato RLS non sono contenuti nei cinque CSV ricevuti. Nessun esito locale viene presentato come exploit eseguito in produzione o garanzia di compatibilità del rilascio.

## Contesto ancora necessario

È disponibile `src/database/security/export_context_readonly.sql`: una sola SELECT sui cataloghi che restituisce sempre una riga JSON, con array vuoti `[]` dove non ci sono elementi. Esporta struttura delle tabelle, flag RLS, vincoli, trigger e codice delle funzioni pertinenti. Non legge record utenti né configurazioni cron o segreti Auth. Prima di condividere il risultato occorre comunque oscurare eventuali segreti incorporati nel codice delle funzioni già distribuite.

Servono inoltre il codice delle due Edge Functions effettivamente distribuite, le loro impostazioni JWT, la configurazione cron con credenziali oscurate e le informazioni sul deploy frontend richieste in precedenza. Questi elementi non sono nei CSV ricevuti.

La query aggiuntiva è stata verificata nel database locale dentro una transazione READ ONLY e produce una riga con le sezioni attese. Non è stata eseguita sul progetto reale.

## Seconda esportazione: struttura e funzioni reali

Il CSV `(5)` contiene una riga JSON valida con PostgreSQL **17.6**, **18 tabelle** (16 pubbliche e 2 Storage), **137 colonne**, **61 vincoli**, **12 trigger** e **6 funzioni**.

- Il vincolo di `profiles.role` ammette `admin`; `is_admin()` legge il ruolo dal profilo. Il trigger `handle_new_user()` copia `raw_user_meta_data.role`, con fallback `coach`. La policy self-update già esportata non limita la colonna role e non risultano trigger utente sui profili che la proteggano. Questi dati confermano i meccanismi SQL di F01; l'accessibilità della registrazione pubblica resta una configurazione Auth distinta da verificare.
- Non risultano trigger utente sulle tabelle pubbliche selezionate, inclusi assignments, clients_info, client_coaches e notification_rules. Il risultato vuoto della precedente query sui trigger di queste tabelle è quindi coerente con la nuova esportazione. I 12 trigger presenti sono quello di creazione utente e 11 trigger della piattaforma Storage.
- Tutte le tabelle esportate hanno RLS abilitata, **tranne `notification_sent_log` e `daily_alert_sent_log`**. I privilegi effettivi di queste due tabelle non erano inclusi nel primo CSV dei grants, quindi non è dimostrata la loro accessibilità ai client. RLS disabilitata rende però insufficiente la protezione delle righe se esistono grants ai client: potrebbero essere letti o alterati i registri che governano gli invii.
- Le RPC esportate `create_client_user` e `create_coach_user` controllano rispettivamente il ruolo coach e admin. Le loro firme sono quelle usate dal frontend; i test ora eseguono esattamente questi corpi esportati prima e dopo la patch.
- Sono presenti differenze reali rispetto agli script di setup, fra cui `assignments.plan_id ON DELETE SET NULL`, campi aggiuntivi di alert_settings e i vincoli dei registri. La patch non modifica queste colonne, default o relazioni referenziali. La fixture locale li riproduce per le tabelle pubbliche.

### Protezione aggiuntiva dei registri notifiche

La patch candidata è stata estesa per abilitare RLS sui due registri, negare l'accesso ai ruoli anon/authenticated e mantenere SELECT/INSERT/UPDATE/DELETE per service_role. Non elimina righe né modifica i dati degli invii. Nel repository, i soli chiamanti di questi registri sono scheduler e dispatcher con client server privilegiato; nessun flusso frontend li legge o scrive direttamente. I chiamanti realmente distribuiti e il cron devono ancora essere verificati prima di applicare la modifica.

Non è stata applicata alcuna protezione al database remoto: resta una patch locale candidata.

### Test ripetibili con lo snapshot ricevuto

```sh
python3 scripts/build-live-security-fixture.py /tmp/lifehabits-live-schema.sql
LIFEHABITS_SCHEMA_SQL=/tmp/lifehabits-live-schema.sql npm run test:database
```

**82 controlli superati** ricostruendo le 16 tabelle pubbliche con i loro 53 vincoli, le 6 funzioni e le 55 policy esportate. Prima della patch sono verificati i bypass su dati sintetici; dopo la patch sono verificati blocco delle promozioni, accessi autorizzati, provisioning client/coach, gestione colleghi, piani, completamenti e operazioni server sui registri. La doppia applicazione della patch resta idempotente.

La ricostruzione usa Auth e Storage sintetici. I trigger interni di Storage, il servizio Auth completo e le policy di tabelle non comprese nel primo CSV non sono replicati. In particolare non è un test di login, invio email, upload reale, notifiche reali o dell'intera app su Supabase.

Per completare la valutazione restano codice e impostazioni JWT delle due Edge Functions distribuite, configurazione del cron con credenziali oscurate, informazioni sul deploy frontend e validazione dei dati storici. Non è necessario rieseguire l'esportazione strutturale già ricevuta.

## Funzioni distribuite e impostazioni JWT ricevute

Ricevuti e letti `push-dispatcher.zip` (`source/index.ts`) e `push-scheduler.zip` (`index.ts`). L'utente conferma **JWT disattivo per il dispatcher** e **attivo per lo scheduler**.

Il dispatcher esportato usa service_role e non verifica il chiamante o l'autorità sui destinatari. Con il controllo JWT del gateway disattivo, il codice non presenta una barriera di autenticazione per gli invii. È una conferma statica della configurazione vulnerabile di F05; non sono state effettuate chiamate reali o inviati messaggi.

Lo scheduler esportato mantiene il filtro per finestra temporale e il registro giornaliero, ma non autorizza autonomamente il chiamante. Il JWT attivo al gateway non identifica da solo il cron legittimo. Resta necessario conoscere la credenziale usata dal job prima di distribuire la nuova verifica server.

Il `config.toml` candidato ora preserva gli stessi valori di gateway: dispatcher false, scheduler true. La protezione del dispatcher proposto è nel codice con `auth.getUser()` e controllo delle autorizzazioni; non dipende dall'attivazione del gateway JWT. Questa scelta evita di introdurre un requisito JWT aggiuntivo nel gateway rispetto alla configurazione comunicata. Non è stata modificata alcuna impostazione remota.

Codice delle due funzioni e valori JWT sono quindi acquisiti. Restano cron, informazioni sul deploy frontend e le verifiche sui dati/servizi reali già indicate.

### Screenshot Cron ricevuto

Nello screenshot del progetto corretto risultano due job attivi:

- `push-scheduler-job`, frequenza `* * * * *` (ogni minuto), con comando che inizia con `SELECT net.http_post(...)` verso il progetto Life Habits. La parte visibile non mostra il nome completo della funzione, gli header o il corpo della richiesta.
- `cleanup-internal-logs`, frequenza `0 0 * * *`, con comando di pulizia di `cron.job_run_details`. Questo è un job di manutenzione dei log cron.

L'indicatore Succeeded della tabella non viene usato come prova dell'effettiva consegna delle notifiche o della correttezza delle credenziali HTTP.

Per raccogliere il dato mancante senza mostrare chiavi è stato preparato `src/database/security/export_cron_context_readonly.sql`. Legge soltanto il job delle notifiche e restituisce nome, frequenza, stato, nome funzione, uso di HTTP POST e classificazione della credenziale quando riconoscibile. Non restituisce comando, header o token; non legge valori da Vault. L'eventuale ruolo estratto da un JWT è solo un'informazione sulla configurazione, non una verifica della firma, della scadenza o della corrispondenza alla chiave server attuale. Se la credenziale arriva da Vault o da un'espressione non riconoscibile, il risultato lo indica senza tentare di leggere il segreto.

La query è stata provata in un PostgreSQL locale su sei configurazioni sintetiche, incluse credenziali non riconoscibili e JWT malformati, anche dentro transazioni READ ONLY. Non è stata eseguita sul progetto reale. Test ripetibile: `node scripts/test-cron-context-export.mjs`.

### Esportazione del cron ricevuta

`cron-context.csv` conferma `push-scheduler-job`, attivo, con frequenza `* * * * *`, chiamata HTTP POST a **push-scheduler** e credenziale classificata **service_role**.

Il tipo di chiamante è quello previsto dalla nuova protezione dello scheduler: non emerge la necessità di sostituire una chiamata anonima con una server. Restano valide le limitazioni dell'esportazione: il ruolo è decodificato dalla configurazione, senza verifica della firma/scadenza o confronto con `SUPABASE_SERVICE_ROLE_KEY` effettivamente disponibile alla funzione. La patch usa il confronto esatto con tale chiave, quindi il ruolo service_role da solo non dimostra che quel controllo passerà in produzione. Nessuna credenziale è stata acquisita e nessun job è stato modificato.

L'esportazione non contiene il corpo della richiesta né l'esito HTTP dell'invocazione. Il futuro piano di rilascio deve verificare una risposta effettiva dello scheduler e l'assenza di errori di autenticazione, senza limitarsi allo stato Succeeded del job SQL. Prima di definire come pubblicare le modifiche manca inoltre la configurazione di hosting/deploy automatico del frontend.

## Hosting e percorso di rilascio acquisiti

L'utente conferma Cloudflare Pages, branch di produzione main e deploy automatico al push. È stato creato localmente `security/app-hardening-preview`, senza commit o push. Il comando di build del repository non applica modifiche Supabase; restano da verificare comando di build e directory di output configurati nel servizio Cloudflare.

È disponibile [il percorso di rilascio](SECURITY_RELEASE_PLAN_2026-11-07.md): prima una preview del sito, poi eventuale pubblicazione del frontend e intervento Supabase separato. Questo evita di confondere il push del sito con l'applicazione delle patch a database e funzioni. I rischi del backend restano aperti fino al secondo intervento.

Nel controllo frontend è stato corretto un cambiamento di comportamento: la sanitizzazione ora preserva target blank con rel noopener/noreferrer, mantenendo l'apertura in nuova scheda dei link creati dall'editor. I test HTML e la build sono stati rieseguiti con esito positivo.

Build settings confermati: `npm run build`, output `dist`. Preparato il commit locale frontend `e549877` sul branch `security/app-hardening-preview`: 14 file, esclusi database, funzioni backend ed esportazioni ricevute. Installazione pulita, test HTML, build e avvio/redirect anonimi Chromium verificati sulla copia isolata del contenuto del commit. Nessun push o deploy effettuato; main resta su `b976ea7`. Dettagli nel percorso di rilascio.

Aggiornamento preview: l'utente ha fornito `https://805386ae.lifehabits-pwa.pages.dev/` e un riscontro funzionale positivo. Verificati HTTP 200, header previsti e corrispondenza byte per byte di JS/CSS/manifest/registerSW/sw.js con la build isolata del commit frontend. Nessuna chiamata ai dati Supabase. Il frontend può essere sottoposto al passaggio su main tramite revisione del solo branch dedicato; il merge non è stato eseguito e non chiude i rilievi backend.

Riferimenti tecnici: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL — funzioni di ispezione dei cataloghi](https://www.postgresql.org/docs/current/functions-info.html).
