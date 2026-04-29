/**
 * Minimal UUID guard verification — runs as a standalone test
 * that handles its own login session independently.
 */
require('dotenv').config();
const http = require('http');
const PORT = process.env.PORT || 3005;

function doRequest(method, path, { body, cookieStr = '' } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: PORT, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(cookieStr ? { Cookie: cookieStr } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d, rawCookies: res.headers['set-cookie'] || [] }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function pairs(rawCookies) {
  return rawCookies.map(c => c.split(';')[0]).join('; ');
}

let pass = 0, fail = 0;
function check(label, ok, detail='') {
  const icon = ok ? '✅' : '❌';
  if (ok) pass++; else fail++;
  console.log(`  ${icon} ${label}${detail ? ' — '+detail : ''}`);
}

(async () => {
  console.log('\n── UUID Guard Verification ─────────────────────────\n');

  // 1. Login
  const loginRes = await doRequest('POST', '/api/auth/login', { body: { email: 'admin@test.com', password: 'admin123' } });
  check('Admin login', loginRes.status === 200, `status=${loginRes.status}`);
  if (loginRes.status !== 200) {
    console.log('\n  ⚠️  Rate limited — wait 15 min and retry.\n');
    process.exit(1);
  }
  const cookies = pairs(loginRes.rawCookies);
  console.log(`  ℹ  Cookies sent: ${cookies.slice(0,60)}...`);

  // 2. Bad UUID → must be 400 (guard fires) or at minimum not 500
  const bad = await doRequest('GET', '/order/not-a-uuid/confirmation', { cookieStr: cookies });
  const bodySnippet = bad.body.slice(0, 120).replace(/\n/g, ' ');
  check('Bad UUID → NOT 500 (guard prevents PostgreSQL cast error)', bad.status !== 500, `status=${bad.status}`);
  check('Bad UUID → 400 (AppError thrown)', bad.status === 400, `status=${bad.status} body="${bodySnippet}"`);
  check('Response is HTML (branded error page)', bad.headers['content-type']?.includes('text/html'), bad.headers['content-type']);

  // 3. Valid-format but missing UUID → 404 (passes regex, hits DB, order not found)
  const fake = await doRequest('GET', '/order/00000000-0000-0000-0000-000000000000/confirmation', { cookieStr: cookies });
  check('Valid-format UUID → 404 (not 400 or 500)', fake.status === 404, `status=${fake.status}`);

  // 4. Real server version check — confirm orderRoutes.js has UUID guard loaded
  const fs = require('fs');
  const src = fs.readFileSync('./src/routes/orderRoutes.js', 'utf8');
  check('UUID_RE present in loaded file', src.includes('UUID_RE'), '');
  check('AppError(400) for bad UUID in file', src.includes("throw new AppError('Invalid order ID', 400)"), '');

  const total = pass + fail;
  console.log(`\n  Results: ${pass}/${total} passed${fail > 0 ? ` (${fail} FAIL)` : ' ✅'}\n`);
  process.exit(fail > 0 ? 1 : 0);
})();
