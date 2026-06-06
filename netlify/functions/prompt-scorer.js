// /artifacts prompt scorer — calls Anthropic API to score a Claude prompt 0-100
// + diagnose what's broken + show how a 95+ prompt would compare.
//
// Used by /artifacts hero (replacing the old static framework reveal).
// Prerequisites: ANTHROPIC_API_KEY in Netlify env vars.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const userPrompt = (body.prompt || '').trim();
  if (userPrompt.length < 20 || userPrompt.length > 6000) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Prompt must be 20-6000 chars' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[prompt-scorer] ANTHROPIC_API_KEY not set');
    return { statusCode: 503, body: JSON.stringify({ error: 'Service not configured' }) };
  }

  const systemPrompt = `You are a senior prompt engineer who has authored 1,000+ production prompts for Anthropic, OpenAI, and major AI tooling companies. You score Claude prompts on a strict 0-100 rubric used inside the closermethod.com AI Builder Toolkit.

The 7 dimensions you score (each 0-15 points except Output Spec which is 25):

1. ROLE ANCHOR (0-15): Does the prompt set Claude's role explicitly? "Act as a senior X who specializes in Y." Generic = 0. Specific senior expert = 15.
2. CLARIFYING QUESTIONS (0-15): Does the prompt instruct Claude to ASK 3-5 clarifying questions before generating? Forces personalized output. None = 0. 3-5 questions = 15.
3. OUTPUT SPEC (0-25): Is the desired output specified concretely? Format, length, structure, sections, examples. Vague = 0. Pixel-perfect spec = 25.
4. VARIABLES (0-10): Are user variables clearly marked with [BRACKETS] for find-and-replace? None = 0. Multiple [LABELED_BRACKETS] = 10.
5. BANNED PHRASES (0-10): Does it explicitly ban AI-cliché phrases (leverage, unlock, delve, game-changer, journey, dive deep, etc.)? None = 0. 8+ banned = 10.
6. POST-DELIVERY ACTIONS (0-10): Does it instruct Claude to give specific next-action items after the main output? None = 0. 2+ specific actions = 10.
7. TONE / VOICE INSTRUCTIONS (0-15): Does it specify voice, audience, register, what to avoid? Generic = 0. Specific tone instructions with banned vibes = 15.

Voice for your output: direct, plain-spoken (Swiss-American NYC enterprise). Specific over hype. NEVER "Omggggg!" / "ladies" / "girlies" / boss-babe energy.

Return EXACTLY this JSON structure (no markdown, no preamble, valid JSON only):

{
  "overall_score": <0-100 integer>,
  "verdict_one_line": "<one-sentence honest summary, e.g. 'Solid foundation but missing the role anchor and output spec — Claude is guessing what you want.'>",
  "biggest_gap": "<the ONE dimension that is hurting most>",
  "dimensions": [
    {"name": "Role Anchor", "score": <0-15>, "max": 15, "diagnosis": "<one sentence>", "fix": "<one sentence on what to add>"},
    {"name": "Clarifying Questions", "score": <0-15>, "max": 15, "diagnosis": "...", "fix": "..."},
    {"name": "Output Spec", "score": <0-25>, "max": 25, "diagnosis": "...", "fix": "..."},
    {"name": "Variables", "score": <0-10>, "max": 10, "diagnosis": "...", "fix": "..."},
    {"name": "Banned Phrases", "score": <0-10>, "max": 10, "diagnosis": "...", "fix": "..."},
    {"name": "Post-Delivery Actions", "score": <0-10>, "max": 10, "diagnosis": "...", "fix": "..."},
    {"name": "Tone / Voice", "score": <0-15>, "max": 15, "diagnosis": "...", "fix": "..."}
  ],
  "what_95_looks_like": "<2 sentences describing what a 95+ scoring prompt for the same goal would include that theirs doesn't>",
  "rewritten_prompt": "<THE FULL 95+ REWRITTEN VERSION of the user's exact prompt. Same goal, same domain, same intent — but rewritten with: explicit senior-expert role anchor, instruction to ask 3-5 clarifying questions, concrete output spec (format, length, sections), [LABELED_BRACKETS] variables for find-and-replace, an explicit ban on AI-cliché phrases (leverage, unlock, delve, dive deep, game-changer, journey, etc.), 2+ post-delivery action items, and specific tone/voice instructions with banned vibes. Output the full rewrite as plain text the user can copy-paste directly into claude.ai. Do NOT add commentary, headers, or meta-text — JUST the rewritten prompt itself. Length should be 250-700 words. Make it tight, specific, and clearly better than what they pasted.>"
}

Dimensions sum to 100. Be HONEST not generous. Most user prompts will score 30-65. The toolkit's 24 prompts all score 95+. Make the gap visible without being mean. Plain language.

The rewritten_prompt is the highest-value artifact — it must score 95+ on the same rubric you just used. It must keep the user's actual goal/domain (don't generalize to a different topic). It must use [LABELED_BRACKETS] like [BRAND_NAME], [TARGET_AUDIENCE], [TIMEFRAME], etc. so they can adapt it. It must be in the user's apparent register but raised to senior-expert level.`;

  // Use Anthropic tool_use to FORCE structured JSON output. Eliminates parse failures.
  const scoreSchema = {
    name: 'submit_prompt_score',
    description: 'Submit the structured score for the user\'s Claude prompt.',
    input_schema: {
      type: 'object',
      properties: {
        overall_score: { type: 'integer', minimum: 0, maximum: 100 },
        verdict_one_line: { type: 'string', description: 'One-sentence honest summary.' },
        biggest_gap: { type: 'string', description: 'The ONE dimension hurting most.' },
        dimensions: {
          type: 'array',
          minItems: 7, maxItems: 7,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              score: { type: 'integer' },
              max: { type: 'integer' },
              diagnosis: { type: 'string' },
              fix: { type: 'string' }
            },
            required: ['name', 'score', 'max', 'diagnosis', 'fix']
          }
        },
        what_95_looks_like: { type: 'string' },
        rewritten_prompt: { type: 'string', description: 'The full 95+ rewrite of the user\'s exact prompt as plain text.' }
      },
      required: ['overall_score', 'verdict_one_line', 'biggest_gap', 'dimensions', 'what_95_looks_like', 'rewritten_prompt']
    }
  };

  // Helper: one Claude API call + parse + shape check. Returns {ok, parsed, reason}.
  async function runScore() {
    let resp;
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          system: systemPrompt,
          tools: [scoreSchema],
          tool_choice: { type: 'tool', name: 'submit_prompt_score' },
          messages: [{
            role: 'user',
            content: `Score this Claude prompt:\n\n${userPrompt}`
          }]
        })
      });
    } catch (e) {
      return { ok: false, retryable: true, reason: 'api_throw', err: e };
    }
    if (!resp.ok) {
      const text = await resp.text();
      // 5xx + 429 = retryable; 4xx other = not retryable
      const retryable = resp.status >= 500 || resp.status === 429;
      return { ok: false, retryable, reason: 'api_status_' + resp.status, err: text };
    }
    const data = await resp.json();
    const toolBlock = (data.content || []).find(b => b.type === 'tool_use' && b.name === 'submit_prompt_score');
    if (!toolBlock || !toolBlock.input) {
      return { ok: false, retryable: true, reason: 'no_tool_block', err: JSON.stringify(data).slice(0, 300) };
    }
    const parsed = toolBlock.input;
    if (typeof parsed.overall_score !== 'number' || !Array.isArray(parsed.dimensions) || parsed.dimensions.length !== 7) {
      return { ok: false, retryable: true, reason: 'bad_shape', err: JSON.stringify(parsed).slice(0, 300) };
    }
    return { ok: true, parsed };
  }

  // Try once, retry once on retryable errors — but NOT on 429 (an instant retry just gets 429 again).
  let result = await runScore();
  if (!result.ok && result.retryable && result.reason !== 'api_status_429') {
    console.warn('[prompt-scorer] first attempt failed (' + result.reason + '), retrying once');
    result = await runScore();
  }
  if (!result.ok) {
    console.error('[prompt-scorer] after retry: ' + result.reason, result.err);
    // 429 = upstream rate limit. Tell the user to wait rather than showing a generic error.
    if (result.reason === 'api_status_429') {
      return { statusCode: 503, headers: { 'Retry-After': '15' }, body: JSON.stringify({ error: 'High demand right now. Try again in a few seconds.' }) };
    }
    const userError = (result.reason && result.reason.startsWith('api_status_')) ? 'Scorer unavailable' : 'Score format error';
    return { statusCode: 502, body: JSON.stringify({ error: userError }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.parsed)
  };
};
