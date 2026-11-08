# Audit di sicurezza — Life Habits

Data: 7 novembre 2026. Revisione: `b976ea7`.

Stato degli interventi successivi: [correzioni e verifiche](SECURITY_FIXES_2026-11-07.md). Questo audit conserva i rilievi iniziali; non indica che le patch siano state applicate in produzione.

Audit del repository con tre sottoagenti **gpt-6-luna**, dedicati a database/RLS, frontend e backend/configurazione/dipendenze. I risultati sono stati ricontrollati e consolidati dall'agente principale. Nessuna modifica al codice applicativo e nessuna chiamata al progetto Supabase distribuito.

## Esito e limiti

Rilevati **8 problemi**: **1 critico, 4 alti, 3 medi**. La priorità è impedire escalation di ruolo e accesso ai dati di clienti non assegnati.

Le vulnerabilità descritte sono evidenziate dal codice; la sfruttabilità in produzione non è stata dimostrata. In particolare `src/database/schema.sql`, `init_db.sql` e `full_schema_setup.sql` sono varianti di setup, non una sequenza univoca di migrazioni. Mancano uno snapshot delle policy effettive e una verifica dei privilegi del database distribuito. Ogni rilievo SQL va confermato sulle policy e sui grants attivi.

Non sono stati eseguiti exploit, inviate notifiche o letti dati degli utenti. Non sono stati eseguiti test dinamici su database/browser. `npm audit --ignore-scripts --omit=dev` è stato tentato da un sottoagente, ma il registry non era raggiungibile: **lo stato delle vulnerabilità delle dipendenze rimane non verificato**.

| ID | Gravità | Problema | Prerequisito principale |
| --- | --- | --- | --- |
| F01 | Critica | Un utente può ottenere il ruolo admin | Policy self-update e migrazione ruolo admin attive; oppure trigger da metadata e signup abilitato |
| F02 | Alta | Associazione autonoma a clienti altrui | Policy INSERT su client_coaches attiva |
| F03 | Alta | Stored XSS nei contenuti HTML | Possibilità di scrivere un contenuto poi visualizzato da una vittima |
| F04 | Alta | Modifica/cancellazione di media altrui | Policy Storage presenti nel repository attive |
| F05 | Alta | Notifiche privilegiate senza autorizzazione del chiamante | Edge Functions distribuite e raggiungibili con credenziali non privilegiate |
| F06 | Media | Enumerazione di profili ed email | Policy SELECT universale e relativi grants attivi |
| F07 | Media | Client autorizzato a modificare tutta l'assegnazione | UPDATE su assignments con grants a livello tabella |
| F08 | Media | Regole push verso clienti non assegnati | Policy notification_rules e scheduler attivi |

## F01 — Escalation da client a coach/admin

**Evidenza:** `src/database/schema.sql:135-137`, `src/database/init_db.sql:133-135`, `src/database/migration_admin_role.sql:2-8` e `:12-49`.

La policy di UPDATE controlla soltanto che l'ID della riga sia quello del chiamante. Non limita le colonne modificabili: anche `role` può essere aggiornato. Il vincolo iniziale ammette `coach`; la migrazione amministrativa aggiunge `admin`. Un client può quindi aggiornare il proprio ruolo via Data API. `is_admin()` legge quel ruolo e abilita le policy amministrative, inclusa la creazione di coach tramite RPC.

Il problema non è l'assenza di `WITH CHECK` in sé: per UPDATE il predicato USING viene riutilizzato quando CHECK è omesso, ma controlla ancora solo l'identità della riga. Aggiungere semplicemente `WITH CHECK (auth.uid() = id)` non protegge `role`.

**Secondo percorso, condizionale:** `src/database/full_schema_setup.sql:178-200` copia `raw_user_meta_data.role` nel profilo. Se questa variante di trigger è installata, la registrazione pubblica è abilitata e il vincolo ammette admin, un nuovo utente può richiedere quel ruolo nei metadata. La variante `automation_trigger.sql:2-14` imposta invece sempre coach: non ha lo stesso percorso verso admin, ma assegna comunque un ruolo privilegiato a ogni nuova registrazione.

**Correzione:** rendere il ruolo immutabile nelle operazioni ordinarie dell'utente; autorizzare i cambiamenti solo con un percorso amministrativo server/RPC. Usare privilegi sulle colonne o un trigger di controllo appropriato, verificando anche i grants a livello tabella. Non derivare mai ruoli privilegiati da user metadata; assegnare un ruolo iniziale non privilegiato o usare un invito autorizzato. Controllare i ruoli già assegnati prima di considerare risolto il rischio.

