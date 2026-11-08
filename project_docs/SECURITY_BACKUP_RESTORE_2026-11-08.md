# Backup e prova di ritorno alla versione precedente — 8 novembre 2026

**Backup acquisito; ripristino e rollback provati su copie isolate. Nessun aggiornamento applicato in produzione.** Il risultato documentato qui supera il precedente limite «abbiamo solo test sintetici e un export parziale». Non sostituisce le prove residue sul servizio push distribuito e sui dispositivi.

## Materiale di recupero

Cartella privata locale: `.security-backups/release-20261108T0056/`, esclusa da Git, directory con permessi 0700 e file privati 0600. Non incollare o pubblicare questi file: contengono dati degli utenti e record di autenticazione, inclusa la configurazione cron con credenziali. Nessuna chiave è stata stampata in chat.

- Snapshot coerente dei dati letto con un singolo SELECT, timestamp **8 novembre 2026, 01:03:42 Europe/Rome**: tutte le **53 tabelle** presenti negli schemi `public`, `auth`, `storage`, più `cron.job`. Include 72 utenti Auth, 104 sessioni, identità, hash password e refresh token. Le definizioni sono state acquisite separatamente prima dei dati; nessuna modifica DDL è stata effettuata sul server durante la raccolta.
- Definizioni di tabelle, colonne generate, vincoli, indici, enum e tipo composto, funzioni, trigger, RLS, grants e ACL degli schemi. Le sequenze sono conservate con valori bigint esatti. L'esportazione dei dati passa come testo JSON dal server, evitando arrotondamenti numerici nel trasporto.
- **87 file media**, **31.440.609 byte**, scaricati tramite sole richieste GET. Verificate dimensioni, ETag MD5 dove applicabile e checksum SHA-256 locali; inventario dei file confrontato con lo snapshot Storage.
- Sorgenti e configurazione delle quattro Edge Functions distribuite: `push-dispatcher` v10, `push-scheduler` v15, `generate-image` v2, `create-athlete` v1. Sono preservati i rispettivi gateway JWT. Nessuna funzione è stata ridistribuita.
- Bundle della storia Git, copia del working tree candidato e build frontend isolate di `main=b976ea7` e del candidato `e549877`.
- Script `rollback-security.sql`, generato dal catalogo reale precedente, senza istruzioni che ripristinino o cancellino righe applicative.

La cartella è stata sigillata in `.security-backups/release-20261108T0056.tar.gz.enc`, con chiave separata `.security-backups/release-20261108T0056.archive.key` e riepilogo `.security-backups/release-20261108T0056.sealed.json`. Archivio di circa **35 MB**, **144 file verificati decifrandolo e confrontando tutti i checksum**. Conservare la chiave separata dall'archivio quando si copia il backup altrove. Non è stata effettuata una copia off-host o un upload: i file restano nel workspace dell'utente.

Questo è il backup logico del perimetro interessato e dei dati Auth/Storage. Non è un'immagine completa della piattaforma: segreti JWT/VAPID del servizio, configurazione SMTP/OAuth, impostazioni Cloudflare, Vault e servizi interni non sono stati esportati o modificati. I segreti e gli endpoint di produzione devono restare quelli attuali per preservare sessioni e URL.

## Ripristino realmente eseguito

Il test usa `postgres:17.11-bookworm` in un contenitore Docker **senza rete, senza porte pubblicate**, con dati temporanei. Non è un secondo progetto Supabase a pagamento e non può inviare richieste alla produzione.

1. Ricostruite le definizioni del backup, incluse Auth e Storage, su un database vuoto.
2. Reimportate tutte le 53 tabelle. Confrontate le impronte delle righe di ogni tabella con lo snapshot: corrispondenza esatta, compresi identità, hash e sessioni. Valori numerici e colonne generate sono preservati.
3. Applicati la preparazione delle ricevute e il candidato completo RLS/trigger.
4. Creata una nuova attività utente **dopo** l'aggiornamento candidato.
5. Eseguito `rollback-security.sql`. Le righe originali e quelle nuove sono rimaste identiche a prima del rollback.
6. Confrontati policy, flag RLS, definizioni/ACL/owner delle funzioni precedenti, trigger, grants e vincolo dei ruoli: corrispondenza con la configurazione precedente. Le ricevute aggiuntive restano intenzionalmente al loro posto, preservando i dati delle consegne.

Durante le prime prove sono emerse dipendenze non coperte dagli export parziali: bigint della sequenza, tipo composto amministrativo, ruoli nelle ACL e privilegi dello schema Auth necessari ai vincoli. Sono state incluse e il ciclo completo è poi passato. Le prove inizialmente fallite non sono contate come successi.

Evidenza privata: `restore-test-result.json`. Gli script `schema.sql` e `data.sql` sono **esclusivamente per un database vuoto e isolato**; non sono il rollback da eseguire sulla produzione.

## Login e sessioni HTTP attraverso aggiornamento e rollback

