// Apex /api/subscribe — Kit subscriber creator (single opt-in).
//
// 2026-05-23 rewrite: switched from v3 form-subscribe (which respected the form's double-opt-in
// setting and created subscribers in "inactive" state) to v4 /subscribers with state:"active".
// Per Eli's standing rule: NO double opt-in anywhere. Subscribers must be active immediately.
//
// Backward-compatible body schema:
//   { email, source?, first_name?, fields?, tag_ids?, sequence_id?, creator_type? }
//
// Source-specific tag handlers preserved for every page that depended on them:
//   - brain-builder, blueprint  → tag 18310491 (closer-method-brain-builder)
//   - pitch_roast               → tags 19251616 + 19251617
//   - closerai_exit_intent      → tags 19251617 + 19315100 + 19315104 + enroll sequence 2750418
//   - framework                 → tags 19743216 (framework-lead) + 19315103 (aud_builder)
//   - harness                   → tags 19743298 (harness-lead) + 19315103 (aud_builder)
//   - skill-coming-soon         → tags 19710326 + 19315100 + 19315104
//   - lounge_waitlist           → tags 19255029 + 19315103 + 19315104
//   - retainer-skill            → tag 19634429 (retainer-skill-lead), no sequence
//
// New: body.tag_ids array honored (fixes /calc /os /voice-suite which had been silently ignored).
// New: body.sequence_id honored for direct sequence enrollment.

const KIT_V4_BASE = 'https://api.kit.com/v4';
const KIT_V3_BASE = 'https://api.convertkit.com/v3';
const WAITLIST_TAG_ID = 18168606;

const RL = { windowMs: 60000, max: 10, store: new Map() };
function rateLimited(ip) {
  const now = Date.now();
  const e = RL.store.get(ip);
  if (!e || e.resetAt < now) { RL.store.set(ip, { count: 1, resetAt: now + RL.windowMs }); return false; }
  if (e.count >= RL.max) return true;
  e.count++;
  return false;
}

// --- Bot/spam signup filter (2026-05-28) ---
// /build gate flooded: 17 of 31 signups were bots — 6× @a7gi.ru, 11× dotted-gmail aliases.
// Bots POST straight to this endpoint (bypassing the page), so the rejection must live here,
// not in page HTML. Every check is positive-signal only — an absent field never rejects —
// so this stays backward-compatible with every other apex capture surface.
const DISPOSABLE_DOMAINS = new Set([
  'a7gi.ru',
  'guerrillamail.com', 'sharklasers.com', 'guerrillamail.info', 'grr.la',
  '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'trashmail.com',
  'yopmail.com', 'getnada.com', 'maildrop.cc', 'dispostable.com', 'fakeinbox.com',
]);

function botReason(email, body) {
  // 1. Honeypot: hidden fields a real user never sees. Page-rendering bots auto-fill every input.
  for (const k of ['website', 'url', 'company_website', 'hp_field']) {
    if (body[k] && String(body[k]).trim() !== '') return 'honeypot';
  }
  const at = email.lastIndexOf('@');
  if (at < 1) return 'malformed';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  // 2. Known disposable / bot-farm domains (mailinator deliberately excluded — E2E test harness).
  if (DISPOSABLE_DOMAINS.has(domain)) return 'disposable_domain';
  // 3. Gmail dot-abuse: Gmail ignores dots, so 4+ dots in the local part = throwaway alias spam.
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    if ((local.match(/\./g) || []).length >= 4) return 'gmail_dot_abuse';
  }
  return null;
}

function kitV4Headers(apiKey) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Kit-Api-Key': apiKey,
  };
}

