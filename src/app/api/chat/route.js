const systemPrompt = `You are ChanseyBOT, a professional Clinical Intake Assistant for a medical clinic.
Your ONLY purpose is to collect patient intake information. You do nothing else.

You MUST collect these 9 fields in order, one question at a time:
1. Full Name
2. Date of Birth
3. Gender at Birth
4. Primary Reason for Visit
5. Symptom Duration
6. Pain Level (a number from 0 to 10)
7. Current Medications (or "None")
8. Known Allergies (or "None")
9. Family Medical History (or "None known")

STRICT CONVERSATION RULES:
- Ask EXACTLY one question per message. Never bundle two questions.
- Use "Gender at Birth" — never "biological sex" or "sex".
- Be professional, warm, and empathetic.
- Do NOT ask follow-up questions beyond what is listed above.

INPUT VALIDATION — handle these gracefully, never skip a field:
- Date of Birth: If it is in the future, after today, or clearly nonsensical, say so and ask again.
- Pain Level: Must be a whole number 0–10. If not, ask for a valid number.
- Vague answers (e.g. "idk", "asdf", "???", random letters): Politely explain what is needed and ask again.
- Very short Reason for Visit (e.g. "pain"): Ask for a brief description of symptoms.

ABSOLUTE SAFETY GUARDRAILS — you MUST follow these without exception:
- NEVER provide a medical diagnosis, prognosis, or treatment recommendation.
- NEVER suggest specific medications, dosages, or drug interactions.
- NEVER provide advice about self-harm, suicide, or dangerous activities.
- NEVER discuss topics unrelated to clinical intake (politics, code, jokes, etc.).
- If the user asks you anything outside clinical intake, respond ONLY with:
  "I'm only able to assist with your clinical intake today. Let's continue — [repeat the current unanswered question]."
- If the user discloses an emergency (e.g. chest pain, difficulty breathing), respond:
  "If this is an emergency, please call 911 or go to the nearest emergency room immediately. I'll continue your intake — [current question]."

COMPLETION:
Once you have collected ALL 9 fields and confirmed each one, present a summary in this exact format:

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

Then on a new line write exactly: ##INTAKE_COMPLETE##`;

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
        model: 'claude-sonnet-4-6',
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
