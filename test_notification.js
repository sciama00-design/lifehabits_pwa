
const https = require('https');

const url = 'https://gkbxiyzmtrxukpoaqdqn.supabase.co/functions/v1/push-scheduler';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrYnhpeXptdHJ4dWtwb2FxZHFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDY1NzcsImV4cCI6MjA4NjM4MjU3N30.BTN5qqCkDC4VkEt7LZWmDC3GQLCq30eXuuoYrKuJlWs';

const data = JSON.stringify({
    timeOverride: '19:00'
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': data.length
    }
};

const req = https.request(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
