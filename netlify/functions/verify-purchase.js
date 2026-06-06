// 2026-05-22: STRIPE_SECRET_KEY now set (rk_live_ restricted, Checkout Sessions read only). Bundle bump forces warm Lambdas to reload env.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ verified: false, error: 'Valid email required' }) };
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      // Fallback: if no Stripe key configured, allow unlock (same as current behavior)
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: true, fallback: true })
      };
    }

    // Search Stripe for completed checkout sessions with this email
    const searchUrl = `https://api.stripe.com/v1/checkout/sessions?customer_details[email]=${encodeURIComponent(email)}&status=complete&limit=10`;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${stripeKey}`
      }
    });

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: true, fallback: true })
      };
    }

    const data = await response.json();

    // Unlock /app for any of these completed purchases (May 1 cutover):
    //  - CloserAI Lite ($97 = 9700 cents) — tools-only tier sold from /app gate
    //  - CloserAI ($297 = 29700 cents) — full system, /app tools included
    //  - CloserAI Pro ($997 = 99700 cents) — Pro tier, /app tools included
    //  - Legacy $47 closer-tools buyers (4700 / 4699) — grandfathered
    const VALID_AMOUNTS = new Set([9700, 29700, 99700, 4700, 4699]);
    const hasPurchase = data.data && data.data.some(session =>
      VALID_AMOUNTS.has(session.amount_total)
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: hasPurchase })
    };
  } catch (err) {
    // On any error, allow unlock (don't block paying customers)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: true, fallback: true })
    };
  }
};
