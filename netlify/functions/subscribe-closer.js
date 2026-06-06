exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { email, first_name, tag, fields: extraFields } = JSON.parse(event.body);

    if (!email || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Valid email required' }) };
    }

    const apiSecret = process.env.KIT_API_SECRET;

    // If this is just a tag update (e.g., gate-abandon), skip form subscription
    if (tag === 'gate-abandon') {
      // Update the subscriber's fields to flag them for abandoned gate recovery
      await fetch('https://api.convertkit.com/v3/forms/9259574/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_secret: apiSecret,
          email: email,
          fields: { source: 'closer-app', gate_abandon: 'true' }
        })
      }).catch(() => {});
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    // Subscribe to the waitlist form with first name and source field
    const formFields = { source: 'closer-app' };
    // Pass through UTM fields if present
    if (extraFields) {
      if (extraFields.utm_source) formFields.utm_source = extraFields.utm_source;
      if (extraFields.utm_medium) formFields.utm_medium = extraFields.utm_medium;
      if (extraFields.utm_campaign) formFields.utm_campaign = extraFields.utm_campaign;
    }
    const formBody = {
      api_secret: apiSecret,
      email: email,
      fields: formFields
    };
    if (first_name) {
      formBody.first_name = first_name;
    }

    const formResponse = await fetch('https://api.convertkit.com/v3/forms/9259574/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formBody)
    });

    if (!formResponse.ok) {
      return { statusCode: formResponse.status, body: JSON.stringify({ error: 'Subscription failed' }) };
    }

    // Apply waitlist tag (18168606)
    await fetch('https://api.convertkit.com/v3/tags/18168606/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_secret: apiSecret, email: email })
    }).catch(() => {});

    // Apply calculator_user tag (16838323) to trigger Rate Calculator → Closer Kit nurture sequence
    await fetch('https://api.convertkit.com/v3/tags/16838323/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_secret: apiSecret, email: email })
    }).catch(() => {});

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
