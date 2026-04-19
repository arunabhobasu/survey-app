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

  useEffect(() => {
    fetchData();
  }, []);

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
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  }

  const runAIAnalysis = async () => {
    setIsProcessingAI(true);
    setAnalysisStatus("Analyzing data...");
    
    const studyEntries = Object.entries(studies);
    const updatedStudies = { ...studies };

    for (const [sid, data] of studyEntries) {
      setAnalysisStatus(`Processing: ${sid}`);
      
      for (const intName of ['traditional', 'chatbot', 'ai-enhanced']) {
        const entry = data[intName];
        if (entry && entry.id && entry.personaId) {
          try {
            const facts = intName === 'chatbot' ? { chat: entry.chatHistory, extracted: entry.formData } : entry.formData;
            const res = await fetch('/api/admin/analyze', {
              method: 'POST',
              body: JSON.stringify({ action: 'calculate_error_rate', payload: { personaId: entry.personaId, submittedData: facts } })
            });
            const result = await res.json();

            if (result.errorRatePercent !== undefined) {
              updatedStudies[sid][intName] = { ...entry, errorRatePercent: result.errorRatePercent, details: result.details };
              setStudies({ ...updatedStudies });
              await updateDoc(doc(db, 'survey_responses', entry.id), { 
                errorRatePercent: result.errorRatePercent,
                details: result.details || ""
              });
            }
          } catch (err) { console.error(err); }
        }
      }

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
        } catch (err) { console.error(err); }
      }
    }

    setAnalysisStatus("");
    setIsProcessingAI(false);
    alert("Full Analysis Complete.");
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
    
    // 1. Raw Response Sheets for each Interface
    ['traditional', 'chatbot', 'ai-enhanced'].forEach(intName => {
      const rows = Object.entries(studies).map(([sid, data]) => {
        const entry = data[intName];
        if (!entry) return null;
        return { 
          StudyID: sid, 
          Name: entry.formData?.name || "Unknown", 
          PersonaID: entry.personaId, 
          CompletionTimeSeconds: (entry.completionTimeMs / 1000).toFixed(1),
          ErrorRate: entry.errorRatePercent ? `${entry.errorRatePercent}%` : "0%",
          AnalysisDetails: entry.details || "",
          Timestamp: entry.timestamp?.toDate().toLocaleString(),
          ...entry.formData 
        };
      }).filter(Boolean);
      if (rows.length > 0) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), intName.toUpperCase());
    });

    // 2. Comprehensive Analytics Sheet
    const analyticsRows = Object.entries(studies).map(([sid, data]) => {
      const post = data['post-survey']?.responses || {};
      return {
        StudyID: sid,
        "Time (Trad)": data.traditional ? (data.traditional.completionTimeMs/1000).toFixed(1) : "-",
        "Time (Chat)": data.chatbot ? (data.chatbot.completionTimeMs/1000).toFixed(1) : "-",
        "Time (AI)": data['ai-enhanced'] ? (data['ai-enhanced'].completionTimeMs/1000).toFixed(1) : "-",
        "Error (Trad)": data.traditional?.errorRatePercent ? `${data.traditional.errorRatePercent}%` : "-",
        "Error (Chat)": data.chatbot?.errorRatePercent ? `${data.chatbot.errorRatePercent}%` : "-",
        "Error (AI)": data['ai-enhanced']?.errorRatePercent ? `${data['ai-enhanced'].errorRatePercent}%` : "-",
        "Usability (Trad)": post.usabilityTraditional || "-",
        "Usability (Chat)": post.usabilityChatbot || "-",
        "Usability (AI)": post.usabilityAIEnhanced || "-",
        "Trust (Trad)": post.trustTraditional || "-",
        "Trust (Chat)": post.trustChatbot || "-",
        "Trust (AI)": post.trustAIEnhanced || "-",
        "Qualitative Feedback": post.openEndedFeedback || "N/A"
      };
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(analyticsRows), "SUMMARY_ANALYTICS");

    XLSX.writeFile(workbook, `Clinical_Study_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading Database...</div>;
  const studyIds = Object.keys(studies);

  return (
    <div style={{ maxWidth: '90rem', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800 }}>Researcher Dashboard</h1>
          {analysisStatus && <p style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.5rem' }}>🔄 {analysisStatus}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleWipeDatabase} style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.2)' }}>Wipe</button>
          <button onClick={runAIAnalysis} disabled={isProcessingAI} style={{ backgroundColor: 'var(--accent)', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', border: 'none', cursor: 'pointer', opacity: isProcessingAI ? 0.5 : 1, boxShadow: '0 4px 14px rgba(168,85,247,0.3)' }}>{isProcessingAI ? 'Running...' : 'Analyze'}</button>
          <button onClick={exportToExcel} style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>Export Excel</button>
        </div>
      </div>

      {/* MASTER PARTICIPANT TABLE */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Master Participant Registry</h2>
        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ padding: '1rem' }}>Study ID</th>
                <th style={{ padding: '1rem' }}>Name</th>
                <th style={{ padding: '1rem' }}>Registration Date</th>
                <th style={{ padding: '1rem' }}>Progress</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {studyIds.map(sid => {
                const count = Object.keys(studies[sid]).filter(k => k !== 'post-survey').length;
                const main = studies[sid].traditional || studies[sid].chatbot || studies[sid]['ai-enhanced'] || {};
                return (
                  <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{sid}</td>
                    <td style={{ padding: '1rem' }}>{main.formData?.name || "Anonymous"}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{main.timestamp?.toDate().toLocaleString() || 'N/A'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ backgroundColor: count === 3 ? '#10b98120' : '#f59e0b20', color: count === 3 ? '#10b981' : '#f59e0b', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 700 }}>
                        {count}/3 Interfaces Complete
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button 
                        onClick={async () => {
                          if(!confirm("Delete this entire study record?")) return;
                          const batch = writeBatch(db);
                          Object.values(studies[sid]).forEach(entry => batch.delete(doc(db, 'survey_responses', entry.id)));
                          await batch.commit();
                          fetchData();
                        }}
                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

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
                      <th style={{ padding: '0.75rem 0.5rem' }}>Reason</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Pain</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Meds</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Allergies</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Analysis</th>
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
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.reasonForVisit || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.painLevel ?? "N/A"}/10</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.medications || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.allergies || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div title={entry.details || "No errors detected"} style={{ fontSize: '0.7rem', color: entry.errorRatePercent > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                              {entry.errorRatePercent !== undefined ? `${entry.errorRatePercent.toFixed(0)}% Error` : "Not Analyzed"}
                            </div>
                          </td>
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
                      <td style={{ padding: '1rem', width: '200px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{sid}</td>
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
    </div>
  );
}
