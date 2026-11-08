
const https = require('https');

const url = 'https://gkbxiyzmtrxukpoaqdqn.supabase.co/functions/v1/push-scheduler';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in the environment');

const data = JSON.stringify({
    timeOverride: '16:30'
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = https.request(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    let responseBody = '';
    res.on('data', (d) => {
        responseBody += d;
    });

    res.on('end', () => {
        console.log(responseBody);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