## F02 — Accesso ai clienti tramite autoassociazione

**Evidenza:** `src/database/schema.sql:129-144`, `src/database/init_db.sql:195-196`, `src/database/full_schema_setup.sql:170-171`, `supabase/migrations/20240313000000_daily_feedback.sql:36-43`.

L'INSERT in `client_coaches` è consentito quando `coach_id = auth.uid()`. Non viene verificato che il chiamante sia un coach, né che sia autorizzato a prendere in carico quel cliente. Conoscendo l'UUID di una vittima, un utente può aggiungere una relazione con sé stesso. `is_coach_of_client(victim)` diventa vero e le policy dipendenti concedono accesso ai dati collegati; la policy dei feedback consente esplicitamente la lettura mediante questa relazione.

Gli UUID possono essere reperiti tramite F06. L'attacco non richiede prima F01: l'assenza del controllo sul ruolo rende debole direttamente il confine della relazione.

**Correzione:** rimuovere l'inserimento diretto arbitrario. Creare relazioni attraverso una RPC/operazione server che verifichi ruolo, autorità sul cliente ed eventuale invito/consenso previsto dal prodotto. La RPC di creazione di un nuovo client può associare soltanto l'utente appena creato. Verificare le relazioni già presenti.

## F03 — Stored XSS nei contenuti HTML

**Evidenza:** `src/pages/client/ClientDashboard.tsx:202-205`, `src/pages/coach/CoachBoard.tsx:456-459`, `src/components/shared/ContentCard.tsx:243-246`, `src/components/shared/MediaViewer.tsx:402-407`, `src/components/shared/TextPostModal.tsx:89-92`.

Il contenuto persistito è passato a `dangerouslySetInnerHTML` senza sanitizzazione. Il normale editor Tiptap non costituisce un confine di sicurezza: chi può scrivere tramite API può inviare HTML diverso da quello prodotto dall'editor. Le policy di contenuti/post consentono scritture del proprietario, ad esempio `src/database/init_db.sql:154-160` e `:179`.

Un autore malevolo o un account compromesso può salvare HTML attivo che viene eseguito quando un altro utente apre il contenuto. La CSP proposta in `public/_headers:7` include `script-src 'unsafe-inline'`, quindi non blocca gli handler inline. Il client Supabase usa la persistenza di sessione predefinita (`src/lib/supabase.ts:10`): l'esecuzione di JavaScript nell'origine dell'app espone anche le operazioni e la sessione della vittima.

**Correzione:** sanitizzare ogni rendering HTML con una libreria mantenuta e un'allowlist stretta; validare anche gli schemi URL. Centralizzare il rendering sicuro e applicarlo a tutti i punti sopra. Validare/sanitizzare anche in scrittura dove possibile e riesaminare i contenuti esistenti. Irrigidire la CSP come difesa aggiuntiva, verificando prima le esigenze degli embed.

## F04 — Tutti gli autenticati possono gestire media altrui

**Evidenza:** `src/database/storage_setup.sql:7-18` e `:23-34`, `src/lib/storage.ts:24-29` e `:44-53`.

Il bucket viene creato pubblico. Le policy concedono INSERT e ALL a qualsiasi utente autenticato sul bucket `media`, senza vincoli su proprietario, ruolo o cartella. Un client può elencare, modificare o cancellare media caricati da un altro utente, oppure caricare propri file consumando spazio e banda. Il nome delle policy e i commenti non introducono controlli effettivi.

La lettura pubblica è inoltre incompatibile con eventuali media che debbano essere riservati ai clienti o protetti dalla scadenza dell'abbonamento: chi conosce l'URL può continuare a scaricarli. La scelta del bucket pubblico va verificata rispetto ai requisiti dei contenuti; non è di per sé un bug per asset volutamente pubblici.

**Correzione:** limitare scritture e cancellazioni al proprietario o ai ruoli esplicitamente autorizzati, con percorsi associati all'utente. Impostare limiti server sul bucket per dimensioni e MIME. Usare bucket privati e URL firmati a scadenza per contenuti riservati. Non basare i controlli sulla sola UI di upload.

## F05 — Edge Functions push senza autorizzazione

