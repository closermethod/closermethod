// Stripe webhook -> Kit auto-tag buyers + trigger delivery email
//
// SETUP (5 min, in Stripe dashboard):
// 1. Stripe Dashboard -> Developers -> Webhooks -> "Add endpoint"
// 2. URL: https://closermethod.com/.netlify/functions/stripe-buyer-webhook
// 3. Events: select ONLY "checkout.session.completed"
// 4. Click "Add endpoint", reveal "Signing secret" (whsec_...), copy it
// 5. Netlify -> closermethod-waitlist site -> Site settings -> Env vars -> Add:
//    STRIPE_WEBHOOK_SECRET = whsec_... (paste the secret from step 4)
// 6. Confirm KIT_API_SECRET is already set (it is — used by /subscribe.js)
//
// FILL IN BELOW: each Kit tag ID for each product (find in Kit -> Tags -> click tag -> URL has /tags/{ID}/edit)
// If you haven't created the buyer tags in Kit yet:
//   - Go to Kit -> Tags -> "Create new"
//   - Create one tag per product: e.g. "buyer_toolkit_47", "buyer_closerai_297", etc.
//   - Then attach an "Email Sequence" or "Broadcast" automation to each tag for the delivery email.
//   - Drop the tag IDs into PRODUCT_MAP below.

const crypto = require('crypto');

// ====== PRODUCT -> KIT TAG MAP ======
// Key: amount_total in cents (Stripe sends this as integer)
// Value: { name, kit_tag_id, fallback_form_id }
//
// Eli — fill in tag IDs from your Kit account. Until you do, the function will
// still subscribe buyers to your default form (9259574) but won't apply product-specific tags.
const PRODUCT_MAP = {
  // AI Builder Toolkit (apply: product tag + stage_buyer_toolkit + aud_builder + claude-skills-buyer)
  // 2026-05-23: added 19759226 claude-skills-buyer for /skills + /artifacts buyer attribution (enrolls in skills-buyer sequence).
  // Operator Install rung — 2026-05-24. plink_1TaWVZ8nfWJMJe0DYDDKHe0k. Tags install-buyer (19762783).
  // 2026-06-14: $17 "the first skill" tripwire (first-skill-checkout.js, price_1TiH2L8). Tags into aud_builder so $17 buyers
  // are attributed + targetable for the $17→$147 ascension. TODO (Kit UI, API create is admin-restricted): dedicated
  // "first-skill-buyer" tag + a short ascension sequence driving to the $147 system within the 14-day credit window.
  1700:  { name: 'the first skill ($17 tripwire)',          tag_ids: [19315103] /* aud_builder */ },
  3700:  { name: 'Operator Install ($37 tripwire)',         tag_ids: [19762783, 19315103] /* install-buyer, aud_builder */ },
  4700:  { name: 'AI Builder Toolkit ($47)',                tag_ids: [18879433, 19315105, 19315103, 19759226] /* toolkit-buyer, stage_buyer_toolkit, aud_builder, claude-skills-buyer */ },
  9700:  { name: 'AI Builder Toolkit ($97 founder rate)',   tag_ids: [18879433, 19315105, 19315103, 19759226] },
  // $147 evergreen price after 2026-05-31 23:59 PT countdown (Eli creates plink before then).
  14700: { name: 'AI Builder Toolkit ($147 evergreen)',     tag_ids: [18879433, 19315105, 19315103, 19759226] },
  // 2026-06-06: /build order bump. Custom Checkout Session (create-build-checkout.js) bundles
  // toolkit $147 + Install Walkthrough $37 = $184 (18400¢). This session has NO payment_link, so
  // it falls through to amount routing. Without this entry it would hit "Unknown product ($184)"
  // with ZERO tags. Union of toolkit tags + install-buyer so the buyer is enrolled in BOTH the
  // toolkit delivery sequence (18879433→2735984) AND install delivery (19762783→2768152).
  18400: { name: 'AI Builder Toolkit + Install Walkthrough ($184 bump)', tag_ids: [18879433, 19315105, 19315103, 19759226, 19762783] /* toolkit-buyer, stage_buyer_toolkit, aud_builder, claude-skills-buyer, install-buyer */ },
  // CloserAI (apply: product tag + stage_buyer_closerai + aud_creator since CloserAI is for UGC closers)
  29700: { name: 'CloserAI Day 1 ($297)',                   tag_ids: [19251270, 19315111, 19315100] /* buyer_closerai_297, stage_buyer_closerai, aud_creator */ },
  34700: { name: 'CloserAI Day 2 ($347)',                   tag_ids: [19251270, 19315111, 19315100] },
  39700: { name: 'CloserAI Day 3-4 ($397)',                 tag_ids: [19251270, 19315111, 19315100] },
  49700: { name: 'CloserAI Public ($497)',                  tag_ids: [19251270, 19315111, 19315100] },
  99700: { name: 'CloserAI Pro ($997)',                     tag_ids: [19251271, 19251269, 19315111, 19315100] /* buyer_closerai_997, vip_closerai, stage_buyer_closerai, aud_creator */ },
  // UGC products
  6700:  { name: 'Pro Rate Calculator ($67)',               tag_ids: [16838323, 19315100, 19315104] /* calculator_user, aud_creator, stage_lead */ },
  19700: { name: 'UGC Closer Kit ($197)',                   tag_ids: [17445194, 19315108, 19315100] /* purchased-closer-kit, stage_buyer_ugc, aud_creator */ },
  24700: { name: 'UGC Closer Kit ($247)',                   tag_ids: [17445194, 19315108, 19315100] },
  // Pitch Brain Pack — added May 8, 2026. Generic buyer tag (18168606) auto-applied above.
  // Uses existing pitch-pack-buyer tag (19417158) — does NOT enroll in pitch-brain-nurture (that's for free leads).
  // TODO: create a buyer-only delivery/nurture sequence in Kit triggered by tag 19417158.
  2700:  { name: 'Pitch Brain Pack ($27)',                  tag_ids: [19417158, 19315100] /* pitch-pack-buyer, aud_creator */ }
  // NOTE: AI Builder Lounge ($47/mo and $97/mo) routed via mode='subscription' below, not by amount.
};

