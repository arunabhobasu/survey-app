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

      const prompt = `You are a clinical data auditor. Compare the "Submitted Data" against the "Target Persona" exactly.

Target Persona:
${JSON.stringify(persona, null, 2)}

Submitted Data:
${JSON.stringify(submittedData, null, 2)}

SCORING RULES (Check these 9 fields):
1. name
2. dob
3. sex
4. reasonForVisit
5. duration
6. painLevel
7. medications
8. allergies
9. familyHistory

For EACH field, if the Submitted Data is different from the Target Persona, it is 1 Error Point.
- Missing field = 1 Error Point
- Wrong name/date/value = 1 Error Point
- Typo in symptoms = 0 Error Points (be lenient on spelling only)

TASK:
1. List each of the 9 fields and specify "OK" or "ERROR".
2. Sum the error points.
3. Calculate errorRatePercent = (Points / 9) * 100.

Return ONLY this JSON:
{
  "errorRatePercent": [number],
  "details": "[List only the fields that were errors and why]"
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
