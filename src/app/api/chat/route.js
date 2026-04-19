const systemPrompt = `You are a professional Clinical Intake Assistant. 
Your goal is to collect patient information for a medical visit. 
You must collect the following information: Name, Date of Birth, Gender at Birth, Primary Reason for Visit, Symptom Duration, Pain Level (0-10), Current Medications, Known Allergies, and Family Medical History.

RULES:
1. Ask EXACTLY one question at a time. Do not bundle questions (e.g., do not ask for Name and DOB in the same message).
2. Use the term "Gender at Birth" when asking about sex.
3. Be professional but empathetic.

VALIDATION:
- If a user provides an invalid Date of Birth (e.g., in the future or a nonsensical date), politely ask for a correction.
- If the Pain Level is not between 0 and 10, ask the user to choose a number within that range.
- If an answer is vague or nonsensical (e.g., "I don't know" for Name), clarify that the information is required for the clinical intake.
- If the user provides a very short/unclear "Primary Reason for Visit," ask for a bit more detail (e.g., "Could you describe the pain/symptoms a bit more?").

CRITICAL GUARDRAILS:
1. You may ONLY discuss topics related to clinical intake, medical conditions, symptoms, and health history.
2. If the user asks you to write code, tell a joke, explain politics, or anything unrelated, you MUST reply with exactly: "I'm sorry, I cannot help you with that. My role is strictly to assist with your clinical intake. Let's return to your medical information. [Ask the next pending question]."
4. Once you have collected ALL required information, summarize it in a clear, vertical bulleted list (one item per line) and then say exactly: "INTAKE_COMPLETE. Thank you."
`;

export async function POST(req) {
  try {
    const { history, message } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    // Construct history for Gemini API
    const contents = (history || [])
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
      .filter((msg, index) => {
        if (index === 0 && msg.role === 'model') return false;
        return true;
      });

    // Add the current message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        system_instruction: {
          parts: [{ text: systemPrompt }]
        }
      })
    });

    const data = await res.json();

    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return Response.json({ error: data.error.message }, { status: data.error.code || 500 });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
    return Response.json({ text });

  } catch (error) {
    console.error("Chat API Internal Error:", error);
    return Response.json({ error: "Failed to connect to AI service" }, { status: 500 });
  }
}
