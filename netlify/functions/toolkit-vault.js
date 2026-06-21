// toolkit-vault: proof-of-purchase gate that STREAMS the paid AI Builder Toolkit files.
//
// WHY THIS EXISTS:
//   The paid toolkit zips used to sit at raw, public CDN urls
//   (ai-builder-setup.netlify.app/ai-builder-setup-v2.zip, /skills/*.zip, etc.) and were
//   hardcoded straight into /access/toolkit/. Anyone with the link downloaded the whole
//   $147 product for free. This function moves those 30 files behind a wall: the bytes live
//   in _vault/ (force-404'd from public serving + bundled into THIS function via
//   netlify.toml included_files), and you only get them after proving you paid.
//
// THREE WAYS TO PROVE PURCHASE (any one is enough):
//   1. session_id  -> a fresh /build Stripe Checkout Session id, appended to the success_url
//                     as ?session_id={CHECKOUT_SESSION_ID}. Verified LIVE against Stripe:
//                     must be a completed, paid, one-time toolkit purchase.
//   2. token       -> a short-lived HMAC token minted by the POST email-recovery path below
//                     (for buyers who arrive WITHOUT a session_id: evergreen-link buyers,
//                     email-link buyers, returning buyers). Also used as a long-lived signed
//                     token embedded in the 4 done-for-you delivery pages.
//   3. (no anonymous path) -> every download requires 1 or 2. FAIL CLOSED.
//
// FAIL-CLOSED CONTRACT (opposite of the old verify-purchase.js, which failed OPEN):
//   - Missing STRIPE_SECRET_KEY            -> session_id verification cannot pass -> denied.
//   - Missing TOOLKIT_HMAC_SECRET          -> token mint + token verify denied (graceful msg).
//   - Stripe says not paid / wrong product -> denied.
//   - file not on the allowlist            -> denied.
//   No env var, no Stripe, no match = NO bytes. Security beats convenience here on purpose.
//
// ENV REQUIRED (apex site -> Env vars; values never written to disk):
//   STRIPE_SECRET_KEY   = (already set) restricted key with Checkout Sessions READ scope.
//   TOOLKIT_HMAC_SECRET = strong random string; signs the recovery/DFY tokens.
//
// PII RULE: email is accepted by POST ONLY. It is NEVER read from a GET query string, so a
//           buyer's email never lands in a url, log line, or referrer.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// --- toolkit purchase fingerprint (verified live from Stripe 2026-06-06, not memory) -------
const PRICE_TOOLKIT = 'price_1TaeKZ8nfWJMJe0DHfXOat2w'; // $147 AI Builder Toolkit
const PRICE_BUMP    = 'price_1TaWTv8nfWJMJe0DFOwQQN9S'; // $37 Install Walkthrough (only ships WITH toolkit)
const TOOLKIT_PRICE_IDS = new Set([PRICE_TOOLKIT, PRICE_BUMP]);
// One-time amounts that mean "bought the toolkit": legacy $97, current $147, $147+$37 bump.
// mode must be 'payment' so a hypothetical $97/mo subscription can never match.
const TOOLKIT_AMOUNTS = new Set([9700, 14700, 18400]);

// --- the 32 paid files this vault is allowed to serve (exact allowlist) ---------------------
// Anything not in this set is rejected before we ever touch the filesystem.
// Superset of every download link on /access/toolkit/ — verified by three-way diff so no
// buyer can ever 403 on a file they paid for. Includes the two legacy root files (v1 setup
// zip + blank brain-doc template) the buyer page still links.
const ALLOWED_FILES = new Set([
  'ai-builder-setup-v2.zip',
  'ai-builder-setup.zip',
  'ai-builder-skills-individual-zips.zip',
  'brain-doc-example-closermethod.md',
  'brain-doc-template.md',
  'skills/ai-builder-annual-review.zip',
  'skills/ai-builder-booking-page.zip',
  'skills/ai-builder-brand-voice.zip',
  'skills/ai-builder-business-plan.zip',
  'skills/ai-builder-client-onboarding.zip',
  'skills/ai-builder-competitor-analysis.zip',
  'skills/ai-builder-course-outline.zip',
  'skills/ai-builder-email-funnel.zip',
  'skills/ai-builder-event-marketing.zip',
  'skills/ai-builder-faq-page.zip',
  'skills/ai-builder-go-to-market.zip',
  'skills/ai-builder-interactive-quiz.zip',
  'skills/ai-builder-launch-plan.zip',
  'skills/ai-builder-lead-magnet.zip',
  'skills/ai-builder-marketing-strategy.zip',
  'skills/ai-builder-partnership-proposal.zip',
  'skills/ai-builder-pitch-deck.zip',
  'skills/ai-builder-positioning.zip',
  'skills/ai-builder-pricing-calculator.zip',
  'skills/ai-builder-pricing-strategy.zip',
  'skills/ai-builder-referral-program.zip',
  'skills/ai-builder-resource-library.zip',
  'skills/ai-builder-social-calendar.zip',
  'skills/ai-builder-start-here.zip',
  'skills/ai-builder-testimonial-collector.zip',
  'skills/ai-builder-website.zip',
  'skills/ai-builder-welcome-packet.zip'
]);

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // recovery token valid 7 days

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

