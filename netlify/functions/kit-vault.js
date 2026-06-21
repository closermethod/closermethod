// kit-vault: proof-of-purchase gate that STREAMS the closer-kit-launch paid products
// (the UGC Closer Kit suite + the retainer skill bundle).
//
// WHY THIS EXISTS:
//   The 2 paid zips used to sit at raw public urls on closer-kit-launch
//   (closer-kit-launch.netlify.app/downloads/ugc-deal-skills.zip + /downloads/retainer-skill.zip)
//   hardcoded into the buyer thanks pages (thanks-pro / thanks-dfy / thanks-retainer). Anyone with
//   the link downloaded the $397 UGC suite (and the retainer bundle) for free. This function moves
//   those files behind a wall: the bytes live in apex _vault/ (force-404'd from public serving +
//   bundled into apex functions via netlify.toml included_files), and you only get them after
//   proving you paid. Same proven pattern + same secrets as toolkit-vault (sibling function),
//   but a SEPARATE allowlist + purchase fingerprint so the two product lines stay isolated.
//
// THREE WAYS TO PROVE PURCHASE (any one is enough):
//   1. session_id -> the closer-kit-launch Stripe Checkout Session id the thanks page already
//                    reads from ?session_id=. Same Stripe account as apex, so this key verifies it.
//   2. token      -> a short-lived HMAC token (scope:'kit') minted by the POST email-recovery path
//                    for buyers who arrive without a session_id (email-link / returning buyers).
//   3. (no anonymous path) -> every download requires 1 or 2. FAIL CLOSED.
//
// FAIL-CLOSED CONTRACT: missing STRIPE_SECRET_KEY / TOOLKIT_HMAC_SECRET, not-paid, wrong product,
//   or file not on the allowlist = NO bytes. Security beats convenience on purpose.
//
// ENV REQUIRED (apex site, already set for toolkit-vault; values never written to disk):
//   STRIPE_SECRET_KEY   = restricted key with Checkout Sessions READ scope.
//   TOOLKIT_HMAC_SECRET = strong random string; signs the recovery tokens (shared with toolkit-vault).
//
// PII RULE: email is accepted by POST ONLY, never read from a GET query string.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// --- closer-kit-launch purchase fingerprint (amount ladder, from stripe-webhook PRODUCT_MAP) ----
// Any completed one-time payment at one of these amounts means "bought a closer-kit product".
// mode must be 'payment' so a subscription can never match.
//   147 Founding · 197 Founding · 247 Founding/UCK · 297 Pro · 397 Pro/bundle · 497 Pro
//   797 DFY · 997 DFY · 1497 DFY
const KIT_AMOUNTS = new Set([4700, 14700, 19700, 24700, 29700, 39700, 49700, 79700, 99700, 149700]);

// Discount-proof gate: a promo code can push amount_total OFF the ladder above, but the
// line-item price id is constant. These are the exact price ids of the products this vault
// delivers (verified live from Stripe payment links 2026-06-09, not memory). Any session whose
// line items include one of these is a real buyer regardless of any coupon applied.
const KIT_PRICE_IDS = new Set([
  'price_1Tg8s98nfWJMJe0DPmyqhQx9', // UGC suite        ($397, access/ugc)
  'price_1TXTwH8nfWJMJe0DzV7rTWoL', // Toolkit Pro      ($397, access-pro -> thanks-pro)
  'price_1TXT7N8nfWJMJe0DeLZ3AYhf', // Toolkit DFY      ($997, access-dfy -> thanks-dfy)
  'price_1TX5TJ8nfWJMJe0Dvljksvsf', // Founding/retainer($197, thanks-retainer)
  'price_1TX5Ct8nfWJMJe0DnPg537mV', // UGC Closer Kit   ($247, thanks-uck)
  'price_1TX7U28nfWJMJe0DKNqzNhhn', // Toolkit bundle   ($397, thanks-bundle)
  'price_1TWENo8nfWJMJe0DWoznpFBR', // Stack Installer  ($297, stack thank-you)
  'price_1ThHds8nfWJMJe0DX43cU7cI'  // Follow-Up Desk   ($47, access/follow-up-desk · added 2026-06-12)
]);

// --- the paid files this vault is allowed to serve (exact allowlist) -----------------------------
// Covers the closer-kit-launch products (UGC suite + retainer) AND the $297 Stack Installer
// product (closermethod-skills.zip), all gated by the same Stripe ladder.
const ALLOWED_FILES = new Set([
  'ugc-deal-skills.zip',
  'retainer-skill.zip',
  'closermethod-skills.zip',
  'follow-up-desk.zip'
]);

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // recovery token valid 7 days
const TOKEN_SCOPE = 'kit';
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