È stato avviato anche il servizio Auth ufficiale **`supabase/gotrue:v2.197.0`**, nella stessa rete isolata e con un segreto JWT casuale di test. La versione coincide con quella letta tramite il health pubblico dell'Auth di produzione. Non sono state usate password di utenti reali, cambiati segreti di produzione o inviate email.

Con account sintetici client, coach e admin sono passati, prima del candidato, dopo il candidato e dopo il rollback:

- login via `/token?grant_type=password`;
- accesso `/user` con una sessione già aperta;
- rinnovo via refresh token, senza cambiare identità;
- creazione client tramite RPC del coach e successivo login;
- creazione coach tramite RPC dell'admin, conferma del ruolo autorevole e successivo login.

Evidenza privata: `auth-test-result.json`. La continuità HTTP è stata provata nel servizio isolato della stessa versione; non si è effettuato un login negli account reali.

## Flussi applicativi e notifiche

- **573 verifiche di lettura mirate sui 71 profili originali**, usando le relazioni effettive dello snapshot e il ruolo PostgreSQL `authenticated`. Profili/directory, piani, assegnazioni, appuntamenti, bacheca, regole, sottoscrizioni, preferenze e libreria per i ruoli pertinenti mantengono le righe legittime prima accessibili. Dopo rollback i risultati coincidono con il punto di partenza. Non sono confrontate come «legittime» le letture universali che il candidato intende rimuovere.
- Le 110 righe di piani e le 391 assegnazioni nello snapshot hanno tutte un legame primario o di collaborazione valido con il coach indicato. Non sono stati dedotti o modificati consensi storici.
- Quattro transazioni PostgreSQL realmente concorrenti sulla ricevuta di uno stesso dispositivo: una sola acquisizione del lease.
- `npm run test:security` rieseguito: 102 controlli SQL standard, test HTML/editor, cinque test policy e quindici test handler/protocollo/SW, senza `todo` o test saltati nella suite push. Resta valida anche la verifica precedente dei 104 controlli sulla fixture delle 70 policy live.
- Build rieseguita con successo. Lint globale ancora non superato; non è un controllo dichiarato verde.
- Ripetuta la prova Chromium di aggiornamento PWA sullo stesso origin: pagina aperta e campo non salvato conservati, local storage preservato, avvio offline da `/` riuscito. Il deep link `/login` offline fallisce in entrambe le versioni: limite preesistente, non dichiarato risolto.

Le letture SQL mirate non sostituiscono ogni interazione nel browser o il caricamento effettivo di PDF/video su ciascun dispositivo. Il caricamento tramite Storage API non è stato provato con upload reali; la copia dei file e le regole SQL sono verificati separatamente.

## Come tornare indietro durante un eventuale rilascio

Il rollback ordinario deve **conservare le nuove attività degli utenti**, come nella prova eseguita. Ripristinare un vecchio dump dei dati sull'app attiva farebbe perdere quelle attività e non è la procedura prevista.

1. **Frontend:** tornare al deployment Cloudflare precedente o ripubblicare l'artefatto main conservato. Prima del rilascio va identificato il deployment effettivo recuperabile. Git main è ancora `b976ea7`; nessun merge/push è stato effettuato.
2. **Edge Functions:** ridistribuire i file precedenti da `edge-push-dispatcher.json` e `edge-push-scheduler.json`, mantenendo dispatcher JWT false e scheduler JWT true, senza toccare segreti, cron o chiavi. La piattaforma assegnerà una nuova versione di deployment, ma codice e configurazione ritornano a quelli conservati.
3. **RLS/trigger:** sul progetto originale, dopo confronto con lo snapshot e con il rilascio effettivamente eseguito, applicare `rollback-security.sql` in transazione. Usa lock timeout di 2 secondi e statement timeout di 30 secondi; se non riesce, abortisce. Nessun `CASCADE`, ripristino dei dati storici o reset del database. Non rimuovere la tabella ricevute come parte del rollback ordinario.
4. Verificare nuovamente login/sessioni, operazioni normali e risposte HTTP del cron. Il ritorno alle policy precedenti riapre i relativi problemi di sicurezza: è una misura di emergenza da seguire con una correzione compatibile.

Gli script per ripetere le prove rifiutano contenitori che non abbiano il nome di test previsto e la rete disabilitata:

```sh
python3 scripts/prepare-release-restore.py .security-backups/release-20261108T0056
python3 scripts/test-release-restore.py .security-backups/release-20261108T0056 lifehabits-restore-20261108-0056
# Auth richiede il servizio isolato e la configurazione locale descritta sopra.
python3 scripts/test-release-auth.py .security-backups/release-20261108T0056 lifehabits-restore-20261108-0056
python3 scripts/test-release-flows.py .security-backups/release-20261108T0056 lifehabits-restore-20261108-0056
```

Il test di ripristino resetta **solo** il database dedicato nel contenitore isolato. Non eseguirlo mentre Auth usa quella copia: fermare prima il servizio Auth di test e riavviarlo solo dopo il ripristino.

