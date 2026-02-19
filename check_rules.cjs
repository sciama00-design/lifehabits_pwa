
const { createClient } = require('@supabase/supabase-js');

const url = 'https://gkbxiyzmtrxukpoaqdqn.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrYnhpeXptdHJ4dWtwb2FxZHFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDY1NzcsImV4cCI6MjA4NjM4MjU3N30.BTN5qqCkDC4VkEt7LZWmDC3GQLCq30eXuuoYrKuJlWs';

const supabase = createClient(url, anonKey);

async function checkRules() {
    const { data, error } = await supabase
        .from('notification_rules')
        .select('*')
        .eq('scheduled_time', '19:00');

    if (error) {
        console.error('Error fetching rules:', error);
    } else {
        console.log('Rules found:', data);
    }
}

checkRules();
