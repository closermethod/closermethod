// create-build-checkout: custom Stripe Checkout Session for the /build front door.
//
// WHY THIS EXISTS (non-stranding order bump):
//   A Stripe Payment Link freezes its after-payment redirect at creation time. A single
//   link carrying toolkit ($147) + Install Walkthrough ($37) could only ever redirect to
//   ONE url. The toolkit's url is /access/toolkit/ (off-limits to edit), which has no way
//   to deliver the $37 walkthrough. So a bump buyer on that frozen link would pay $184 and
//   land on a page that hands them only the toolkit. Stranded.
//
//   This function mints a FRESH Checkout Session on each click with the success_url already
//   computed for what they actually bought:
//     - toolkit only ($147)  -> /access/toolkit/   (unchanged, existing delivery)
//     - toolkit + bump ($184) -> /access/build-plus/ (combined delivery, hands over BOTH)
//   The buyer webhook (stripe-buyer-webhook.js) routes the 18400¢ amount to the union of
//   toolkit + install Kit tags, so attribution + nurture are handled.
//
// DEPLOY-SAFE BY DESIGN:
//   The /build CTA tries this function and FALLS BACK to the evergreen $147 Payment Link on
//   ANY error (missing secret key, Stripe down, network blip). Worst case: the bump silently
//   doesn't apply and the buyer still gets the toolkit. No dead button on the cold front door,
//   no stranding, no double charge. So this can ship before STRIPE_SECRET_KEY is even set;
//   the bump just stays inert until the key lands.
//
// ENV REQUIRED (Eli adds in Netlify -> apex site -> Env vars, never on disk):
//   STRIPE_SECRET_KEY = sk_live_...   (restricted key with write access to Checkout Sessions
//                                      is enough; full secret key also works)
//
// Stripe price IDs (verified live from Stripe 2026-06-06, not memory):
//   toolkit $147 -> price_1TaeKZ8nfWJMJe0DHfXOat2w  (prod_UUctXHsPEFqVPT)
//   bump    $37  -> price_1TaWTv8nfWJMJe0DFOwQQN9S  (prod_UZfpnOl3WH7f1s)

const PRICE_TOOLKIT = 'price_1TaeKZ8nfWJMJe0DHfXOat2w'; // $147 AI Builder Toolkit
const PRICE_BUMP    = 'price_1TaWTv8nfWJMJe0DFOwQQN9S'; // $37 Install Walkthrough

const ORIGIN = 'https://closermethod.com';
const SUCCESS_TOOLKIT_ONLY = `${ORIGIN}/access/toolkit/`;      // off-limits page, existing delivery; we only redirect to it
const SUCCESS_WITH_BUMP    = `${ORIGIN}/access/build-plus/`;   // new combined-delivery page (this PR)
const CANCEL_URL           = `${ORIGIN}/build/?checkout=cancelled`;

// Allowed UTM keys we forward into session metadata (for attribution in Stripe + downstream).
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

// Build a x-www-form-urlencoded body from a flat key->value object (Stripe's wire format).
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
    // Fail soft: tell the client to fall back to the evergreen link. NOT a 500; the front
    // door must keep selling. Client handles this by redirecting to EVERGREEN_LINK.
    console.warn('[create-build-checkout] STRIPE_SECRET_KEY not set; instructing client fallback');
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'checkout_unavailable', fallback: true })
    };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    body = {};
  }

  const wantsBump = body.bump === true || body.bump === 'true';
  const clientRef = (typeof body.client_reference_id === 'string' && body.client_reference_id.slice(0, 200)) || undefined;
  const utm = (body.utm && typeof body.utm === 'object') ? body.utm : {};

  // Assemble Stripe Checkout Session params (form-encoded, including indexed line items).
  const params = {
    mode: 'payment',
    'line_items[0][price]': PRICE_TOOLKIT,
    'line_items[0][quantity]': 1,
    success_url: wantsBump ? SUCCESS_WITH_BUMP : SUCCESS_TOOLKIT_ONLY,
    cancel_url: CANCEL_URL,
    // Surface the bump choice + UTMs in Stripe dashboard + on the session for the webhook.
    'metadata[product]': wantsBump ? 'toolkit_plus_install_walkthrough' : 'toolkit',
    'metadata[bump]': wantsBump ? 'yes' : 'no',
    'metadata[source_page]': 'build'
  };
  if (wantsBump) {
    params['line_items[1][price]'] = PRICE_BUMP;
    params['line_items[1][quantity]'] = 1;
  }
  if (clientRef) params.client_reference_id = clientRef;
  UTM_KEYS.forEach(k => {
    if (utm[k]) params[`metadata[${k}]`] = String(utm[k]).slice(0, 200);
  });

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secret,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formEncode(params)
    });
    const session = await res.json();
    if (!res.ok || !session || !session.url) {
      console.error('[create-build-checkout] Stripe error', res.status, JSON.stringify(session && session.error || session).slice(0, 300));
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'stripe_failed', fallback: true })
      };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url, id: session.id, bump: wantsBump })
    };
  } catch (err) {
    console.error('[create-build-checkout] fetch threw', String(err).slice(0, 300));
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'network', fallback: true })
    };
  }
};