async function applyTagV3(tagId, email, apiSecret) {
  try {
    await fetch(`${KIT_V3_BASE}/tags/${tagId}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_secret: apiSecret, email }),
    });
  } catch (e) { console.error(`[subscribe] tag ${tagId} failed:`, e.message); }
}

async function enrollSequenceV3(sequenceId, email, apiSecret) {
  try {
    await fetch(`${KIT_V3_BASE}/sequences/${sequenceId}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_secret: apiSecret, email }),
    });
  } catch (e) { console.error(`[subscribe] sequence ${sequenceId} failed:`, e.message); }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || event.headers['client-ip'] || 'unknown';
  if (rateLimited(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Too many requests, slow down.' }) };
  }

  // Bot-wave geo gate (GA4 audit 2026-06-11: 50% of generate_lead = IR bots; RU/Moscow wave before that).
  // Fail-open: only acts when Netlify provides a country header. Silent-discard so bots learn nothing.
  const geoCountry = (event.headers['x-country'] || (event.headers['x-nf-geo'] ? (() => { try { return JSON.parse(Buffer.from(event.headers['x-nf-geo'], 'base64').toString()).country?.code; } catch (e) { try { return JSON.parse(event.headers['x-nf-geo']).country?.code; } catch (e2) { return null; } } })() : null) || '').toUpperCase();
  if (geoCountry === 'IR' || geoCountry === 'RU') {
    console.log('[subscribe] geo-gate silent discard', { geoCountry, ip });
    return { statusCode: 200, body: JSON.stringify({ success: true, subscriber_id: 0, state: 'active' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const email = (body.email || '').trim().toLowerCase();
  const source = body.source || '';
  const firstName = body.first_name || undefined;
  const fields = body.fields && typeof body.fields === 'object' ? body.fields : null;
  const extraTagIds = Array.isArray(body.tag_ids) ? body.tag_ids : [];
  const sequenceId = body.sequence_id || null;

  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Valid email required' }) };
  }
  if (email.length > 254) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email too long' }) };
  }

  // Drop bots/spam before they ever reach Kit (protects sender reputation).
  // Silent success: don't signal the bot it was caught, don't create the subscriber.
  const reason = botReason(email, body);
  if (reason) {
    console.warn('[subscribe] blocked signup', { email, source, reason });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, filtered: true }) };
  }

  const apiKey = process.env.KIT_API_KEY;
  const apiSecret = process.env.KIT_API_SECRET;
  if (!apiKey) {
    console.error('[subscribe] KIT_API_KEY missing — falling back to v3 form-subscribe (double opt-in)');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  try {
    // 1. Create subscriber as ACTIVE via v4 (single opt-in · no confirmation email).
    const subscribePayload = { email_address: email, state: 'active' };
    if (firstName) subscribePayload.first_name = firstName;
    if (fields) subscribePayload.fields = fields;

    const subRes = await fetch(`${KIT_V4_BASE}/subscribers`, {
      method: 'POST',
      headers: kitV4Headers(apiKey),
      body: JSON.stringify(subscribePayload),
    });

    let subData = null;
    try { subData = await subRes.json(); } catch (_) { subData = {}; }

    // Kit v4 returns 201 on create, 422 on duplicate email (already exists). Both are OK.
    if (!subRes.ok && subRes.status !== 422) {
      console.error('[subscribe] Kit v4 non-2xx', { status: subRes.status, source, body: JSON.stringify(subData).slice(0, 300) });
      return { statusCode: 502, body: JSON.stringify({ error: 'Subscription failed at Kit upstream' }) };
    }

    // Per feedback_kit_success_response_is_not_delivery rule: verify subscriber.id.
    const subscriberId = subData?.subscriber?.id || subData?.data?.id || null;
    if (!subscriberId) {
      console.error('[subscribe] Kit returned 2xx but no subscriber.id — SILENT FAILURE', { email, source, previewBody: JSON.stringify(subData).slice(0, 300) });
      return { statusCode: 502, body: JSON.stringify({ error: 'Subscription not confirmed by Kit' }) };
    }
    console.log('[subscribe] v4 active subscriber created', { subId: subscriberId, source });

    // 2. Always apply the waitlist tag (preserves backward-compat with form 9259574 automations).
    await applyTagV3(WAITLIST_TAG_ID, email, apiSecret);

    // 3. Source-specific tag application (preserved exactly from pre-rewrite logic).
    if (source && (source.startsWith('brain-builder') || source === 'blueprint')) {
      await applyTagV3(18310491, email, apiSecret);
    }
    if (source === 'pitch_roast') {
      await applyTagV3(19251616, email, apiSecret);
      await applyTagV3(19251617, email, apiSecret);
    }
    if (source === 'closerai_exit_intent' || source === 'closerai_softcap') {
      await applyTagV3(19251617, email, apiSecret);
      await applyTagV3(19315100, email, apiSecret);
      await applyTagV3(19315104, email, apiSecret);
      await enrollSequenceV3(2750418, email, apiSecret);
    }
    if (source === 'framework') {
      await applyTagV3(19743216, email, apiSecret);
      await applyTagV3(19315103, email, apiSecret);
    }
    if (source === 'systems-diagnostic') {
      await applyTagV3(20221947, email, apiSecret); // systems-lead (B2B /hire offer page)
    }
    if (source === 'harness') {
      await applyTagV3(19743298, email, apiSecret);
      await applyTagV3(19315103, email, apiSecret);
    }
    if (source === 'skill-coming-soon') {
      await applyTagV3(19710326, email, apiSecret);
      await applyTagV3(19315100, email, apiSecret);
      await applyTagV3(19315104, email, apiSecret);
    }
    if (source === 'lounge_waitlist') {
      await applyTagV3(19255029, email, apiSecret);
      await applyTagV3(19315103, email, apiSecret);
      await applyTagV3(19315104, email, apiSecret);
    }
    // retainer-skill (/retainer): tag the lead, then nurture toward UGC skills.
    // Eli 2026-06-05: route retainer-skill leads into the UGC toolkit welcome (2777429) —
    // the same nurture /ugc + /reply use. Consolidates the UGC-creator legacy tools onto ONE nurture.
    if (source === 'retainer-skill') {
      await applyTagV3(19634429, email, apiSecret);
      await enrollSequenceV3(2777429, email, apiSecret);
    }

    // AI Adoption Studio sources — self-create Kit tags on first use (Kit v3 POST /tags is idempotent).
    // workmap-lead: free Work Map at /finder
    if (source === 'workmap-lead') {
      try {
        const tagRes = await fetch(`${KIT_V3_BASE}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_secret: apiSecret, tag: [{ name: 'workmap-lead' }] }),
        });
        const tagData = await tagRes.json();
        const tagId = tagData[0]?.id;
        if (tagId) await applyTagV3(tagId, email, apiSecret);
      } catch (e) { console.error('[subscribe] workmap-lead tag error:', e.message); }
      // Cohort 01 launch: scorecard leads also get cohort-01-lead for scheduled launch emails.
      await applyTagV3(20372872, email, apiSecret);
      await applyTagV3(19315103, email, apiSecret);
    }

    // b2b-fit-call: adoptionstudio.com booking form → B2B lead
    if (source === 'b2b-fit-call') {
      try {
        const tagRes = await fetch(`${KIT_V3_BASE}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_secret: apiSecret, tag: [{ name: 'b2b-fit-call' }] }),
        });
        const tagData = await tagRes.json();
        const tagId = tagData[0]?.id;
        if (tagId) await applyTagV3(tagId, email, apiSecret);
      } catch (e) { console.error('[subscribe] b2b-fit-call tag error:', e.message); }
    }

    // adoption-cohort-waitlist: /cohort page opt-in
    if (source === 'adoption-cohort-waitlist') {
      try {
        const tagRes = await fetch(`${KIT_V3_BASE}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_secret: apiSecret, tag: [{ name: 'adoption-cohort-waitlist' }] }),
        });
        const tagData = await tagRes.json();
        const tagId = tagData[0]?.id;
        if (tagId) await applyTagV3(tagId, email, apiSecret);
      } catch (e) { console.error('[subscribe] adoption-cohort-waitlist tag error:', e.message); }
    }

    // cohort-buyer: /access/cohort post-purchase intake (paid Cohort 01 member)
    if (source === 'cohort-buyer') {
      try {
        const tagRes = await fetch(`${KIT_V3_BASE}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_secret: apiSecret, tag: [{ name: 'cohort-01-buyer' }] }),
        });
        const tagData = await tagRes.json();
        const tagId = tagData[0]?.id;
        if (tagId) await applyTagV3(tagId, email, apiSecret);
      } catch (e) { console.error('[subscribe] cohort-buyer tag error:', e.message); }
    }

    // 4. Body-supplied tag_ids array (fixes /calc /os /voice-suite which had been silently ignored).
    for (const tagId of extraTagIds) {
      const t = parseInt(tagId, 10);
      if (Number.isFinite(t) && t > 0) await applyTagV3(t, email, apiSecret);
    }

    // 5. Body-supplied sequence_id direct enrollment.
    if (sequenceId) {
      const s = parseInt(sequenceId, 10);
      if (Number.isFinite(s) && s > 0) await enrollSequenceV3(s, email, apiSecret);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, subscriber_id: subscriberId, state: 'active' }),
    };
  } catch (err) {
    console.error('[subscribe] handler error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
