import personas from '../../../../data/personas.json';

export async function POST(req) {
  try {
    const { action, payload } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 500 });
    }

    if (action === 'calculate_error_rate') {
      const { personaId, submittedData } = payload;
      const persona = personas.find(p => p.id === parseInt(personaId));

      if (!persona) return Response.json({ error: 'Persona not found' }, { status: 404 });

      const prompt = `You are a data validation expert for a clinical study.
Compare the "Submitted Data" against the "Target Persona" profile.

Target Persona:
${JSON.stringify(persona, null, 2)}

Submitted Data:
${JSON.stringify(submittedData, null, 2)}

TASK:
1. Identify how many of the 9 key fields (Name, DOB, Sex, Reason, Duration, Pain, Medications, Allergies, Family History) were correctly provided based on the Target Persona.
2. Correctness means the user provided the essential information from the persona. They are allowed to provide EXTRA details, but they must NOT provide LESS or WRONG information compared to the persona.
3. Calculate the Error Rate as a percentage of fields that were MISSING or INCORRECT out of the 9 fields.
4. If a field is missing, it's an error. If a field is wrong, it's an error.

Return ONLY a JSON object with this format:
{
  "errorRatePercent": [number],
  "details": "[brief explanation of errors]"
}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await res.json();
      const text = data.content?.[0]?.text;
      return Response.json(JSON.parse(text || '{}'));
    }

    if (action === 'bold_keywords') {
      const { text } = payload;
      const prompt = `Identify the 3-5 most important keywords or short phrases in the following user feedback that indicate their sentiment or specific frustration/praise.
Wrap these keywords in double asterisks like **this**.

Feedback: "${text}"

Return ONLY the modified text. Do not add any preamble or quotes.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await res.json();
      const highlightedText = data.content?.[0]?.text;
      return Response.json({ text: highlightedText || text });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Admin Analyze Error:', error);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
