'use client';

import { useSurvey } from '../../../context/SurveyContext';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import PainSlider from '../../../components/PainSlider';
import SpeedDatePicker from '../../../components/SpeedDatePicker';

export default function TraditionalForm() {
  const { currentPersona, markPersonaAsUsed, studyId } = useSurvey();
  const router = useRouter();
  const [startTime, setStartTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    sex: '',
    reasonForVisit: '',
    duration: '',
    painLevel: '0',
    medications: '',
    allergies: '',
    familyHistory: ''
  });

  useEffect(() => {
    if (currentPersona && !startTime) {
      setStartTime(Date.now());
    }
  }, [currentPersona, startTime]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPersona || isLoading) return;

    // Strict validation to ensure no fields are skipped
    const requiredFields = ['name', 'dob', 'sex', 'reasonForVisit', 'duration', 'medications', 'allergies', 'familyHistory'];
    const isComplete = requiredFields.every(field => formData[field] && formData[field].trim() !== '');
    
    if (!isComplete) {
      alert("Please fill out all fields before continuing.");
      return;
    }

    setIsLoading(true);
    
    // Create a promise that rejects after 5 seconds
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("TIMEOUT")), 5000)
    );

    try {
      const completionTimeMs = Date.now() - startTime;
      
      // Race the database save against the 5-second timeout
      await Promise.race([
        addDoc(collection(db, "survey_responses"), {
          studyId,
          interface: 'traditional',
          personaId: currentPersona.id,
          formData: formData,
          completionTimeMs,
          timestamp: serverTimestamp()
        }),
        timeoutPromise
      ]);

      markPersonaAsUsed(currentPersona.id);
      router.push('/survey/chatbot');
    } catch (error) {
      console.error("Submission Issue:", error);
      
      if (error.message === "TIMEOUT") {
        console.warn("Database is hanging. Proceeding with Safety-Pass...");
        markPersonaAsUsed(currentPersona.id);
        router.push('/survey/chatbot');
      } else {
        alert("DATABASE ERROR: " + error.message);
      }
    } finally {
      setIsLoading(false);
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

  const inputStyle = {
    width: '100%',
    borderRadius: '0.375rem',
    border: '1px solid var(--input-border)',
    padding: '0.5rem 0.75rem',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--foreground)',
    fontSize: '0.875rem'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    marginBottom: '0.25rem'
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)' }}>Clinical Intake Form</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Date of Birth</label>
            <SpeedDatePicker name="dob" value={formData.dob} onChange={handleChange} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Gender at Birth</label>
          <select name="sex" value={formData.sex} onChange={handleChange} style={inputStyle}>
            <option value="">Select...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Primary Reason for Visit</label>
          <input type="text" name="reasonForVisit" value={formData.reasonForVisit} onChange={handleChange} style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div>
            <label style={labelStyle}>Symptom Duration</label>
            <input type="text" name="duration" value={formData.duration} onChange={handleChange} placeholder="e.g., 3 days, 2 weeks" style={inputStyle} />
          </div>
          <PainSlider value={formData.painLevel} onChange={handleChange} />
        </div>

        <div>
          <label style={labelStyle}>Current Medications</label>
          <textarea name="medications" value={formData.medications} onChange={handleChange} rows="2" style={inputStyle}></textarea>
        </div>

        <div>
          <label style={labelStyle}>Known Allergies</label>
          <textarea name="allergies" value={formData.allergies} onChange={handleChange} rows="2" style={inputStyle}></textarea>
        </div>

        <div>
          <label style={labelStyle}>Family Medical History</label>
          <textarea name="familyHistory" value={formData.familyHistory} onChange={handleChange} rows="2" style={inputStyle}></textarea>
        </div>

        <div style={{ paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="submit" 
            disabled={isLoading}
            className="btn btn-primary"
            style={{ opacity: isLoading ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
          >
            {isLoading ? 'Saving...' : 'Submit & Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