// The buyer thanks pages live on closer-kit-launch.netlify.app, so the POST email-recovery
// fetch is cross-origin. Reflect only known origins; everything else gets no CORS grant.
const ALLOWED_ORIGINS = new Set([
  'https://closer-kit-launch.netlify.app',
  'https://closermethod-stack-installer.netlify.app',
  'https://closermethod.com',
  'https://www.closermethod.com'
]);
function corsHeaders(event) {
  const origin = (event && event.headers && (event.headers.origin || event.headers.Origin)) || '';
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

// ----------------------------------------------------------------------------------------
// HMAC token: "<base64url(payload)>.<base64url(sig)>"  payload = {exp, scope:'kit'}
// ----------------------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------------------
// Stripe verification (via fetch, no SDK). Returns true ONLY on a real, completed, paid,
// one-time closer-kit purchase. Any error / missing key returns false.
// ----------------------------------------------------------------------------------------
function sessionIsKitPurchase(session) {
  if (!session || session.status !== 'complete') return false;
  if (session.payment_status !== 'paid') return false;
  if (session.mode !== 'payment') return false; // never a subscription
  if (KIT_AMOUNTS.has(session.amount_total)) return true;
  // discount-proof fallback: a coupon can move amount_total off the ladder, but the
  // line-item price id does not change. accept if a known kit product was purchased.
  const items = session.line_items && session.line_items.data;
  if (Array.isArray(items)) {
    for (const li of items) {
      const pid = li && li.price && li.price.id;
      if (pid && KIT_PRICE_IDS.has(pid)) return true;
    }
  }
  return false;
}

async function verifySessionId(secret, sessionId) {
  if (!secret || !sessionId || typeof sessionId !== 'string') return false;
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return false; // shape guard
  try {
    const url = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`;
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + secret } });
    if (!res.ok) return false;
    const session = await res.json();
    return sessionIsKitPurchase(session);
  } catch (e) {
    console.error('[kit-vault] verifySessionId threw', String(e).slice(0, 200));
    return false;
  }
}

async function emailHasKitPurchase(secret, email) {
  if (!secret || !email) return false;
  try {
    const url = 'https://api.stripe.com/v1/checkout/sessions'
      + `?customer_details[email]=${encodeURIComponent(email)}`
      + '&status=complete&limit=20&expand[]=data.line_items';
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + secret } });
    if (!res.ok) return false;
    const data = await res.json();
    const sessions = (data && data.data) || [];
    return sessions.some(sessionIsKitPurchase);
  } catch (e) {
    console.error('[kit-vault] emailHasKitPurchase threw', String(e).slice(0, 200));
    return false;
  }
}

// ----------------------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------------------
exports.handler = async (event) => {
  const STRIPE = process.env.STRIPE_SECRET_KEY;
  const HMAC = process.env.TOOLKIT_HMAC_SECRET;
  const CORS = corsHeaders(event);
  const POST_HEADERS = Object.assign({}, JSON_HEADERS, CORS);

  // ---- CORS preflight for the cross-origin recovery POST ----
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // ---- POST: email recovery -> mint a short-lived download token (PII stays in the body) ----
  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }
    const email = (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '');
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { statusCode: 400, headers: POST_HEADERS, body: JSON.stringify({ ok: false, error: 'invalid_email' }) };
    }
    if (!HMAC) {
      return { statusCode: 503, headers: POST_HEADERS, body: JSON.stringify({ ok: false, error: 'unavailable', message: 'download is temporarily unavailable. DM @closermethod and i will get your files to you right away.' }) };
    }
    const paid = await emailHasKitPurchase(STRIPE, email);
    if (!paid) {
      return { statusCode: 200, headers: POST_HEADERS, body: JSON.stringify({ ok: false, message: 'i could not find a purchase under that email. use the exact email from your receipt, or DM @closermethod and i will sort it out.' }) };
    }
    return { statusCode: 200, headers: POST_HEADERS, body: JSON.stringify({ ok: true, token: mintToken(HMAC, TOKEN_TTL_MS) }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  }

  // ---- GET: stream a paid file after proving purchase ----
  const q = event.queryStringParameters || {};
  const file = typeof q.file === 'string' ? q.file : '';

  // allowlist + traversal guard BEFORE any auth or fs work
  if (!file || file.indexOf('..') >= 0 || file.indexOf('\\') >= 0 || file.charAt(0) === '/' || !ALLOWED_FILES.has(file)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'bad_file' }) };
  }

  // authorize: session_id (Stripe live) OR token (HMAC). FAIL CLOSED.
  let authorized = false;
  if (q.session_id) {
    authorized = await verifySessionId(STRIPE, q.session_id);
  }
  if (!authorized && q.token) {
    authorized = verifyToken(HMAC, q.token);
  }
  if (!authorized) {
    return {
      statusCode: 403,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, error: 'not_verified', message: 'this download is for buyers only. enter the email from your receipt to unlock, or DM @closermethod.' })
    };
  }

  // serve the bytes
  const abs = resolveVaultFile(file);
  if (!abs) {
    console.error('[kit-vault] vault file not found on disk:', file);
    return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'not_found' }) };
  }
  let buf;
  try { buf = fs.readFileSync(abs); } catch (e) {
    console.error('[kit-vault] read failed', String(e).slice(0, 200));
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
