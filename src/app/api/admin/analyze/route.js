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
You are an intelligent clinical auditor. Catch FACTUAL errors, but ignore "Stupid" formatting differences.

TARGET PERSONA:
${JSON.stringify(persona, null, 2)}

SUBMITTED DATA:
${JSON.stringify(submittedData, null, 2)}

INTELLIGENT AUDIT RULES:
- IGNORE Type Mismatches: "8" (string) is the SAME as 8 (number).
- IGNORE Phrasing: "None", "N/A", "None known", "No known allergies" are all IDENTICAL.
- IGNORE Missing Dosage: If the Medication Name matches, it is OK even if the dosage is missing (only flag if the dosage is WRONG).
- IGNORE Minor Suffixes: "3 days" is the same as "3 days duration".
- FOCUS ON: Wrong names, wrong dates, wrong symptoms, different pain levels, or completely different drugs.

SCORING (9 Fields):
1. name, 2. dob, 3. sex, 4. reasonForVisit, 5. duration, 6. painLevel, 7. medications, 8. allergies, 9. familyHistory

Return ONLY this JSON:
{
  "scorecard": { ...MATCH or MISMATCH for each... },
  "errorRatePercent": [Calculated as: (Mismatches / 9) * 100],
  "details": "[Explain only the REAL factual errors found]"
}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5', // Reverting to your preferred '4.5' model
          max_tokens: 1500,
          system: "You are a professional clinical data auditor. You must output ONLY a valid JSON object. No other text.",
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
