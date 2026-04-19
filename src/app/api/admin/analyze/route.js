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

      const prompt = `CRITICAL AUDIT TASK: Compare "Submitted Data" against "Target Persona". 
You are a paranoid medical auditor. You MUST find any factual discrepancies.

TARGET PERSONA:
${JSON.stringify(persona, null, 2)}

SUBMITTED DATA:
${JSON.stringify(submittedData, null, 2)}

AUDIT STEPS:
1. Compare "name": Do they match exactly? (Ignore casing/punctuation)
2. Compare "dob": Is the date identical?
3. Compare "sex": Is it the same?
4. Compare "reasonForVisit": Are the symptoms/complaints factually the same?
5. Compare "duration": Is the timeframe identical?
6. Compare "painLevel": Is the number identical?
7. Compare "medications": Are the drug names and dosages the same?
8. Compare "allergies": Are the allergies identical?
9. Compare "familyHistory": Are the family medical details identical?

SCORING:
- Each field is worth 1 point. 
- If a field is missing or different, it is 0 points.
- If it is a perfect match, it is 1 point.

Return ONLY this JSON:
{
  "scorecard": {
    "name": "MATCH or MISMATCH",
    "dob": "MATCH or MISMATCH",
    "sex": "MATCH or MISMATCH",
    "reasonForVisit": "MATCH or MISMATCH",
    "duration": "MATCH or MISMATCH",
    "painLevel": "MATCH or MISMATCH",
    "medications": "MATCH or MISMATCH",
    "allergies": "MATCH or MISMATCH",
    "familyHistory": "MATCH or MISMATCH"
  },
  "errorRatePercent": [Calculated as: (Mismatches / 9) * 100],
  "details": "[Briefly list why each mismatch occurred]"
}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307', // Switching to the most widely available stable version
          max_tokens: 1000,
          system: "You are a data validation service. Output ONLY valid JSON.",
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await res.json();
      
      // Handle API Errors directly
      if (data.error) {
        return Response.json({ errorRatePercent: 0, details: "Anthropic API Error: " + data.error.message });
      }

      const text = data.content?.[0]?.text || '';
      
      // Robust JSON extraction
      let jsonStr = "";
      const codeBlockMatch = text.match(/```json\s?([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } else {
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) jsonStr = braceMatch[0];
      }

      if (!jsonStr) {
        return Response.json({ 
          errorRatePercent: 0, 
          details: "Invalid Format. AI said: " + (text.slice(0, 100) || "Empty Response") 
        });
      }
      
      try {
        const parsed = JSON.parse(jsonStr);
        return Response.json(parsed);
      } catch (e) {
        return Response.json({ 
          errorRatePercent: 0, 
          details: "JSON Error: " + text.slice(0, 100) 
        });
      }
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