// Subscription products routed by Stripe `mode === 'subscription'` instead of amount.
const SUBSCRIPTION_MAP = {
  4700: { name: 'Lounge Founding ($47/mo)', tag_ids: [19251272, 19315103] /* member_lounge_47, aud_builder */ },
  9700: { name: 'Lounge Public ($97/mo)',   tag_ids: [19251273, 19315103] /* member_lounge_97, aud_builder */ }
};

// 2026-05-23: payment_link → product map. Used when amount alone is ambiguous (e.g., $297 is both
// CloserAI Day 1 AND Stack Installer). Stripe sends session.payment_link with the plink ID.
// If payment_link matches here, this map takes precedence over PRODUCT_MAP[amount].
const PAYMENT_LINK_MAP = {
  // 2026-06-15: Reliable AI Cohort 01 — mapped by link ID so $197/$247/$297 don't collide with UGC Kit / CloserAI amounts.
  'plink_1TiVPp8nfWJMJe0DDXv2LchJ': { name: 'Reliable AI Cohort 01 ($197)', tag_ids: [20371809, 19315103] /* cohort-01-buyer, aud_builder */ },
  'plink_1TieeQ8nfWJMJe0DzFhCkw3Q': { name: 'Reliable AI Cohort 01 ($247)', tag_ids: [20371809, 19315103] /* cohort-01-buyer, aud_builder */ },
  'plink_1TiefM8nfWJMJe0DSIfZ8TEW': { name: 'Reliable AI Cohort 01 ($297)', tag_ids: [20371809, 19315103] /* cohort-01-buyer, aud_builder */ },
  // 2026-06-16: Cohort 01 + $47 personal build-review ORDER BUMP (tier-matched: 244/294/344). Adds cohort-01-buildreview (20385654)
  // so Eli can filter who bought the add-on and deliver the private walkthrough. Same buyer+audience tags as base cohort.
  'plink_1TitTa8nfWJMJe0DJwdBTcwV': { name: 'Reliable AI Cohort 01 + build review ($244)', tag_ids: [20371809, 19315103, 20385654] /* cohort-01-buyer, aud_builder, cohort-01-buildreview */ },
  'plink_1TitTw8nfWJMJe0D1sPGtsKR': { name: 'Reliable AI Cohort 01 + build review ($294)', tag_ids: [20371809, 19315103, 20385654] },
  'plink_1TitUF8nfWJMJe0DBR1g3n12': { name: 'Reliable AI Cohort 01 + build review ($344)', tag_ids: [20371809, 19315103, 20385654] },
  // 2026-06-18: AI Adoption Studio Cohort 01 — $497 founding. NEW link, redirects to /access/cohort (no client-side purchase event there, so this webhook is the ONLY GA4 attribution). cohort-01-buyer + aud_builder.
  'plink_1TjTNO8nfWJMJe0DUUhe6Duv': { name: 'AI Adoption Cohort 01 ($497 founding)', tag_ids: [20371809, 19315103] /* cohort-01-buyer, aud_builder */ },
  'plink_1TWEQ98nfWJMJe0DjU5hOOFX': { name: 'Stack Installer ($297)',     tag_ids: [19677019, 19315103] /* stack-buyer, aud_builder */ },
  'plink_1TaWVZ8nfWJMJe0DYDDKHe0k': { name: 'Install Walkthrough ($37 legacy)', tag_ids: [19762783, 19315103] /* install-buyer, aud_builder · LEGACY: deactivated 2026-05-24 but kept in map for any in-flight webhooks */ },
  // 2026-05-24: clean-name link. line_item.description snapshots "Install Walkthrough" (product renamed before this link was created). Replaces plink_1TaWVZ which still showed "Operator Install" in checkout due to frozen-at-creation rule.
  'plink_1Taj9A8nfWJMJe0D0oe1kYCn': { name: 'Install Walkthrough ($37)',     tag_ids: [19762783, 19315103] /* install-buyer, aud_builder */ },
  // 2026-05-24: NEW $97 link with apex redirect to /access/toolkit/. Replaces plink_1TVddc8nfWJMJe0DmStSvYTe (old subdomain redirect).
  'plink_1TaX1D8nfWJMJe0DMn8wHGJJ': { name: 'AI Builder Toolkit ($97 apex)',       tag_ids: [18879433, 19315105, 19315103, 19759226] /* toolkit-buyer, stage_buyer_toolkit, aud_builder, claude-skills-buyer */ },
  // 2026-05-24: clean-name link. Same tags. Replaces plink_1TaX1D (which had "(Skills)" suffix in checkout description).
  'plink_1TaXjb8nfWJMJe0DE4FmsVxL': { name: 'AI Builder Toolkit ($97 clean name)', tag_ids: [18879433, 19315105, 19315103, 19759226] },
  // 2026-05-24: $147 evergreen toolkit link, post-founder-rate. Same tags as $97 since same product.
  'plink_1TaeLg8nfWJMJe0DdlmQUvMD': { name: 'AI Builder Toolkit ($147 evergreen)', tag_ids: [18879433, 19315105, 19315103, 19759226] },
  // 2026-05-29: UGC Closer Method Toolkit links (Jun 1-6 launch). WITHOUT these, amount-fallback
  // MIS-ROUTED UGC buyers: $147→AI Builder toolkit, $297→CloserAI, $797→Unknown(no tags). These pin correct UGC tags
  // so UGC buyers get UGC nurture (not AI Builder / CloserAI sequences) + correct attribution.
  // Founding = the Retainer Engine product renamed. Pro/DFY = upgrade tiers. All get aud_creator (UGC audience).
  'plink_1Ta3Gv8nfWJMJe0DIXFNR8cj': { name: 'UGC Closer Method Toolkit · Founding', tag_ids: [19588347, 19315108, 19315100] /* retainer-engine-buyer, stage_buyer_ugc, aud_creator */ },
  'plink_1TXTwp8nfWJMJe0Dum8DK6k0': { name: 'UGC Closer Method Toolkit · Pro',      tag_ids: [19612150, 19315108, 19315100] /* toolkit-pro-buyer, stage_buyer_ugc, aud_creator */ },
  'plink_1TXT888nfWJMJe0DVyMZJGEP': { name: 'UGC Closer Method Toolkit · DFY',      tag_ids: [19612151, 19315108, 19315100] /* toolkit-dfy-buyer, stage_buyer_ugc, aud_creator */ },
  'plink_1TX5E18nfWJMJe0DLaJR2Tht': { name: 'UGC Closer Kit standalone ($247)',     tag_ids: [17445194, 19315108, 19315100] /* purchased-closer-kit, stage_buyer_ugc, aud_creator */ },
  // 2026-06-15: Missed-Call Money Workshop ($497, B2B). CRITICAL: $497 (49700) in PRODUCT_MAP routes to
  // "CloserAI Public ($497)" — a UGC creator product. Without this payment_link entry, a B2B workshop buyer
  // would be mis-tagged into CloserAI's UGC nurture. This entry pins the workshop link so amount-routing never
  // fires for it. tag_ids is EMPTY on purpose: Kit tag/sequence CREATE is admin-restricted via API, so the
  // dedicated "workshop-buyer" tag + delivery sequence must be made by Eli in the Kit UI. Until then the buyer
  // still gets the generic buyer tag (18168606) + default form, and the FULL product is delivered on the
  // /workshop/thanks page (interactive ROI calculator + roadmap + checklist), so nothing is undelivered.
  // TODO (Eli, Kit UI): create tag "workshop-buyer" + a short delivery/onboarding sequence (join link + date +
  // template links), then drop the tag id here and add it to TAG_TO_SEQUENCE below.
  'plink_1TiWxf8nfWJMJe0DCQAv8oXK': { name: 'Missed-Call Money Workshop ($497)', tag_ids: [] }
};

