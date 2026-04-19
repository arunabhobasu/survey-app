export async function POST(req) {
  try {
    const { fieldName, helpType, currentValue, targetLanguage } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    let prompt = "";
    if (helpType === "clarify") {
      prompt = `A patient is filling out a clinical intake form. They need clarification on the field "${fieldName}". Briefly explain in plain, simple language what this field means and what kind of information is expected.`;
    } else if (helpType === "translate") {
      const lang = targetLanguage || "Spanish";
      prompt = `Translate the field name "${fieldName}" into ${lang} and provide a 1-sentence explanation in ${lang} of what it means.`;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await res.json();

    if (data.error) {
      console.error("Gemini API Assist Error:", data.error);
      return Response.json({ error: data.error.message }, { status: data.error.code || 500 });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
    return Response.json({ text: text.trim() });

  } catch (error) {
    console.error("Assist API Internal Error:", error);
    return Response.json({ error: "Failed to connect to AI service" }, { status: 500 });
  }
}
