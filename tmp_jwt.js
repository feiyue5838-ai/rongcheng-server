const t = process.argv[1];
const [h, p] = t.split('.');
const b64 = p.replace(/-/g, '+').replace(/_/g, '/');
const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
const buf = Buffer.from(pad, 'base64');
console.log('payload:', buf.toString('utf8'));
