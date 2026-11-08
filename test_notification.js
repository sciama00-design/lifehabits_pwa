
import https from 'node:https';

const url = 'https://gkbxiyzmtrxukpoaqdqn.supabase.co/functions/v1/push-scheduler';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in the environment');

const data = JSON.stringify({
    timeOverride: '19:00'
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

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
