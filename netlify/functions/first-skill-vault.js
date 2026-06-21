// first-skill-vault: proof-of-purchase gate that STREAMS the $17 "the first skill" tripwire files.
//
// Mirrors toolkit-vault.js exactly (same fail-closed contract) but scoped to the $17 tripwire:
//   - verifies a $17 "the first skill" purchase (price OR amount), NOT the toolkit
//   - streams ONLY the 3 starter skills + brain doc + quickstart (a slice of the toolkit)
//
// FAIL-CLOSED: no env var, no Stripe match, file not on allowlist = NO bytes.
//
// ENV REQUIRED (apex site env vars, already set for toolkit-vault):
//   STRIPE_SECRET_KEY    = restricted key with Checkout Sessions READ scope.
//   TOOLKIT_HMAC_SECRET  = signs the email-recovery token (reused; scope differs).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// --- the first-skill purchase fingerprint -------------------------------------------------
const PRICE_FIRST_SKILL = 'price_1TiH2L8nfWJMJe0DDe7ANJdR'; // $17 "the first skill"
const FIRST_SKILL_PRICE_IDS = new Set([PRICE_FIRST_SKILL]);
const FIRST_SKILL_AMOUNTS = new Set([1700]); // $17 one-time

// --- the exact files this vault may serve (the $17 slice — NOT the full 27) ----------------
const ALLOWED_FILES = new Set([
  'skills/ai-builder-website.zip',
  'skills/ai-builder-brand-voice.zip',
  'skills/ai-builder-positioning.zip',
  'brain-doc-template.md',
  'first-skill-quickstart.md'
]);

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_SCOPE = 'first-skill';
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}
function mintToken(secret, ttlMs) {
  const payload = b64url(JSON.stringify({ exp: Date.now() + ttlMs, scope: TOKEN_SCOPE }));
  const sig = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}
function verifyToken(secret, token) {
  if (!secret || typeof token !== 'string' || token.indexOf('.') < 0) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  let data;
  try { data = JSON.parse(b64urlDecode(payload).toString('utf8')); } catch (e) { return false; }
  if (!data || data.scope !== TOKEN_SCOPE || typeof data.exp !== 'number') return false;
  return data.exp > Date.now();
}

function sessionIsFirstSkillPurchase(session) {
  if (!session || session.status !== 'complete') return false;
  if (session.payment_status !== 'paid') return false;
  if (session.mode !== 'payment') return false;
  if (FIRST_SKILL_AMOUNTS.has(session.amount_total)) return true;
  const items = session.line_items && session.line_items.data;
  if (Array.isArray(items)) {
    for (const li of items) {
      const pid = li && li.price && li.price.id;
      if (pid && FIRST_SKILL_PRICE_IDS.has(pid)) return true;
    }
  }
  return false;
}

async function verifySessionId(secret, sessionId) {
  if (!secret || !sessionId || typeof sessionId !== 'string') return false;
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return false;
  try {
    const url = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`;
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + secret } });
    if (!res.ok) return false;
    return sessionIsFirstSkillPurchase(await res.json());
  } catch (e) {
    console.error('[first-skill-vault] verifySessionId threw', String(e).slice(0, 200));
    return false;
  }
}

async function emailHasFirstSkillPurchase(secret, email) {
  if (!secret || !email) return false;
  try {
    const url = 'https://api.stripe.com/v1/checkout/sessions'
      + `?customer_details[email]=${encodeURIComponent(email)}`
      + '&status=complete&limit=20&expand[]=data.line_items';
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + secret } });
    if (!res.ok) return false;
    const data = await res.json();
    return ((data && data.data) || []).some(sessionIsFirstSkillPurchase);
  } catch (e) {
    console.error('[first-skill-vault] emailHasFirstSkillPurchase threw', String(e).slice(0, 200));
    return false;
  }
}

function resolveVaultFile(relFile) {
  const candidates = [
    path.join(process.cwd(), '_vault', relFile),
    path.join(__dirname, '_vault', relFile),
    path.join(__dirname, '..', '..', '_vault', relFile),
    path.join(process.env.LAMBDA_TASK_ROOT || '/var/task', '_vault', relFile)
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch (e) { /* keep trying */ }
  }
  return null;
}

function contentTypeFor(relFile) {
  if (relFile.endsWith('.zip')) return 'application/zip';
  if (relFile.endsWith('.md')) return 'text/markdown; charset=utf-8';
  return 'application/octet-stream';
}

exports.handler = async (event) => {
  const STRIPE = process.env.STRIPE_SECRET_KEY;
  const HMAC = process.env.TOOLKIT_HMAC_SECRET;

  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }
    const email = (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '');
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'invalid_email' }) };
    }
    if (!HMAC) {
      return { statusCode: 503, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'unavailable', message: 'download is temporarily unavailable. DM @closermethod and i will get your files to you right away.' }) };
    }
    const paid = await emailHasFirstSkillPurchase(STRIPE, email);
    if (!paid) {
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, message: 'i could not find a purchase under that email. use the exact email from your receipt, or DM @closermethod.' }) };
    }
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, token: mintToken(HMAC, TOKEN_TTL_MS) }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  }

  const q = event.queryStringParameters || {};
  const file = typeof q.file === 'string' ? q.file : '';

  if (!file || file.indexOf('..') >= 0 || file.indexOf('\\') >= 0 || file.charAt(0) === '/' || !ALLOWED_FILES.has(file)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'bad_file' }) };
  }

  let authorized = false;
  if (q.session_id) authorized = await verifySessionId(STRIPE, q.session_id);
  if (!authorized && q.token) authorized = verifyToken(HMAC, q.token);
  if (!authorized) {
    return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'not_verified', message: 'this download is for buyers only. enter the email from your receipt to unlock, or DM @closermethod.' }) };
  }

  const abs = resolveVaultFile(file);
  if (!abs) {
    console.error('[first-skill-vault] vault file not found on disk:', file);
    return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'not_found' }) };
  }
  let buf;
  try { buf = fs.readFileSync(abs); } catch (e) {
    console.error('[first-skill-vault] read failed', String(e).slice(0, 200));
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'read_failed' }) };
  }
  const downloadName = file.split('/').pop();
  return {
    statusCode: 200,
    headers: {
      'Content-Type': contentTypeFor(file),
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    },
    isBase64Encoded: true,
    body: buf.toString('base64')
  };
};
