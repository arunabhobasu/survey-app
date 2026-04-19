'use client';

import { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc, where, writeBatch, updateDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';

export default function AdminDashboard() {
  const [studies, setStudies] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('individual');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [debugLog, setDebugLog] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const addLog = (msg) => setDebugLog(prev => [msg, ...prev].slice(0, 5));

  async function fetchData() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'survey_responses'), orderBy('timestamp', 'desc')));
      const rawDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const grouped = {};
      rawDocs.forEach(doc => {
        const sid = doc.studyId || `legacy_${doc.id}`;
        if (!grouped[sid]) grouped[sid] = {};
        grouped[sid][doc.interface] = doc;
      });
      setStudies(grouped);
    } catch (error) {
      addLog("Fetch Error: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const runAIAnalysis = async () => {
    setIsProcessingAI(true);
    setAnalysisStatus("Initializing AI...");
    setDebugLog([]);
    
    const studyEntries = Object.entries(studies);
    const updatedStudies = { ...studies };

    for (const [sid, data] of studyEntries) {
      setAnalysisStatus(`Analyzing: ${sid}`);
      
      for (const intName of ['traditional', 'chatbot', 'ai-enhanced']) {
        const entry = data[intName];
        if (entry && entry.id && entry.personaId) {
          try {
            const facts = intName === 'chatbot' ? { chat: entry.chatHistory, extracted: entry.formData } : entry.formData;
            
            const res = await fetch('/api/admin/analyze', {
              method: 'POST',
              body: JSON.stringify({ action: 'calculate_error_rate', payload: { personaId: entry.personaId, submittedData: facts } })
            });
            
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            
            const result = await res.json();
            addLog(`Success ${sid}: ${result.errorRatePercent}%`);

            if (result.errorRatePercent !== undefined) {
              // Update state immediately
              updatedStudies[sid][intName] = { ...entry, errorRatePercent: result.errorRatePercent, details: result.details };
              setStudies({ ...updatedStudies });
              
              // Save to DB
              await updateDoc(doc(db, 'survey_responses', entry.id), { 
                errorRatePercent: result.errorRatePercent,
                details: result.details || ""
              });
            }
          } catch (err) {
            addLog(`Error ${sid}: ${err.message}`);
          }
        }
      }

      // Qualitative Feedback
      const postSurvey = data['post-survey'];
      if (postSurvey && postSurvey.id && postSurvey.responses?.openEndedFeedback) {
        try {
          const res = await fetch('/api/admin/analyze', {
            method: 'POST',
            body: JSON.stringify({ action: 'bold_keywords', payload: { text: postSurvey.responses.openEndedFeedback } })
          });
          const result = await res.json();
          if (result.text) {
            updatedStudies[sid]['post-survey'].responses.highlightedFeedback = result.text;
            setStudies({ ...updatedStudies });
            await updateDoc(doc(db, 'survey_responses', postSurvey.id), { 
              'responses.highlightedFeedback': result.text 
            });
          }
        } catch (err) {
          addLog("Qualitative Error: " + err.message);
        }
      }
    }

    setAnalysisStatus("");
    setIsProcessingAI(false);
    alert("Analysis Process Finished.");
  };

  const handleWipeDatabase = async () => {
    if (!confirm("⚠️ NUCLEAR OPTION: Are you sure?")) return;
    setIsProcessingAI(true);
    try {
      const snap = await getDocs(collection(db, 'survey_responses'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setStudies({});
      alert("Database wiped.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    ['traditional', 'chatbot', 'ai-enhanced'].forEach(intName => {
      const rows = Object.entries(studies).map(([sid, data]) => {
        const entry = data[intName];
        if (!entry) return null;
        return { StudyID: sid, Name: entry.formData?.name || "Unknown", PersonaID: entry.personaId, ErrorRate: entry.errorRatePercent, ...entry.formData };
      }).filter(Boolean);
      if (rows.length > 0) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), intName.toUpperCase());
    });
    XLSX.writeFile(workbook, `Study_Results.xlsx`);
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading Database...</div>;
  const studyIds = Object.keys(studies);

  return (
    <div style={{ maxWidth: '90rem', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800 }}>Researcher Dashboard</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            {analysisStatus && <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem' }}>🔄 {analysisStatus}</span>}
            {debugLog.length > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Last: {debugLog[0]}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleWipeDatabase} style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}>Wipe</button>
          <button onClick={runAIAnalysis} disabled={isProcessingAI} style={{ backgroundColor: 'var(--accent)', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', border: 'none', cursor: 'pointer', opacity: isProcessingAI ? 0.5 : 1 }}>{isProcessingAI ? 'Running...' : 'Analyze Data'}</button>
          <button onClick={exportToExcel} style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}>Export</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
        {['individual', 'quantitative', 'qualitative'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.75rem 0.5rem', fontWeight: 600, textTransform: 'uppercase', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}>{tab} Responses</button>
        ))}
      </div>

      {/* INDIVIDUAL TAB */}
      {activeTab === 'individual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {['traditional', 'chatbot', 'ai-enhanced'].map(intName => (
            <section key={intName}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'capitalize' }}>{intName.replace('-', ' ')} Data</h2>
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Study ID</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Name</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>DOB</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Reason</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Pain</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Meds</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Allergies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studyIds.map(sid => {
                      const entry = studies[sid][intName];
                      if (!entry) return null;
                      const f = entry.formData || {};
                      return (
                        <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{sid}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{f.name || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.dob || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.reasonForVisit || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.painLevel ?? "N/A"}/10</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.medications || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.allergies || "N/A"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* QUANTITATIVE TAB */}
      {activeTab === 'quantitative' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Completion Times (Seconds)</h2>
            <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                  <tr><th style={{ padding: '1rem' }}>Study ID</th><th style={{ padding: '1rem' }}>Traditional</th><th style={{ padding: '1rem' }}>Chatbot</th><th style={{ padding: '1rem' }}>AI-Enhanced</th></tr>
                </thead>
                <tbody>
                  {studyIds.map(sid => (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{sid}</td>
                      <td style={{ padding: '1rem' }}>{studies[sid].traditional ? (studies[sid].traditional.completionTimeMs/1000).toFixed(1) : '-'}</td>
                      <td style={{ padding: '1rem' }}>{studies[sid].chatbot ? (studies[sid].chatbot.completionTimeMs/1000).toFixed(1) : '-'}</td>
                      <td style={{ padding: '1rem' }}>{studies[sid]['ai-enhanced'] ? (studies[sid]['ai-enhanced'].completionTimeMs/1000).toFixed(1) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Error Rate (%) — Hover for Details</h2>
            <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                  <tr><th style={{ padding: '1rem' }}>Study ID</th><th style={{ padding: '1rem' }}>Traditional</th><th style={{ padding: '1rem' }}>Chatbot</th><th style={{ padding: '1rem' }}>AI-Enhanced</th></tr>
                </thead>
                <tbody>
                  {studyIds.map(sid => (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{sid}</td>
                      {['traditional', 'chatbot', 'ai-enhanced'].map(int => (
                        <td key={int} style={{ padding: '1rem' }}>
                          <div title={studies[sid][int]?.details || "No details available"} style={{ cursor: 'help', textDecoration: 'underline dotted', display: 'inline-block' }}>
                            {studies[sid][int]?.errorRatePercent !== undefined ? `${studies[sid][int].errorRatePercent.toFixed(1)}%` : '-'}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <section>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Usability Score (1-5)</h2>
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <tbody>
                    {studyIds.map(sid => (
                      <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{sid}</td>
                        <td style={{ padding: '0.75rem' }}>{studies[sid]['post-survey']?.responses?.usabilityTraditional || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{studies[sid]['post-survey']?.responses?.usabilityChatbot || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{studies[sid]['post-survey']?.responses?.usabilityAIEnhanced || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Trust Score (1-5)</h2>
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <tbody>
                    {studyIds.map(sid => (
                      <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{sid}</td>
                        <td style={{ padding: '0.75rem' }}>{studies[sid]['post-survey']?.responses?.trustTraditional || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{studies[sid]['post-survey']?.responses?.trustChatbot || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{studies[sid]['post-survey']?.responses?.trustAIEnhanced || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* QUALITATIVE TAB */}
      {activeTab === 'qualitative' && (
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Participant Feedback</h2>
          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                {studyIds.map(sid => {
                  const post = studies[sid]['post-survey']?.responses;
                  if (!post) return null;
                  const feedback = post.highlightedFeedback || post.openEndedFeedback;
                  return (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{sid}</td>
                      <td style={{ padding: '1rem', lineHeight: '1.6' }}>
                        {feedback.split(/(\*\*.*?\*\*)/g).map((part, index) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={index} style={{ color: 'var(--primary)' }}>{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* DEBUG CONSOLE */}
      {debugLog.length > 0 && (
        <div style={{ marginTop: '3rem', padding: '1rem', backgroundColor: '#1e293b', color: '#94a3b8', borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#f8fafc' }}>DEBUG LOG</div>
          {debugLog.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}
    </div>
  );
}
