/**
 * 🔴 DISASTER RECOVERY — Restore Auth Users
 *
 * Importa gli utenti da un backup JSON (auth_users_*.json) in un
 * nuovo progetto Supabase, inviando a ciascuno un link di recupero password.
 *
 * USO:
 *   node scripts/restore_auth_users.mjs \
 *     --url https://<NUOVO_REF>.supabase.co \
 *     --service-role-key <SERVICE_ROLE_KEY> \
 *     --backup ./auth_users_20240101_020000.json
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// ── Leggi argomenti da CLI ─────────────────────────────────────────────────
const args = process.argv.slice(2)
const get = (flag) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : null
}

const SUPABASE_URL = get('--url')
const SERVICE_ROLE_KEY = get('--service-role-key')
const BACKUP_FILE = get('--backup')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !BACKUP_FILE) {
    console.error(`
❌ Argomenti mancanti. Uso:
   node scripts/restore_auth_users.mjs \\
     --url https://<REF>.supabase.co \\
     --service-role-key <KEY> \\
     --backup ./auth_users_YYYYMMDD.json
`)
    process.exit(1)
}

// ── Inizializza client con service_role ────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
})

// ── Leggi backup ───────────────────────────────────────────────────────────
const backup = JSON.parse(readFileSync(BACKUP_FILE, 'utf-8'))
const users = backup.users ?? []

console.log(`\n📋 Utenti nel backup: ${users.length}`)
console.log('─'.repeat(50))

let created = 0
let skipped = 0
let failed = 0

for (const user of users) {
    const email = user.email

    if (!email) {
        console.warn(`⚠️  Utente senza email (id: ${user.id}) — saltato`)
        skipped++
        continue
    }

    // Crea l'utente nel nuovo progetto
    const { data, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true, // già confermato nel vecchio progetto
        user_metadata: user.user_metadata ?? {},
        app_metadata: user.app_metadata ?? {},
    })

    if (error) {
        if (error.message?.includes('already been registered')) {
            console.log(`⏭️  ${email} — già esistente, skip`)
            skipped++
        } else {
            console.error(`❌ ${email} — ${error.message}`)
            failed++
        }
        continue
    }

    created++
    console.log(`✅ ${email} — creato (id: ${data.user.id})`)

    // Invia email di recovery (imposta nuova password)
    const { error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
    })

    if (linkError) {
        console.warn(`   ⚠️  Email recovery non inviata: ${linkError.message}`)
    } else {
        console.log(`   📧 Email di reset password inviata`)
    }
}

console.log('\n' + '─'.repeat(50))
console.log(`📊 Riepilogo:`)
console.log(`   ✅ Creati:   ${created}`)
console.log(`   ⏭️  Saltati:  ${skipped}`)
console.log(`   ❌ Falliti:  ${failed}`)
console.log()

if (failed > 0) {
    console.warn('⚠️  Alcuni utenti non sono stati importati. Controlla gli errori sopra.')
    process.exit(1)
} else {
    console.log('🎉 Recovery auth completato!')
}
