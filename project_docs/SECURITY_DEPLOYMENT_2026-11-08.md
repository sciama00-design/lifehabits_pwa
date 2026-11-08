# Rilascio sicurezza — 8 novembre 2026

**Rilascio applicativo completato: Supabase e frontend pubblicati e verificati.** L'utente ha autorizzato esplicitamente il deploy e ha deciso che la mancata ricezione sul PC non costituisce un blocco. Nessun invito/reset password, logout, rotazione JWT/VAPID, cambio dominio o ripristino globale delle sottoscrizioni.

## Stato Supabase effettivo

Progetto: `gkbxiyzmtrxukpoaqdqn`.

| Componente | Stato |
| --- | --- |
| Migrazione ricevute | Applicata, versione remota `20261108011636`, nome `prepare_push_delivery` |
| Migrazione RLS/trigger | Applicata, versione remota `20261108012402`, nome `application_security_hardening` |
| `push-scheduler` | Versione **18 ACTIVE**, gateway JWT **true** |
| `push-dispatcher` | Versione **11 ACTIVE**, gateway JWT **false**, autenticazione/autorizzazione applicativa attiva |
| Cron esistente | Nome, frequenza, corpo e credenziale conservati; nuove risposte HTTP 200 osservate |

I file delle migrazioni sono stati creati tramite CLI Supabase v3 in un contenitore senza rete; i nomi/versioni locali sono stati poi allineati alle versioni effettivamente registrate da `apply_migration`. Il corpo SQL è quello provato nella copia PostgreSQL e nel ciclo di rollback. Le vecchie migrazioni storiche del repository non sono state rieseguite: non eseguire un `db push` generale per questo rilascio senza prima riconciliare la storia precedente, costruita anche con SQL manuale. `npm run build` non applica SQL o funzioni.

## Verifiche reali dopo il rilascio

- Ricevute e log interni: RLS attiva; anon/authenticated senza SELECT; service_role conserva INSERT. Una ricevuta diagnostica univoca è stata creata e rimossa via API, senza invii.
- La policy universale `allow_all_read_test` sui piani non esiste più.
- API anonima: zero profili e zero piani leggibili; dispatcher con credenziale anonima restituisce **401**, anche con gateway disabilitato come prima.
- Un file media pubblico già presente coincide per SHA-256 con il backup: accesso pubblico conservato.
- Controlli SQL read-only con ruolo `authenticated` e contesto JWT di client/coach/admin: profilo personale sempre leggibile; piani, assegnazioni e relazioni visibili secondo i confini previsti. Il client dedicato legge il proprio profilo e i propri dati; il coach i clienti gestiti; l'admin conserva la visibilità globale. Nessuna sessione utente è stata usata o modificata per questi controlli.
- Cron nuovo: HTTP **200** e risposta `No rules in this window` alle **02:23, 02:24 e 02:25 Europe/Rome**; questi riscontri identificano il nuovo codice. Non c'erano regole dovute durante il passaggio; gli orari UTC/Roma della finestra coincidevano nella data, verificato prima del rollout.
- Advisor: eliminati i due ERROR di RLS disabilitata sui log. Restano avvisi documentati su search_path/RPC e password compromesse. L'INFO sulla tabella ricevute senza policy è coerente con accesso esclusivo service_role/BYPASSRLS e grants ordinari revocati. Non si presenta l'intero elenco advisor come risolto.

## Incompatibilità cron trovata e risolta durante il rollout

Il primo scheduler candidato, versione 16, confrontava il bearer del cron con la sola chiave configurata nell'ambiente. Il cron reale ha restituito **401 alle 02:18**. È stato ripristinato immediatamente il codice precedente come versione 17; alle 02:19 e 02:20 le risposte erano nuovamente 200. La finestra era stata controllata senza regole dovute. Non è stato cambiato il cron e non sono stati registrati log di consegna dal codice rifiutato.

La versione 18 conserva il percorso rapido per la chiave configurata e accetta anche JWT `service_role` emessi separatamente, **dopo verifica del progetto**:

- il ruolo decodificato è soltanto un filtro, mai una prova di autenticità;
- la Data API verifica firma/scadenza e autorizza una richiesta **HEAD di zero righe** alla tabella privata delle ricevute;
- viene usata la chiave pubblica `anon` come apikey, con il JWT del chiamante in Authorization, così la chiave server non può sovrascrivere il ruolo del chiamante;
- accesso riuscito richiesto; errori, chiave pubblica assente e timeout negano l'accesso;
- richieste utente ordinarie continuano a usare `auth.getUser`, senza questo passaggio supplementare.

Prova sul progetto: credenziale cron **200**, chiave anonima **401**, JWT service contraffatto **401**. Nuovi test unitari coprono la compatibilità e la negazione delle firme false; il cron regolare ha poi confermato il risultato nel runtime Edge.

Un tentativo precedente di aggiungere temporaneamente un ramo preflight allo scheduler originale è stato **respinto dall'approvazione automatica** per il rischio di una superficie aggiuntiva di probing delle credenziali. Non è stato distribuito o riproposto attraverso un altro canale. Il rilascio successivo usa esclusivamente il codice funzionale definitivo e osserva il normale cron; non contiene quell'endpoint/ramo diagnostico.