**Evidenza:** `supabase/functions/push-dispatcher/index.ts:33-68`, `supabase/functions/push-scheduler/index.ts:20-22`, `:37-57`, `:105-159`; `supabase/config.toml:3-4`.

Il dispatcher costruisce un client `service_role`, poi esegue `direct`, `broadcast`, `announcement` e `cron` senza verificare identità, ruolo o relazioni del chiamante. `user_id`, `coach_id`, destinatari, testo e URL arrivano dal body. Un utente non amministratore che raggiunga la funzione può inviare messaggi a destinatari arbitrari o a tutti i dispositivi. Il broadcast restituisce anche il numero di sottoscrizioni.

Lo scheduler usa lo stesso privilegio e accetta `timeOverride` senza autorizzazione applicativa: un chiamante non autorizzato può anticipare l'elaborazione delle regole e influenzare il registro giornaliero degli invii. I log limitano gli invii già elaborati, ma non sostituiscono l'autorizzazione.

`verify_jwt = true` è dichiarato per lo scheduler; non dimostra che il chiamante sia un amministratore o il cron previsto. Il repository non dichiara la configurazione del dispatcher. **Il livello di accesso effettivo va verificato sul deploy**; è sufficiente che normali utenti autenticati possano invocare questi percorsi perché il difetto sia sfruttabile.

L'URL del messaggio viene aperto senza allowlist dal service worker (`src/sw.ts:60-74`): combinato con il dispatcher, questo consente messaggi con collegamenti di phishing presentati come notifiche dell'app.

**Correzione:** verificare il chiamante prima di usare `service_role`. Limitare broadcast e cron a identità server/amministrative autorizzate; derivare il coach dal token e verificare ogni destinatario per gli annunci. Per le notifiche di feedback, ricavare destinatari e testo da un evento verificato. Rimuovere gli override temporali dai percorsi ordinari, limitare gli URL a percorsi consentiti e aggiungere limiti di frequenza.

## F06 — Profili ed email enumerabili

**Evidenza:** `src/database/schema.sql:4-9` e `:135`, `src/database/init_db.sql:133`, `src/database/full_schema_setup.sql:132`.

La policy SELECT su `profiles` è `USING (true)` e senza restrizione TO. Chi ha il grant SELECT può leggere tutti i profili, con UUID, email, nome e ruolo, anziché solo sé stesso e le persone con cui collabora. Se anche `anon` possiede il grant, l'enumerazione non richiede login; altrimenti resta accessibile agli autenticati con quel grant.

**Correzione:** restringere la lettura a sé stessi, relazioni autorizzate e amministratori. Se serve un elenco per collaborare, esporre soltanto i campi necessari tramite un percorso controllato, evitando email e dati personali non richiesti. Verificare separatamente i grants a `anon` e `authenticated`.

## F07 — UPDATE del client esteso a tutta l'assegnazione

**Evidenza:** `src/database/schema.sql:164-166`, `src/database/init_db.sql:167-169`, `src/database/full_schema_setup.sql:155`.

La policy chiamata “Clients can update completion status” limita le righe a `client_id = auth.uid()`, ma non limita le colonne. Con privilegi UPDATE a livello tabella il client può modificare descrizione, link, date, coach e piano della propria assegnazione, mantenendo il proprio client_id. Si perde l'integrità del programma definito dal coach. Il testo HTML modificabile contribuisce anche alla superficie di F03 quando il coach lo visualizza.

**Correzione:** consentire al client soltanto l'operazione di completamento, tramite RPC ristretta o controllo dei campi modificati basato sul ruolo. Mantenere le modifiche al programma in percorsi riservati ai coach autorizzati. Gli Omit/Partial TypeScript non limitano le richieste REST.

## F08 — Regole push con destinatari arbitrari

**Evidenza:** `src/database/push_schema.sql:67-88` e `:104-107`, `supabase/functions/push-scheduler/index.ts:109-112` e `:131-159`.

La policy ALL controlla soltanto `coach_id = auth.uid()`, senza verificare ruolo né relazione con `client_id`. I grants agli autenticati sono espliciti. Un client può inserire una regola con sé stesso nel campo coach e un altro utente come destinatario. Lo scheduler privilegiato prende il `client_id` della regola senza ricontrollare la relazione e invia il messaggio se la vittima ha notifiche abilitate e una sottoscrizione valida.

