const systemPrompt = `You are a professional Clinical Intake Assistant. 
Your goal is to collect patient information for a medical visit. 
You must collect the following information: Name, Date of Birth, Biological Sex, Primary Reason for Visit, Symptom Duration, Pain Level (0-10), Current Medications, Known Allergies, and Family Medical History.
Ask one or two questions at a time to keep it conversational.

CRITICAL GUARDRAILS:
1. You may ONLY discuss topics related to clinical intake, medical conditions, symptoms, and health history.
2. If the user asks you to write code, tell a joke, explain politics, or anything unrelated, you MUST reply with exactly: "I'm sorry, I cannot help you with that. My role is strictly to assist with your clinical intake. Let's return to your medical information. [Ask the next pending question]."
3. Do not diagnose the patient. Just collect the information.
4. Once you have collected ALL required information, summarize it and say exactly: "INTAKE_COMPLETE. Thank you."
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