// Default form for all buyers (so they're always subscribed even if tag fails)
const KIT_DEFAULT_BUYER_FORM_ID = '9259574'; // existing waitlist form, has automation
const KIT_BUYER_TAG_ID = '18168606'; // existing — applied to ALL buyers as a generic "buyer" marker

function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = header.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});
  if (!parts.t || !parts.v1) return false;

  const signedPayload = `${parts.t}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  // Constant-time comparison
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(parts.v1, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function kitSubscribe(email, formId, apiSecret) {
  return fetch(`https://api.convertkit.com/v3/forms/${formId}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_secret: apiSecret, email })
  }).catch(err => ({ ok: false, error: err.message }));
}

async function kitTag(email, tagId, apiSecret) {
  // 2026-05-24: race-condition fix. Kit v3 /tags/{id}/subscribe occasionally drops tags
  // when called rapidly in sequence (observed on Christian's $164 sale where 2 of 4
  // tags were applied). Retry with backoff if response is non-2xx.
  const attempt = async () => fetch(`https://api.convertkit.com/v3/tags/${tagId}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_secret: apiSecret, email })
  });
  for (let i = 0; i < 3; i++) {
    try {
      const r = await attempt();
      if (r.ok || r.status === 201 || r.status === 200) return r;
      // 429/5xx → backoff and retry
      if (r.status === 429 || r.status >= 500) {
        await new Promise(res => setTimeout(res, 350 * (i + 1)));
        continue;
      }
      // Other non-2xx (e.g. 422 already-tagged) → return as-is, no point retrying
      return r;
    } catch (err) {
      if (i === 2) return { ok: false, error: err.message };
      await new Promise(res => setTimeout(res, 350 * (i + 1)));
    }
  }
  return { ok: false, error: 'max retries exceeded' };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiSecret = process.env.KIT_API_SECRET;

  if (!apiSecret) {
    console.error('[stripe-buyer-webhook] KIT_API_SECRET not set');
    return { statusCode: 500, body: 'Kit API secret not configured' };
  }

  // ====== VERIFY SIGNATURE ======
  // FAIL CLOSED: if STRIPE_WEBHOOK_SECRET isn't set, refuse all requests (security).
  // Anyone could otherwise POST fake checkout.session.completed events and pollute Kit + tag fake buyers.
  if (!webhookSecret) {
    console.error('[stripe-buyer-webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting all requests for security');
    return { statusCode: 503, body: 'Webhook not configured. Contact admin.' };
  }
  const sigHeader = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const valid = verifyStripeSignature(event.body, sigHeader, webhookSecret);
  if (!valid) {
    console.error('[stripe-buyer-webhook] Invalid Stripe signature');
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Only handle checkout.session.completed
  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: JSON.stringify({ ignored: stripeEvent.type }) };
  }

  const session = stripeEvent.data && stripeEvent.data.object;
  if (!session) {
    return { statusCode: 200, body: JSON.stringify({ ignored: 'no session' }) };
  }

  const email = (session.customer_details && session.customer_details.email) || session.customer_email;
  const amount = session.amount_total; // integer cents

  if (!email) {
    console.warn('[stripe-buyer-webhook] No email on session', session.id);
    return { statusCode: 200, body: JSON.stringify({ ignored: 'no email' }) };
  }

  // IDEMPOTENCY: Stripe retries failed webhook deliveries multiple times.
  // Without this check, retries would double-enroll buyers in Kit + double-count GA4 revenue.
  // We use the Stripe event ID (always unique per delivery, stable across retries) as the dedup key
  // and store recent IDs in memory. Lambdas warm-reuse this, so 99% of retries hit cache.
  // For Lambda cold-starts, the 2nd retry might still slip through · but Stripe-Kit-API both reject duplicates downstream
  // (Kit tag-already-applied is no-op, GA4 deduplicates by transaction_id which we set to session.id).
  if (!global._processedEventIds) global._processedEventIds = new Map();
  const eventId = stripeEvent.id;
  if (eventId && global._processedEventIds.has(eventId)) {
    console.log(`[stripe-buyer-webhook] DUPLICATE event ${eventId} · skipping`);
    return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate', event_id: eventId }) };
  }
  if (eventId) {
    global._processedEventIds.set(eventId, Date.now());
    // Keep last 1000 event IDs to avoid memory bloat across long-running Lambda
    if (global._processedEventIds.size > 1000) {
      const oldestKey = global._processedEventIds.keys().next().value;
      global._processedEventIds.delete(oldestKey);
    }
  }

  // Route by subscription vs one-time payment mode (handles same-amount conflicts: Toolkit $47 vs Lounge $47/mo)
  const isSubscription = session.mode === 'subscription';
  const productMap = isSubscription ? SUBSCRIPTION_MAP : PRODUCT_MAP;
  // 2026-05-23: PAYMENT_LINK_MAP takes precedence over amount-based routing (resolves $297 collision between CloserAI + Stack).
  const paymentLinkId = session.payment_link;
  let product;
  if (!isSubscription && paymentLinkId && PAYMENT_LINK_MAP[paymentLinkId]) {
    product = PAYMENT_LINK_MAP[paymentLinkId];
    console.log(`[stripe-buyer-webhook] Routed by payment_link ${paymentLinkId}`);
  } else {
    product = productMap[amount] || { name: `Unknown product ($${amount / 100}${isSubscription ? '/mo' : ''})`, tag_ids: [] };
  }
  // Derive a stable item_id for GA4 from the product name (kebab-case slug)
  // Falls back to 'unknown-product' if no name. Used in the GA4 purchase event.
  const productItemId = (product.name || 'unknown-product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  console.log(`[stripe-buyer-webhook] Buyer: ${email} · Amount: $${amount / 100}${isSubscription ? '/mo' : ''} · Product: ${product.name}`);

  // STEP 1: subscribe to default buyer form
  await kitSubscribe(email, KIT_DEFAULT_BUYER_FORM_ID, apiSecret);

  // STEP 2: apply generic buyer tag (always, even if product unknown)
  await kitTag(email, KIT_BUYER_TAG_ID, apiSecret);

  // STEP 3: apply all product-specific tags (product + stage + audience)
  const tagIds = Array.isArray(product.tag_ids) ? product.tag_ids : [];
  const tagResults = [];
  for (const tagId of tagIds) {
    const r = await kitTag(email, tagId, apiSecret);
    tagResults.push({ tag_id: tagId, ok: r && (r.ok !== false) });
  }
  if (!tagIds.length) {
    console.warn(`[stripe-buyer-webhook] No Kit tags configured for product: ${product.name}`);
  }

  // STEP 4: tag → sequence enrollment (eliminates need for Kit Automations dashboard wiring)
  // Pro $997 buyers go to Pro onboarding ONLY (Pro sequence has standard content + Pro extras baked in).
  // Standard CloserAI buyers go to standard buyer onboarding.
  const TAG_TO_SEQUENCE = {
    19251270: 2709932,  // buyer_closerai_297 → CloserAI Buyer — Workspace Delivery
    19251271: 2750483,  // buyer_closerai_997 → CloserAI Pro $997 Buyer Onboarding
    // 2026-05-23 NEW buyer sequences (dedicated per product)
    19759226: 2767904,  // claude-skills-buyer → /skills Buyer Onboarding · Claude Skills
    19759227: 2767905,  // prompts-buyer       → /artifacts Buyer Onboarding · Prompts
    19677019: 2767906,  // stack-buyer         → /stack Buyer Onboarding · Stack Installer
    18879433: 2735984,  // toolkit-buyer       → AI Builder Toolkit - Buyer Onboarding (existing)
    19762783: 2768152,  // install-buyer       → Operator Install · Buyer Delivery (2026-05-24, has 1 draft email)
    20371809: 2795647,  // cohort-01-buyer     → Cohort 01 Buyer Onboarding (2026-06-16, B1 "you're in" fires immediately; B2-B5 are dated broadcasts)
  };
  const enrolledSequences = new Set();
  const sequenceResults = [];
  for (const tagId of tagIds) {
    const seqId = TAG_TO_SEQUENCE[tagId];
    if (seqId && !enrolledSequences.has(seqId)) {
      enrolledSequences.add(seqId);
      try {
        const r = await fetch(`https://api.convertkit.com/v3/sequences/${seqId}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_secret: apiSecret, email })
        });
        sequenceResults.push({ sequence_id: seqId, trigger_tag: tagId, status: r.status });
      } catch (e) {
        sequenceResults.push({ sequence_id: seqId, trigger_tag: tagId, status: 'error' });
      }
    }
  }

  // 2026-06-14: $17 "the first skill" tripwire → enroll directly into the ascension sequence
  // "first skill buyer ascension ($17 to $147)" (seq 2794378). Keyed by amount, not a tag, because
  // the $17 buyer's only tag (aud_builder) is shared with toolkit buyers who must NOT get this nudge.
  if (amount === 1700 && !enrolledSequences.has(2794378)) {
    enrolledSequences.add(2794378);
    try {
      const r = await fetch('https://api.convertkit.com/v3/sequences/2794378/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_secret: apiSecret, email })
      });
      sequenceResults.push({ sequence_id: 2794378, trigger_tag: 'amount_1700', status: r.status });
    } catch (e) {
      sequenceResults.push({ sequence_id: 2794378, trigger_tag: 'amount_1700', status: 'error' });
    }
  }

  // GA4 server-side purchase event via Measurement Protocol
  // Fires unique per-buyer with real Stripe session_id as transaction_id
  // Required env vars: GA4_MEASUREMENT_ID (e.g. G-Q2458LX0VD), GA4_API_SECRET (server-side secret from GA4 admin)
  let ga4Status = null;
  const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-Q2458LX0VD';
  const GA4_API_SECRET = process.env.GA4_API_SECRET;
  if (GA4_API_SECRET && email && amount) {
    try {
      // Stable client_id from email hash so GA4 doesn't think it's a new user every time
      const crypto = require('crypto');
      const clientId = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16) + '.' + crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(16, 32);
      const transactionId = session.id || session.payment_intent || `cs_${Date.now()}`;
      const value = amount / 100; // cents → dollars
      const ga4Body = {
        client_id: clientId,
        user_id: email, // optional but lets you join across sessions
        events: [{
          name: 'purchase',
          params: {
            transaction_id: transactionId,
            value: value,
            currency: (session.currency || 'usd').toUpperCase(),
            items: [{
              item_id: productItemId,
              item_name: product.name || 'Unknown Product',
              price: value,
              quantity: 1
            }],
            page_location: 'https://closermethod.com/access/toolkit/',
            engagement_time_msec: 1
          }
        }]
      };
      const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;
      const ga4Res = await fetch(ga4Url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ga4Body)
      });
      ga4Status = { sent: true, http: ga4Res.status, transaction_id: transactionId, value };
    } catch (e) {
      ga4Status = { sent: false, error: String(e).slice(0, 200) };
    }
  } else if (!GA4_API_SECRET) {
    ga4Status = { sent: false, reason: 'GA4_API_SECRET env var not set' };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      received: true,
      email,
      amount,
      product: product.name,
      tags_applied: tagIds.length,
      tag_results: tagResults,
      sequences_enrolled: sequenceResults,
      ga4: ga4Status
    })
  };
};
