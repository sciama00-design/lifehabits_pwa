
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Read .env manually
const envPath = path.resolve(projectRoot, '.env');
console.log('Reading .env from:', envPath);
let env: Record<string, string> = {};

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    console.log('File content length:', envContent.length);
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([^=]+?)\s*=\s*(.*)?\s*$/);
        if (match) {
            env[match[1]] = match[2];
        }
    });
    console.log('Loaded keys:', Object.keys(env));
} else {
    console.error('.env file not found at:', envPath);
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const targetEmail = 'cacciamani.matteo@outlook.com';

async function main() {
    console.log(`Looking up user: ${targetEmail}`);

    // Try to find user in profiles
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', targetEmail)
        .single();

    if (profileError) {
        console.error('Error finding user in profiles:', profileError.message);
        // Fallback: Check if we can find them in push_subscriptions directly?
        // No, push_subscriptions uses user_id, doesn't have email.
        process.exit(1);
    }

    if (!profiles) {
        console.error('User not found in profiles.');
        process.exit(1);
    }

    const userId = profiles.id;
    console.log(`Found user ID: ${userId}`);

    console.log('Sending test notification...');
    const { data, error } = await supabase.functions.invoke('push-dispatcher', {
        body: {
            type: 'direct',
            user_id: userId,
            title: 'Test Debug 🕵️‍♂️',
            body: 'Questo è un test dal sistema di debug.',
            url: '/profile' // Test URL
        }
    });

    if (error) {
        console.error('Function invocation failed:', error);
    } else {
        console.log('Function response:', data);
    }
}

main().catch(console.error);
