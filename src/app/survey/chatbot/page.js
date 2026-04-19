'use client';

import { useSurvey } from '../../../context/SurveyContext';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function ChatbotInterface() {
  const { currentPersona, markPersonaAsUsed, studyId } = useSurvey();
  const router = useRouter();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm your intake assistant bot. To get started, could you please tell me your full name?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (currentPersona && !startTime) {
      setStartTime(Date.now());
    }
  }, [currentPersona, startTime]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Claude uses 'assistant' role (not 'model' like Gemini).
      // We also pass the full history so Claude has full context.
      const apiHistory = newMessages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: apiHistory, message: userMessage })
      });

      if (!res.ok) {
        // Try to get the real error from the server response body
        let errMsg = `API Error (${res.status})`;
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      
      if (data.text && data.text.includes("##INTAKE_COMPLETE##")) {
        setIsComplete(true);
        setMessages(prev => [...prev, { role: 'assistant', content: data.text.replace("##INTAKE_COMPLETE##", "").trim() }]);
      } else if (data.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      } else {
        throw new Error("Invalid response format.");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: error.message || "Sorry, I encountered an error. Could you repeat that?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!currentPersona || isSubmitting) return;
    
    setIsSubmitting(true);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("TIMEOUT")), 8000) // Increased for AI extraction
    );

    try {
      const completionTimeMs = Date.now() - startTime;
      
      // 1. EXTRACT STRUCTURED DATA FROM CHAT HISTORY
      const chatSummary = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      const extractionPrompt = `You are a data extraction bot. Below is a transcript of a clinical intake conversation.
Extract the following fields into a valid JSON object. If a field was not mentioned, use "N/A".

Fields:
- name
- dob
- sex
- reasonForVisit
- duration
- painLevel (as a number 1-10)
- medications
- allergies
- familyHistory

Transcript:
${chatSummary}

Return ONLY the JSON object.`;

      const extractRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: extractionPrompt, history: [] })
      });
      
      const extractData = await extractRes.json();
      let formData = {};
      try {
        // Find the JSON block in the AI response
        const jsonMatch = extractData.text.match(/\{[\s\S]*\}/);
        formData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch (e) {
        console.error("AI Extraction Parsing Error:", e);
      }

      // 2. SAVE TO FIRESTORE
      await Promise.race([
        addDoc(collection(db, "survey_responses"), {
          studyId,
          interface: 'chatbot',
          personaId: currentPersona.id,
          chatHistory: messages.map(m => ({ role: m.role, content: m.content })),
          formData, // Now we have actual data fields!
          completionTimeMs,
          timestamp: serverTimestamp()
        }),
        timeoutPromise
      ]);

      markPersonaAsUsed(currentPersona.id);
      router.push('/survey/ai-enhanced');
    } catch (error) {
      console.error("Submission Issue:", error);
      if (error.message === "TIMEOUT") {
        console.warn("Database hanging. Proceeding with Safety-Pass...");
        markPersonaAsUsed(currentPersona.id);
        router.push('/survey/ai-enhanced');
      } else {
        alert("DATABASE ERROR: " + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentPersona) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
        <svg style={{ width: '4rem', height: '4rem', color: 'var(--primary)', marginBottom: '1rem', opacity: 0.5 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
        </svg>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>Select a Persona</h2>
        <p style={{ color: 'var(--text-muted)' }}>Please select a persona card from the right panel to begin next interface.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem' }}>
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ChanseyBOT <span style={{ fontSize: '1.75rem' }}>🤖</span>
        </h1>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))',
        borderRadius: '0.5rem',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              borderRadius: '1rem',
              padding: '0.5rem 1rem',
              ...(msg.role === 'user'
                ? { backgroundColor: 'var(--primary)', color: 'white', borderBottomRightRadius: '0.25rem' }
                : { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--foreground)', borderBottomLeftRadius: '0.25rem' }
              ),
              whiteSpace: 'pre-wrap'
            }}>
              {msg.content.split(/(\*\*.*?\*\*)/g).map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={index}>{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '1rem', borderBottomLeftRadius: '0.25rem', padding: '0.5rem 1rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <span style={{ animation: 'bounce 1s infinite' }}>•</span>
              <span style={{ animation: 'bounce 1s infinite 0.2s' }}>•</span>
              <span style={{ animation: 'bounce 1s infinite 0.4s' }}>•</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!isComplete ? (
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Type your answer..."
            style={{
              flex: 1,
              borderRadius: '999px',
              border: '1px solid var(--input-border)',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--input-bg)',
              color: 'var(--foreground)',
              fontSize: '0.875rem'
            }}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            style={{
              backgroundColor: 'var(--primary)',
              color: 'white',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              fontSize: '1.25rem',
              opacity: (isLoading || !input.trim()) ? 0.5 : 1
            }}
          >
            ↑
          </button>
        </form>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '1rem',
          backgroundColor: 'color-mix(in srgb, var(--success) 10%, var(--card-bg))',
          border: '1px solid color-mix(in srgb, var(--success) 30%, var(--border))',
          borderRadius: '0.5rem'
        }}>
          <p style={{ color: 'var(--success)', fontWeight: 500, marginBottom: '0.75rem' }}>Intake complete! Thank you.</p>
          <button onClick={handleContinue} className="btn btn-primary" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.5 : 1 }}>
            {isSubmitting ? 'Saving...' : 'Continue to Next Interface →'}
          </button>
        </div>
      )}
    </div>
  );
}