## Pacchetto frontend e continuità

Il commit frontend `e549877` resta nella storia senza riscritture. Il commit applicativo `b92ffd9327df288ebd64dfbf11f3bf02adc99695` include la correzione di `repairNotifications`: il ripristino manuale elimina solo l'endpoint del dispositivo corrente; con endpoint locale assente non cancella registrazioni di altri dispositivi. Il test del vero hook ha fallito prima della correzione e ora passa in entrambi i casi.

Le prove precedenti restano nei [risultati di backup/ripristino](SECURITY_BACKUP_RESTORE_2026-11-08.md): 53 tabelle ripristinate, 87 media verificati, login/refresh/provisioning nella stessa versione Auth di produzione prima/dopo candidato e rollback, 573 letture mirate sul roster, aggiornamento PWA sullo stesso origin senza perdita del campo non salvato.

Rieseguiti suite sicurezza e build. La suite push aggiornata contiene sette test di policy/autenticazione, quindici test handler/protocollo/SW e due test del ripristino dispositivo. Il lint globale mantiene problemi preesistenti e non è dichiarato superato.

L'accesso GitHub è stato autorizzato tramite il flusso ufficiale GitHub CLI. Il commit applicativo **`b92ffd9327df288ebd64dfbf11f3bf02adc99695`** è stato pubblicato su `main` con push ordinario, dal precedente `b976ea7`, senza riscritture. Il check Cloudflare Pages è **success/completed**, deployment **`9aa2ecdf-d7bd-424d-8c42-8a6cec99d623`**, [dettagli Cloudflare](https://dash.cloudflare.com/?to=/db5defef9735c9a338f38e9f496b496b/pages/view/lifehabits-pwa/9aa2ecdf-d7bd-424d-8c42-8a6cec99d623).

Controlli HTTP dopo il deploy su `https://lifehabits-pwa.pages.dev`: `/`, `/login`, `/sw.js`, `/manifest.webmanifest`, entry JavaScript, CSS e registrazione SW tutti **200**. JavaScript, CSS e registrazione SW coincidono **byte per byte** con la build locale verificata. JavaScript pubblicato: `/assets/index-CLuzHoh5.js`, SHA-256 `b145af9db7688623da55bbe15f42d1669acfa4504fb1fd48d015ff201fe0cd63`. Evidenza privata: `.security-backups/frontend-production-b92ffd9.json`. Le risposte 403 osservate prima e con alcuni client HTTP non sono state interpretate come indisponibilità degli utenti: il controllo effettivo con curl sul dominio è riuscito.

Smoke test Chromium sulla pagina `/login` di produzione con profilo nuovo: campi email e password renderizzati, **zero eccezioni JavaScript non gestite**. Nessun login reale o invio push eseguito. Il passaggio PWA con sessione/stato persistente resta coperto dalle prove sullo stesso origin in ambiente isolato, senza attribuire a questo smoke test anonimo una verifica delle sessioni reali.

Controllo Supabase ripetuto alle **02:43 Europe/Rome**: scheduler v18 e dispatcher v11 ACTIVE; ultimi otto cicli cron, dalle 02:36 alle 02:43, HTTP **200**, nessun timeout o errore. Non sono state eseguite altre migrazioni, rotazioni o notifiche di prova.

Il successivo commit di chiusura aggiorna soltanto questi documenti, senza modificare gli asset applicativi.

## Recupero e rischi residui

Archivio privato cifrato e verificato: `.security-backups/release-20261108T0056.tar.gz.enc`; chiave separata e istruzioni nel rapporto di backup. Il rollback SQL ripristina configurazione e permessi mantenendo le attività nuove. Per le funzioni sono conservati i sorgenti pre-deploy e i gateway. Il codice frontend precedente è conservato nel bundle Git e negli artefatti; il precedente deployment Cloudflare **`4a5a2c87-1d58-4f71-a665-3f1dd968f3ae`**, commit `b976ea709dc01cfe2103a2c94e535744fe0908ec`, è stato identificato tramite il check storico Cloudflare riuscito. Riferimento: [deployment precedente](https://dash.cloudflare.com/?to=/db5defef9735c9a338f38e9f496b496b/pages/view/lifehabits-pwa/4a5a2c87-1d58-4f71-a665-3f1dd968f3ae). Il rollback immediato del deployment richiede l'accesso Cloudflare; in alternativa l'accesso GitHub ora verificato consente un normale commit di ripristino del frontend con rebuild. Non è stato eseguito un rollback sulla produzione sana soltanto per provarlo.

Le ricevute aggiuntive vanno conservate durante un rollback ordinario. Tornare alle vecchie policy/funzioni riapre le rispettive vulnerabilità: usarlo solo come recupero di emergenza. Non ripristinare il dump dei dati sopra la produzione attiva.

Rimangono fuori da questa chiusura: password iniziale condivisa e futura transizione, bucket pubblico/condivisione tra coach mantenuti per compatibilità, verifica del consenso storico alle collaborazioni, rate limiting generale e le dipendenze/advisory residui già documentati. La consegna sul PC è stata esplicitamente accettata come problema separato dall'utente; il telefono ha ricevuto il test prima del rilascio. Non sono stati inviati broadcast o ulteriori push durante il deploy.
