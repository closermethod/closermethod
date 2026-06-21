// first-skill-checkout: mints a FRESH $17 Stripe Checkout Session for the "the first skill" tripwire.
//
// Mirrors create-build-checkout.js. Redirects paid buyers to the fail-closed delivery page with
// the live session_id so first-skill-vault can unlock the files server-side. Isolated from the
// $147 toolkit flow so it can never affect it.
//
// ENV REQUIRED: STRIPE_SECRET_KEY (already set on the apex site).
//
// Stripe ids (created 2026-06-14):
//   product prod_UhgOcG9AAAWLuP  ·  price $17 -> price_1TiH2L8nfWJMJe0DDe7ANJdR

const PRICE_FIRST_SKILL = 'price_1TiH2L8nfWJMJe0DDe7ANJdR'; // $17 the first skill
const ORIGIN = 'https://closermethod.com';
const SUCCESS_URL = `${ORIGIN}/access/first-skill/?session_id={CHECKOUT_SESSION_ID}`;
const CANCEL_URL  = `${ORIGIN}/build/?checkout=cancelled`;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function formEncode(obj) {
  return Object.keys(obj)
    .filter(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== '')
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]))
    .join('&');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.warn('[first-skill-checkout] STRIPE_SECRET_KEY not set');
    return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'checkout_unavailable', fallback: true }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }
  const clientRef = (typeof body.client_reference_id === 'string' && body.client_reference_id.slice(0, 200)) || undefined;
  const utm = (body.utm && typeof body.utm === 'object') ? body.utm : {};

  const params = {
    mode: 'payment',
    'line_items[0][price]': PRICE_FIRST_SKILL,
    'line_items[0][quantity]': 1,
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    'metadata[product]': 'first-skill',
    'metadata[source_page]': (typeof body.source === 'string' ? body.source.slice(0, 60) : 'tripwire')
  };
  if (clientRef) params.client_reference_id = clientRef;
  UTM_KEYS.forEach(k => { if (utm[k]) params[`metadata[${k}]`] = String(utm[k]).slice(0, 200); });

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + secret, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formEncode(params)
    });
    const session = await res.json();
    if (!res.ok || !session || !session.url) {
      console.error('[first-skill-checkout] Stripe error', res.status, JSON.stringify((session && session.error) || session).slice(0, 300));
      return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'stripe_failed' }) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: session.url, id: session.id }) };
  } catch (err) {
    console.error('[first-skill-checkout] fetch threw', String(err).slice(0, 300));
    return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'network' }) };
  }
};
