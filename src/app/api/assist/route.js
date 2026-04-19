export async function POST(req) {
  try {
    const { fieldName, helpType, currentValue, targetLanguage } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 500 });
    }

    let prompt = '';

    if (helpType === 'clarify') {
      prompt = `You are a helpful clinical intake assistant. A patient is filling out a medical form and needs help with the field: "${fieldName}".

Their current input is: "${currentValue || '(empty)'}"

In 2-3 short sentences:
1. Explain in plain language what this field is asking for.
2. If their current input looks invalid (e.g. a future date for Date of Birth, a non-number for Pain Level, or gibberish), politely point that out.
Keep it friendly and simple.`;
    } else if (helpType === 'translate') {
      const lang = targetLanguage || 'Spanish';
      prompt = `Translate the clinical form field name "${fieldName}" into ${lang}. Then write one sentence in ${lang} explaining what information should go in this field. Keep it simple for a patient.`;
    } else {
      return Response.json({ error: 'Unknown helpType.' }, { status: 400 });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Anthropic Assist Error:', data.error);
      return Response.json({ error: data.error?.message || 'Claude API Error' }, { status: res.status });
    }

    const text = data.content?.[0]?.text?.trim();
    return Response.json({ text: text || 'No response.' });

  } catch (error) {
    console.error('Assist API Internal Error:', error);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
