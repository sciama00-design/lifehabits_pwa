/**
 * 🔴 DISASTER RECOVERY — Restore Storage
 *
 * Ricarica tutti i file da un backup locale (cartella media_backup/)
 * nel bucket `media` di un nuovo progetto Supabase.
 *
 * USO:
 *   node scripts/restore_storage.mjs \
 *     --url https://<NUOVO_REF>.supabase.co \
 *     --service-role-key <SERVICE_ROLE_KEY> \
 *     --backup-dir ./media_backup
 *
 * PRE-REQUISITI:
 *   - Estrarre lo zip dello storage backup in ./media_backup
 *   - Creare il bucket `media` nel nuovo progetto Supabase (Storage → New bucket)
 */

import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { lookup as mimeLookup } from 'mime-types'

// ── Leggi argomenti da CLI ─────────────────────────────────────────────────
const args = process.argv.slice(2)
const get = (flag) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : null
}

const SUPABASE_URL = get('--url')
const SERVICE_ROLE_KEY = get('--service-role-key')
const BACKUP_DIR = get('--backup-dir') ?? './media_backup'
const BUCKET = 'media'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(`
❌ Argomenti mancanti. Uso:
   node scripts/restore_storage.mjs \\
     --url https://<REF>.supabase.co \\
     --service-role-key <KEY> \\
     --backup-dir ./media_backup
`)
    process.exit(1)
}

// ── Inizializza client ─────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
})

// ── Raccogli tutti i file ricorsivamente ───────────────────────────────────
function collectFiles(dir) {
    const files = []
    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry)
        if (statSync(fullPath).isDirectory()) {
            files.push(...collectFiles(fullPath))
        } else {
            files.push(fullPath)
        }
    }
    return files
}

const allFiles = collectFiles(BACKUP_DIR)
console.log(`\n📁 File trovati nel backup: ${allFiles.length}`)
console.log(`🪣 Target bucket: ${BUCKET} su ${SUPABASE_URL}`)
console.log('─'.repeat(60))

let uploaded = 0
let skipped = 0
let failed = 0

for (const filePath of allFiles) {
    // Percorso relativo rispetto alla cartella backup → diventa il path nel bucket
    const remotePath = relative(BACKUP_DIR, filePath).replace(/\\/g, '/')
    const contentType = mimeLookup(filePath) || 'application/octet-stream'
    const buffer = readFileSync(filePath)

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(remotePath, buffer, {
            contentType,
            upsert: true, // sovrascrive se esiste già
        })

    if (error) {
        console.error(`❌ ${remotePath} — ${error.message}`)
        failed++
    } else {
        console.log(`✅ ${remotePath} (${contentType})`)
        uploaded++
    }
}

console.log('\n' + '─'.repeat(60))
console.log(`📊 Riepilogo:`)
console.log(`   ✅ Caricati:  ${uploaded}`)
console.log(`   ⏭️  Saltati:   ${skipped}`)
console.log(`   ❌ Falliti:   ${failed}`)
console.log()

if (failed > 0) {
    console.warn('⚠️  Alcuni file non sono stati caricati. Controlla gli errori sopra.')
    process.exit(1)
} else {
    console.log('🎉 Recovery storage completato!')
}