// ----------------------------------------------------------------------------------------
// HMAC token: "<base64url(payload)>.<base64url(sig)>"  payload = {exp, scope:'toolkit'}
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
  const payload = b64url(JSON.stringify({ exp: Date.now() + ttlMs, scope: 'toolkit' }));
  const sig = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}
function verifyToken(secret, token) {
  if (!secret || typeof token !== 'string' || token.indexOf('.') < 0) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  // timing-safe compare on equal-length buffers
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  let data;
  try { data = JSON.parse(b64urlDecode(payload).toString('utf8')); } catch (e) { return false; }
  if (!data || data.scope !== 'toolkit' || typeof data.exp !== 'number') return false;
  return data.exp > Date.now();
}

// ----------------------------------------------------------------------------------------
// Stripe verification (via fetch, no SDK). Both helpers return true ONLY on a real,
// completed, paid, one-time toolkit purchase. Any error / missing key returns false.
// ----------------------------------------------------------------------------------------
function sessionIsToolkitPurchase(session) {
  if (!session || session.status !== 'complete') return false;
  if (session.payment_status !== 'paid') return false;
  if (session.mode !== 'payment') return false; // never a subscription
  if (TOOLKIT_AMOUNTS.has(session.amount_total)) return true;
  const items = session.line_items && session.line_items.data;
  if (Array.isArray(items)) {
    for (const li of items) {
      const pid = li && li.price && li.price.id;
      if (pid && TOOLKIT_PRICE_IDS.has(pid)) return true;
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
    return sessionIsToolkitPurchase(session);
  } catch (e) {
    console.error('[toolkit-vault] verifySessionId threw', String(e).slice(0, 200));
    return false;
  }
}

async function emailHasToolkitPurchase(secret, email) {
  if (!secret || !email) return false;
  try {
    const url = 'https://api.stripe.com/v1/checkout/sessions'
      + `?customer_details[email]=${encodeURIComponent(email)}`
      + '&status=complete&limit=20&expand[]=data.line_items';
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + secret } });
    if (!res.ok) return false;
    const data = await res.json();
    const sessions = (data && data.data) || [];
    return sessions.some(sessionIsToolkitPurchase);
  } catch (e) {
    console.error('[toolkit-vault] emailHasToolkitPurchase threw', String(e).slice(0, 200));
    return false;
  }
}

// ----------------------------------------------------------------------------------------
// Resolve a vault file across the possible runtime layouts (Netlify bundles _vault/** via
// included_files). Try the documented locations; first that exists wins.
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

  // ---- POST: email recovery -> mint a short-lived download token (PII stays in the body) ----
  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }
    const email = (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '');
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'invalid_email' }) };
    }
    if (!HMAC) {
      // fail closed, but tell them how to get unstuck (made-to-work guarantee, the only one allowed)
      return { statusCode: 503, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'unavailable', message: 'download is temporarily unavailable. DM @closermethod and i will get your files to you right away.' }) };
    }
    const paid = await emailHasToolkitPurchase(STRIPE, email);
    if (!paid) {
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, message: 'i could not find a toolkit purchase under that email. use the exact email from your receipt, or DM @closermethod and i will sort it out.' }) };
    }
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, token: mintToken(HMAC, TOKEN_TTL_MS) }) };
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
    console.error('[toolkit-vault] vault file not found on disk:', file);
    return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'not_found' }) };
  }
  let buf;
  try { buf = fs.readFileSync(abs); } catch (e) {
    console.error('[toolkit-vault] read failed', String(e).slice(0, 200));
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
