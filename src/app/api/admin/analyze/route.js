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

      const prompt = `You are a strict data auditor for a high-fidelity clinical research study.
Compare the "Submitted Data" against the "Target Persona" profile. Your goal is to identify factual errors.

Target Persona:
${JSON.stringify(persona, null, 2)}

Submitted Data:
${JSON.stringify(submittedData, null, 2)}

VERIFICATION CRITERIA (Total 9 Fields):
1. name: Must match exactly.
2. dob: Must match exactly (YYYY-MM-DD).
3. sex: Must match exactly.
4. reasonForVisit: Key symptoms/complaint must match. 
5. duration: Timeframe must match exactly.
6. painLevel: Must match exactly (1-10).
7. medications: Must match exactly.
8. allergies: Must match exactly.
9. familyHistory: Key details must match.

RULES:
- A field is an ERROR if it is: Missing, Factually Different, or Contradictory.
- Minor typos are okay, but different dates, names, or symptoms are NOT okay.
- If the Submitted Data is a "chatbot summary", look for the presence of these facts in the text.

TASK:
Calculate the Error Rate as: (Number of Incorrect/Missing Fields / 9) * 100.
Return ONLY a JSON object:
{
  "errorRatePercent": [number],
  "details": "[List exactly which fields were wrong and why]"
}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      
      // Robust JSON extraction
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return Response.json({ errorRatePercent: 0, details: "Parse failed" });
      
      return Response.json(JSON.parse(jsonMatch[0]));
    }

    if (action === 'bold_keywords') {
      const { text } = payload;
      
      // SKIP ANALYSIS IF BLANK OR TOO SHORT
      if (!text || text.trim().length < 5) {
        return Response.json({ text: text || '' });
      }

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
          model: 'claude-3-5-haiku-20241022',
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