Per ricreare il servizio Auth di prova, usare un contenitore `postgres:17.11-bookworm` con rete `none`, nessuna porta pubblicata e PGDATA temporaneo, come richiesto dal controllo degli script. Dopo il ripristino, configurare **solo su quella copia** il ruolo Auth con `LOGIN`, `search_path=auth,public,extensions` e i grants sulla sequenza Auth. Quindi avviare `supabase/gotrue:v2.197.0` con il file privato `auth-test.env` e `--network container:lifehabits-restore-20261108-0056`. Il segreto casuale nel file è esclusivamente di test. I contenitori originali della prova sono stati rimossi dopo aver conservato i risultati e sigillato il backup; le immagini restano disponibili localmente.

## Cosa impedisce ancora di dichiarare pronto il rilascio completo

**Aggiornamento della prova PC:** dopo l'uscita da DevTools, è rimasto un solo endpoint Windows. Secondo invio diretto autorizzato `LH-20261108-010446`: HTTP 200, ricezione sul PC non confermata e poi esplicitamente negata dall'utente. Nessun candidato distribuito. Il difetto di ricezione desktop resta quindi da diagnosticare; un HTTP 200 del dispatcher v10, che assorbe errori di invio, non prova la consegna.

**Correzione successiva nel working tree:** il comando `repairNotifications`, usato dalle impostazioni e dal modal di aggiornamento notifiche, cancellava per `user_id` tutte le registrazioni, comprese quelle degli altri dispositivi. Il test sul vero hook ha riprodotto la perdita con endpoint locale presente e assente. Ora la query richiede anche l'endpoint locale; senza endpoint non esegue cancellazioni. I due test sono passati e sono inclusi in `test:push`; build superata. Non è dimostrato che questa specifica operazione abbia causato la scomparsa osservata della registrazione del telefono. Nessun ripristino globale, cancellazione manuale o nuovo invio aggiuntivo è stato effettuato. La modifica locale non è contenuta nel precedente commit di preview o nell'archivio cifrato immutabile: prima di pubblicarla vanno aggiornati il candidato di rilascio e i relativi artefatti. Il backup della versione originale e il rollback SQL già provato rimangono disponibili.

**Prova push successiva, 8 novembre ore 02:00 Europe/Rome:** inviata una sola richiesta `direct` all'account dedicato autorizzato, dopo aver osservato due sottoscrizioni distinte e preferenze abilitate. Dispatcher distribuito v10, HTTP 200, codice `LH-20261108-010022`. L'utente conferma la ricezione su uno solo dei due ambienti e precisa che il secondo era un PC in emulazione mobile tramite strumenti sviluppatore. Risultato: una ricezione confermata, seconda ricezione non confermata; non è provato che l'emulazione abbia causato il problema. L'etichetta Android deriva dallo user agent e non certifica due telefoni fisici. Il candidato non era distribuito, quindi questa è una prova del percorso attuale, non della nuova implementazione. Nessun broadcast o invio ad altri account. Nessun ulteriore invio automatico: lo script rifiuta la ripetizione dello stesso test già tentato. Evidenza privata separata dall'archivio immutabile: `.security-backups/push-test-result-20261108.json`.

1. **Cron candidato:** gli HTTP 200 confermano lo scheduler attuale; resta da provare l'uguaglianza della credenziale del job alla chiave server confrontata dal candidato. Non è stata letta o stampata la chiave di ambiente delle Edge Functions e non si deduce l'uguaglianza dal solo ruolo decodificato.
2. **Push su dispositivi:** account dedicato definito e prova iniziale eseguita, con una ricezione confermata come sopra. Per confermare il secondo dispositivo occorre una prova in un ambiente rappresentativo, senza broadcast o notifiche ad altri account; non si considera superato il requisito sui due dispositivi.
3. **Ripristino sul hosting effettivo:** da questo ambiente, sia il dominio Cloudflare principale dedotto dalla preview sia la preview nota rispondono HTTP 403. Non si conclude che il sito sia indisponibile per gli utenti; non è stato possibile copiare/verificare gli asset pubblicati o identificare il deployment Cloudflare da ripristinare. Le build archiviate sono ricostruzioni dai commit, non una copia certificata dell'attuale deployment.

Non sono state create nuove funzioni diagnostiche sulla produzione, applicate migrazioni o cambiate impostazioni Auth. I problemi di sicurezza live non sono dichiarati chiusi. Prima del rollout backend va anche gestito il passaggio delle date UTC/Roma fuori dalla fascia di mezzanotte, come nel rapporto di verifica precedente.

Riferimenti per il recupero Supabase: [backup e ripristino](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [ripristino verso istanza isolata](https://supabase.com/docs/guides/self-hosting/restore-from-platform). I file Storage e le impostazioni esterne richiedono trattamento separato dal database, come previsto anche dalla documentazione ufficiale.
