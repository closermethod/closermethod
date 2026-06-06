exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Valid email required' }) };
    }

    const apiSecret = process.env.KIT_API_SECRET;

    // Subscribe to the main form
    await fetch('https://api.convertkit.com/v3/forms/9259574/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_secret: apiSecret, email: email })
    }).catch(() => {});

    // Tag as closerai-buyer (create this tag in Kit first, or it auto-creates)
    // Using tag endpoint - Kit will create the tag if it doesn't exist
    // For now, use a known tag approach: subscribe to form + tag
    const tagResponse = await fetch('https://api.convertkit.com/v3/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_secret: apiSecret,
        tag: { name: 'closerai-buyer' }
      })
    });

    let tagId;
    if (tagResponse.ok) {
      const tagData = await tagResponse.json();
      tagId = tagData.id || (tagData.tag && tagData.tag.id);
    }

    // If we got a tag ID, apply it to the subscriber
    if (tagId) {
      await fetch(`https://api.convertkit.com/v3/tags/${tagId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_secret: apiSecret, email: email })
      }).catch(() => {});
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