Questo percorso persiste anche se si corregge soltanto l'autenticazione delle Edge Functions: l'attaccante può attendere il cron legittimo.

**Correzione:** controllare ruolo e relazione autorizzata sia in USING sia nel controllo della nuova riga per INSERT/UPDATE. Ricontrollare l'autorizzazione dei destinatari al momento dell'invio e riesaminare le regole già inserite.

## Rischi condizionali e verifiche residue

- **Bacheca pubblica in setup precedenti:** `init_db.sql:178` concede lettura universale. `fix_rls.sql` aggiunge una policy più stretta senza eliminare quella universale: le policy permissive si combinano con OR. Esiste già la correzione `src/database/migration_fix_boardpost_rls.sql:5-9`, che rimuove entrambe le vecchie policy. Verificare che sia applicata; non conteggiato come difetto irrisolto nel codice finale.
- **Abbonamenti:** `SubscriptionGuard.tsx` controlla le date nella UI, mentre le policy di lettura delle assegnazioni controllano soltanto il client. Se la scadenza deve revocare anche l'accesso diretto ai dati, occorre applicarla nel backend. Se il prodotto deve mantenere uno storico leggibile, chiarire invece quali contenuti restano accessibili.
- **Backup:** `backup_db.yml` e `backup_storage.yml` conservano dump e media negli artifact GitHub per 90 giorni. Verificare visibilità del repository, lettori autorizzati degli artifact e retention rispetto ai dati personali trattati. Non è stata verificata una fuga di dati; nessun artifact è stato scaricato.
- **Supply chain CI:** i workflow usano tag mobili delle action e CLI `latest`, con segreti privilegiati nel job. Fissare le action a commit verificati, fissare la versione CLI e ridurre i permessi dei job. È una misura di prevenzione, non evidenza di compromissione.
- **RPC privilegiate:** le funzioni SECURITY DEFINER vanno riesaminate per EXECUTE minimo e search_path esplicito. Le RPC di creazione utenti hanno controlli sul ruolo: il fatto di essere SECURITY DEFINER non dimostra da solo un bypass. Gli helper booleani non sono stati conteggiati come vulnerabilità autonome.
- **Segreti e cache:** `.env` è versionato, ma le variabili attualmente presenti sono URL, chiave Supabase con ruolo `anon` e chiave VAPID pubblica; non è evidenza di esposizione di una service-role key. Non è stata svolta una scansione completa della cronologia Git. Il service worker esaminato precarica asset statici; non è emersa una cache runtime delle risposte private delle API.
- **Header:** `public/_headers` contiene una configurazione nel formato supportato da hosting come Netlify/Cloudflare; la prima riga `/*` è il pattern dei percorsi. L'applicazione effettiva degli header richiede una verifica HTTP sul sito distribuito.

## Conferma dello stato distribuito

Prima di produrre patch SQL, rilevare policy, grants e trigger realmente presenti. Queste query sono di sola lettura; sono fornite come riferimento e **non sono state eseguite**:

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema IN ('public', 'storage')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;

SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('handle_new_user', 'is_admin', 'is_coach_of_client');

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets;
```

In staging, verificare poi con account anonimo, client A/B, coach A/B e admin che siano negati: cambio ruolo, associazione autonoma, lettura di clienti estranei, cancellazione di media altrui, modifica dei campi del programma da client, invii push arbitrari e regole verso clienti estranei. Verificare che i normali flussi autorizzati restino funzionanti e che markup HTML attivo venga neutralizzato senza esecuzione nel browser.

## Ordine delle correzioni

1. F01 e F02: ripristinare i confini di autorizzazione e controllare ruoli/relazioni esistenti.
2. F03 e F04: eliminare l'esecuzione di HTML non fidato e la gestione indiscriminata dei file.
3. F05 e F08: proteggere sia gli endpoint push sia le regole persistite.
4. F06 e F07: ridurre esposizione dei profili e campi modificabili.
5. Confermare le migrazioni applicate, completare l'audit dipendenze e verificare configurazione HTTP/backup.

## Riferimenti tecnici

- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): policy, controllo delle righe e uso di metadata non affidabili per l'autorizzazione.
- [Supabase — Securing Edge Functions](https://supabase.com/docs/guides/functions/auth): autenticazione delle richieste e protezione delle funzioni.

Skill applicata: `supabase:supabase` (checklist di sicurezza Supabase).
