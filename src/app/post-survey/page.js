'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSurvey } from '../../context/SurveyContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

function LikertSlider({ label, name, value, onChange }) {
  const numVal = parseInt(value) || 3;
  return (
    <div style={{
      backgroundColor: 'var(--card-bg)',
      padding: '1rem 1.25rem',
      borderRadius: '0.5rem',
      border: '1px solid var(--border)'
    }}>
      <label style={{ display: 'block', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.75rem' }}>{label}</label>
      <input
        type="range"
        min="1"
        max="5"
        step="1"
        name={name}
        value={numVal}
        onChange={onChange}
        className="pain-slider"
        style={{ width: '100%' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
        {[1,2,3,4,5].map(n => (
          <span
            key={n}
            style={{
              fontSize: '0.75rem',
              fontWeight: n === numVal ? 700 : 400,
              color: n === numVal ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'all 0.15s'
            }}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PostSurvey() {
  const { studyId } = useSurvey();
  const router = useRouter();
  const [formData, setFormData] = useState({
    rankFirst: '',
    rankSecond: '',
    rankThird: '',
    usabilityTraditional: 3,
    usabilityChatbot: 3,
    usabilityAIEnhanced: 3,
    trustTraditional: 3,
    trustChatbot: 3,
    trustAIEnhanced: 3,
    openEndedFeedback: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("TIMEOUT")), 5000)
    );

    try {
      await Promise.race([
        addDoc(collection(db, "survey_responses"), {
          studyId,
          interface: 'post-survey',
          responses: formData,
          timestamp: serverTimestamp()
        }),
        timeoutPromise
      ]);
      router.push('/thank-you');
    } catch (error) {
      console.error("Submission Issue:", error);
      if (error.message === "TIMEOUT") {
        router.push('/thank-you');
      } else {
        alert("DATABASE ERROR: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    borderRadius: '0.375rem',
    border: '1px solid var(--input-border)',
    padding: '0.5rem 0.75rem',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--foreground)',
    fontSize: '0.875rem'
  };

  return (
    <div style={{ maxWidth: '48rem', margin: '3rem auto', padding: '0 1rem' }}>
      <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>Post-Survey Questionnaire</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Thank you for testing the interfaces! Please provide your feedback below.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Question 1: Ranked Choice */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--foreground)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>1. Preferences</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Please rank the interfaces based on your overall preference.</p>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>1st Choice (Most Preferred)</label>
              <select name="rankFirst" value={formData.rankFirst} onChange={handleChange} style={inputStyle}>
                <option value="">Select...</option>
                <option value="Traditional">Traditional Online Form</option>
                <option value="Chatbot">AI Chatbot</option>
                <option value="AI-Enhanced">AI-Enhanced Online Form</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>2nd Choice</label>
              <select name="rankSecond" value={formData.rankSecond} onChange={handleChange} style={inputStyle}>
                <option value="">Select...</option>
                <option value="Traditional">Traditional Online Form</option>
                <option value="Chatbot">AI Chatbot</option>
                <option value="AI-Enhanced">AI-Enhanced Online Form</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>3rd Choice (Least Preferred)</label>
              <select name="rankThird" value={formData.rankThird} onChange={handleChange} style={inputStyle}>
                <option value="">Select...</option>
                <option value="Traditional">Traditional Online Form</option>
                <option value="Chatbot">AI Chatbot</option>
                <option value="AI-Enhanced">AI-Enhanced Online Form</option>
              </select>
            </div>
          </section>

          {/* Question 2: Usability Likert */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--foreground)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>2. Usability Ratings</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Please rate how easy and intuitive each interface was to use (1 = Very Difficult, 5 = Very Easy).</p>
            </div>
            
            <LikertSlider label="Traditional Online Form" name="usabilityTraditional" value={formData.usabilityTraditional} onChange={handleChange} />
            <LikertSlider label="AI Chatbot" name="usabilityChatbot" value={formData.usabilityChatbot} onChange={handleChange} />
            <LikertSlider label="AI-Enhanced Online Form" name="usabilityAIEnhanced" value={formData.usabilityAIEnhanced} onChange={handleChange} />
          </section>

          {/* Question 3: Trust Likert */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--foreground)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>3. Trust Ratings</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>How confident do you feel that the data you entered in each interface is correct? (1 = Not Confident, 5 = Very Confident).</p>
            </div>
            
            <LikertSlider label="Traditional Online Form" name="trustTraditional" value={formData.trustTraditional} onChange={handleChange} />
            <LikertSlider label="AI Chatbot" name="trustChatbot" value={formData.trustChatbot} onChange={handleChange} />
            <LikertSlider label="AI-Enhanced Online Form" name="trustAIEnhanced" value={formData.trustAIEnhanced} onChange={handleChange} />
          </section>

          {/* Question 4: Additional Feedback */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--foreground)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>4. Additional Feedback</h2>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Why did you rank the interfaces the way you did? (Please share any thoughts on usability, design, navigation, trust, or frustration). Feel free to provide any additional insight you gained from the experience.
              </label>
              <textarea name="openEndedFeedback" value={formData.openEndedFeedback} onChange={handleChange} rows="4" style={inputStyle}></textarea>
            </div>
          </section>

          <div style={{ paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ opacity: isLoading ? 0.5 : 1 }}>
              {isLoading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
