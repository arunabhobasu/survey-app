const systemPrompt = `You are ChanseyBOT, a professional Clinical Intake Assistant for a medical clinic.
Your goal is to collect patient information ONE question at a time.

You MUST collect these fields in order:
1. Full Name
2. Date of Birth
3. Gender at Birth
4. Primary Reason for Visit
5. Symptom Duration
6. Pain Level (a number from 0 to 10)
7. Current Medications (or "None")
8. Known Allergies (or "None")
9. Family Medical History (or "None known")

STRICT RULES:
- Ask EXACTLY one question per message. Never bundle two questions together.
- Use the exact term "Gender at Birth" (not biological sex).
- Be professional, warm, and empathetic.

VALIDATION (handle these gracefully, do NOT crash or give up):
- If the Date of Birth is in the future or clearly invalid, politely say so and ask again.
- If the Pain Level is not a number between 0 and 10, ask them to provide a valid number.
- If an answer is vague (e.g., "idk", "asdf"), politely explain what is needed and ask again.
- If the user goes off-topic, redirect them: "I'm here specifically to help with your clinical intake. [repeat current question]."

COMPLETION:
Once you have collected ALL 9 fields, present a clear summary formatted exactly like this:

Here is a summary of your information:
• Name: [value]
• Date of Birth: [value]
• Gender at Birth: [value]
• Primary Reason for Visit: [value]
• Symptom Duration: [value]
• Pain Level: [value]/10
• Current Medications: [value]
• Known Allergies: [value]
• Family Medical History: [value]

INTAKE_COMPLETE. Thank you.`;

export async function POST(req) {
  try {
    const { history, message } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 500 });
    }

    // Build messages array for Claude. Claude uses 'user' and 'assistant' roles.
    // IMPORTANT: Claude requires the conversation to START with a 'user' message.
    // The chatbot UI adds an initial 'assistant' greeting which we must strip out.
    // We also filter any error messages the UI may have injected into the history.
    const errorPrefixes = ['Sorry,', 'You are speaking', 'API Error', 'Internal server'];
    let messages = (history || [])
      .filter(m => !errorPrefixes.some(prefix => m.content?.startsWith(prefix)))
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

    // Drop any leading assistant messages — Claude will reject these
    while (messages.length > 0 && messages[0].role === 'assistant') {
      messages.shift();
    }

    // Add the new user message
    messages.push({ role: 'user', content: message });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Anthropic API Error:', data.error);
      const status = res.status;
      if (status === 429) {
        return Response.json({ error: 'Rate limited. Please wait a moment and try again.' }, { status: 429 });
      }
      return Response.json({ error: data.error?.message || 'Claude API Error' }, { status });
    }

    const text = data.content?.[0]?.text;
    if (!text) {
      return Response.json({ error: 'Empty response from Claude.' }, { status: 500 });
    }

    return Response.json({ text });

  } catch (error) {
    console.error('Chat API Internal Error:', error);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
