require('dotenv').config({ path: '.env.local' });
const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

async function run() {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      system_instruction: { parts: [{ text: "You are a professional Clinical Intake Assistant." }] }
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
