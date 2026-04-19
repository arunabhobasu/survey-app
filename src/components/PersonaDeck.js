'use client';

import { useSurvey } from '../context/SurveyContext';
import { useState } from 'react';

export default function PersonaDeck() {
  const { availablePersonas, currentPersona, setCurrentPersona, selectRandomPersona } = useSurvey();
  const [viewIndex, setViewIndex] = useState(0);

  if (availablePersonas.length === 0 && !currentPersona) {
    return <div style={{ color: 'var(--text-muted)' }}>No personas remaining.</div>;
  }

  const displayPersona = currentPersona || availablePersonas[viewIndex];

  const handleNext = () => {
    setViewIndex((prev) => (prev + 1) % availablePersonas.length);
  };

  const handlePrev = () => {
    setViewIndex((prev) => (prev - 1 + availablePersonas.length) % availablePersonas.length);
  };

  const handleSelect = () => {
    setCurrentPersona(availablePersonas[viewIndex]);
  };

  const btnStyle = {
    padding: '0.25rem 0.75rem',
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--border)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--foreground)',
    cursor: 'pointer',
    transition: 'all 0.15s'
  };

  return (
    <div style={{
      width: '100%',
      backgroundColor: 'var(--card-bg)',
      padding: '1rem',
      borderRadius: '0.75rem',
      boxShadow: 'var(--shadow)',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <h3 style={{
        fontSize: '1.125rem',
        fontWeight: 700,
        color: 'var(--primary)',
        marginBottom: '1rem',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '0.5rem'
      }}>
        {currentPersona ? "Active Persona" : "Persona Deck"}
      </h3>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {!currentPersona && availablePersonas.length > 1 && (
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: 'color-mix(in srgb, var(--primary) 5%, var(--card-bg))',
            borderRadius: '0.5rem',
            transform: 'scale(0.95) translateY(8px)',
            opacity: 0.5,
            zIndex: 0,
            border: '1px solid var(--border)'
          }}></div>
        )}
        
        <div style={{
          backgroundColor: 'color-mix(in srgb, #eab308 10%, var(--card-bg))',
          border: '2px solid color-mix(in srgb, #eab308 30%, var(--border))',
          borderRadius: '0.5rem',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-sm)',
          width: '100%',
          zIndex: 1,
          position: 'relative'
        }}>
          <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.75rem' }}>{displayPersona?.name}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <p><strong style={{ color: 'var(--foreground)' }}>DOB:</strong> {displayPersona?.dob}</p>
            <p><strong style={{ color: 'var(--foreground)' }}>Gender:</strong> {displayPersona?.sex}</p>
            <p style={{ paddingTop: '0.5rem', borderTop: '1px solid color-mix(in srgb, #eab308 20%, var(--border))' }}><strong style={{ color: 'var(--foreground)' }}>Reason:</strong> {displayPersona?.reasonForVisit}</p>
            <p><strong style={{ color: 'var(--foreground)' }}>Duration:</strong> {displayPersona?.duration}</p>
            <p><strong style={{ color: 'var(--foreground)' }}>Pain Level:</strong> {displayPersona?.painLevel}/10</p>
            <p style={{ paddingTop: '0.5rem', borderTop: '1px solid color-mix(in srgb, #eab308 20%, var(--border))' }}><strong style={{ color: 'var(--foreground)' }}>Meds:</strong> {displayPersona?.medications}</p>
            <p><strong style={{ color: 'var(--foreground)' }}>Allergies:</strong> {displayPersona?.allergies}</p>
            <p><strong style={{ color: 'var(--foreground)' }}>Family Hx:</strong> {displayPersona?.familyHistory}</p>
          </div>
        </div>
      </div>

      {!currentPersona && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={handlePrev} style={btnStyle}>← Prev</button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {viewIndex + 1} of {availablePersonas.length}
            </span>
            <button onClick={handleNext} style={btnStyle}>Next →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button 
              onClick={handleSelect}
              style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '0.375rem', fontWeight: 500, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
            >
              Use This
            </button>
            <button 
              onClick={selectRandomPersona}
              style={{ backgroundColor: 'var(--input-bg)', color: 'var(--foreground)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '0.375rem', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Pick Random
            </button>
          </div>
        </div>
      )}
      
      {currentPersona && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <span style={{
            display: 'inline-block',
            backgroundColor: 'color-mix(in srgb, var(--success) 15%, var(--card-bg))',
            color: 'var(--success)',
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.875rem',
            fontWeight: 500
          }}>✓ Persona Locked In</span>
        </div>
      )}
    </div>
  );
}
