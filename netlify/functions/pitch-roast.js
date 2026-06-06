// /pitch-roast tool — calls Anthropic API to roast a UGC pitch + suggest the one-line fix.
// Used by /pitch-roast/index.html.
//
// Prerequisites: ANTHROPIC_API_KEY set in Netlify env vars (already exists per memory).

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const pitch = (body.pitch || '').trim();
  if (pitch.length < 30 || pitch.length > 4000) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Pitch must be 30-4000 chars' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[pitch-roast] ANTHROPIC_API_KEY not set');
    return { statusCode: 503, body: JSON.stringify({ error: 'Service not configured' }) };
  }

  const systemPrompt = `You are a senior brand-side marketing director who has read 10,000+ creator pitches and rejected 9,500. You roast bad UGC pitches with surgical specificity, then write the ONE LINE that would have closed the deal.

Your voice is direct, confident, lowercase, plain-spoken (Swiss-American NYC enterprise sales). Specifics over hype. Self-deprecation OK. NEVER use "Omggggg!", "ladies", "girlies", or boss-babe energy. You are not gushing. You are honest.

For every pitch the user pastes, return exactly this structure (plain text, no markdown headers):

ROAST: 5 specific reasons this pitch is getting deleted. Each reason is 1-2 sentences and ties to a SPECIFIC line/word/moment in their pitch (quote it briefly when possible). Examples of real failures: vague opener ("hi! i love your brand"), no proof of past results, generic praise, no specific deliverable, no specific timeline, no rate anchor, asks for a meeting before earning one, ignores brand context, sounds like every other creator.

Then a blank line.

Then write exactly:

THE ONE LINE THAT WOULD HAVE WORKED: [a single sentence that demonstrates context + proof + ask, written in the voice of someone who has read the brand's last 5 posts]

That's it. Don't add disclaimers, don't add a closing pep talk, don't add a CTA. Just the roast and the fix.`;

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Roast this pitch:\n\n${pitch}`
        }]
      })
    });
  } catch (e) {
    console.error('[pitch-roast] API call failed:', e);
    return { statusCode: 502, body: JSON.stringify({ error: 'Roaster unavailable' }) };
  }

  if (!response.ok) {
    const errBody = await response.text();
    console.error('[pitch-roast] API error:', response.status, errBody);
    return { statusCode: 502, body: JSON.stringify({ error: 'Roaster unavailable' }) };
  }

  const data = await response.json();
  const text = (data.content?.[0]?.text || '').trim();

  // Split into roast + fix
  const fixMarker = /THE ONE LINE THAT WOULD HAVE WORKED:\s*/i;
  let roast = text, fix = '';
  if (fixMarker.test(text)) {
    const parts = text.split(fixMarker);
    roast = (parts[0] || '').replace(/^ROAST:\s*/i, '').trim();
    fix = (parts[1] || '').trim();
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roast, fix })
  };
};
