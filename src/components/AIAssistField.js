'use client';

import { useState, useEffect, useRef } from 'react';

export default function AIAssistField({ label, name, type = "text", value, onChange, onAssistTriggered, isTextarea = false, children }) {
  const [assistance, setAssistance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showTranslateInput, setShowTranslateInput] = useState(false);
  const [targetLang, setTargetLang] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowOptions(false);
        setShowTranslateInput(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const requestHelp = async (helpType, lang = '') => {
    setIsLoading(true);
    setAssistance(null);
    setShowOptions(false);
    setShowTranslateInput(false);
    onAssistTriggered();

    try {
      const res = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldName: label, helpType, currentValue: value, targetLanguage: lang })
      });
      const data = await res.json();
      if (!res.ok) {
        setAssistance(`Error: ${data.error || 'Could not load assistance.'}`);
      } else {
        setAssistance(data.text || 'No response received.');
      }
    } catch (error) {
      setAssistance("Failed to connect to AI assistant.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslateSubmit = () => {
    if (targetLang.trim()) {
      requestHelp('translate', targetLang.trim());
      setTargetLang('');
    }
  };

  // If children are provided (e.g. custom slider), render those instead of default input
  const renderInput = () => {
    if (children) return children;
    
    const InputElement = isTextarea ? "textarea" : "input";
    return (
      <InputElement
        type={isTextarea ? undefined : type}
        name={name}
        value={value}
        onChange={onChange}
        rows={isTextarea ? 2 : undefined}
        style={{
          width: '100%',
          borderRadius: '0.375rem',
          border: '1px solid var(--input-border)',
          padding: '0.5rem 0.75rem',
          backgroundColor: 'var(--input-bg)',
          color: 'var(--foreground)',
          fontSize: '0.875rem'
        }}
      />
    );
  };

  return (
    <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>{label}</label>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            type="button"
            onClick={() => { setShowOptions(!showOptions); setShowTranslateInput(false); }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.75rem',
              color: 'var(--primary)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: 'pointer'
            }}
          >
            ✨ AI Help
          </button>
          
          {showOptions && (
            <div style={{
              position: 'absolute',
              right: 0,
              marginTop: '0.25rem',
              width: '8rem',
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '0.375rem',
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
              padding: '0.25rem 0'
            }}>
              <button type="button" onClick={() => requestHelp('clarify')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>Clarify</button>
              <button type="button" onClick={() => { setShowTranslateInput(true); setShowOptions(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>Translate</button>
            </div>
          )}
        </div>
      </div>

      {showTranslateInput && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            placeholder="Target language (e.g. Spanish)"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTranslateSubmit(); }}}
            style={{
              flex: 1,
              borderRadius: '0.375rem',
              border: '1px solid var(--input-border)',
              padding: '0.375rem 0.75rem',
              backgroundColor: 'var(--input-bg)',
              color: 'var(--foreground)',
              fontSize: '0.75rem'
            }}
          />
          <button type="button" onClick={handleTranslateSubmit} style={{
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.375rem 0.75rem',
            fontSize: '0.75rem',
            cursor: 'pointer'
          }}>Go</button>
        </div>
      )}
      
      {renderInput()}

      {isLoading && (
        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem' }}>AI is thinking...</div>
      )}

      {assistance && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.75rem',
          backgroundColor: 'color-mix(in srgb, var(--primary) 10%, var(--card-bg))',
          border: '1px solid color-mix(in srgb, var(--primary) 25%, var(--border))',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          color: 'var(--foreground)',
          position: 'relative'
        }}>
          <button type="button" onClick={() => setAssistance(null)} style={{ position: 'absolute', top: '0.25rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
          <span style={{ fontWeight: 600, marginRight: '0.25rem' }}>✨ AI:</span> {assistance}
        </div>
      )}
    </div>
  );
}
