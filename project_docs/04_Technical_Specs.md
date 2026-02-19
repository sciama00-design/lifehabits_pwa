# 04 - Specifiche Tecniche

## Struttura del Progetto (File System)

```
/src
  /components
    /layout       # Layout (ClientLayout, CoachLayout, Sidebar, Navbar)
    /shared       # Componenti riutilizzabili (ContentCard, MediaViewer, etc.)
    /editor       # Rich Text Editor (TipTap) e componenti form
  /pages
    /client       # Pagine area cliente (Dashboard, Habits, Videos)
    /coach        # Pagine area coach (Dashboard, Clients, Library, Board)
    Login.tsx     # Autenticazione
  /hooks          # Custom Hooks (useAuth, useClients, useAssignments, etc.)
  /lib            # Configurazioni (supabase.ts, utils.ts)
  /types          # Definizioni TypeScript (database.ts)
  App.tsx         # Routing principale
```

## Schema Database (Deduotto / Supabase)

### Tabelle Principali

*   **profiles**: Utenti del sistema.
    *   `id` (uuid, PK, ref auth.users)
    *   `full_name` (text)
    *   `role` (text: 'coach' | 'client')
    *   `subscription_end` (timestamptz)

*   **library_items**: Archivio contenuti.
    *   `id` (uuid, PK)
    *   `title`, `description`, `link`, `thumbnail_url`
    *   `type` ('video' | 'habit' | 'pdf')
    *   `coach_id` (FK profiles)

*   **plans**: Piani di abbonamento/lavoro.
    *   `id` (uuid, PK)
    *   `name`, `description`
    *   `start_date`, `end_date`
    *   `client_id` (FK profiles)

*   **assignments**: Collegamento tra contenuti e clienti.
    *   `id` (uuid, PK)
    *   `client_id` (FK profiles)
    *   `plan_id` (FK plans, nullable)
    *   `library_item_id` (FK library_items, nullable - se copiato)
    *   `title`, `description`, `type` (copiati o custom)
    *   `completed` (boolean)
    *   `scheduled_date` (date)

*   **board_posts**: Annunci bacheca.
    *   `id` (uuid, PK)
    *   `title`, `content`, `image_url`
    *   `coach_id` (FK profiles)
    *   `target_client_ids` (array of uuids)
    *   `expires_at` (timestamptz)
    *   `created_at` (timestamptz)

## Sicurezza e Accesso

*   **Auth Guard:** `SubscriptionGuard` controlla che il cliente abbia un `subscription_end` valido futuro. Se scaduto, redirect a `/scaduto`.
*   **Role Guard:** `CoachGuard` verifica che `profile.role === 'coach'`.
*   **RLS (Row Level Security):** Supabase applica le policy direttamente sul database per impedire ai clienti di leggere dati non propri.
