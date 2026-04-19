'use client';

import { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc, where, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';

export default function AdminDashboard() {
  const [studies, setStudies] = useState({}); // Grouped by studyId
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('individual');
  const [isProcessingAI, setIsProcessingAI] = useState(false);

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
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleWipeDatabase = async () => {
    if (!confirm("⚠️ NUCLEAR OPTION: Are you sure?")) return;
    if (!confirm("FINAL CONFIRMATION: Are you absolutely sure?")) return;
    setIsProcessingAI(true);
    try {
      const snap = await getDocs(collection(db, 'survey_responses'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setStudies({});
      alert("Database wiped.");
    } catch (error) {
      alert("Wipe failed: " + error.message);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleDelete = async (sid, data) => {
    const name = data.traditional?.formData?.name || data.chatbot?.formData?.name || data['ai-enhanced']?.formData?.name || "this participant";
    if (!confirm(`Are you sure you want to delete ALL data for ${name}?`)) return;
    try {
      const batch = writeBatch(db);
      let docsToDelete = [];
      if (sid && !sid.startsWith('legacy_')) {
        const q = query(collection(db, 'survey_responses'), where('studyId', '==', sid));
        const snap = await getDocs(q);
        docsToDelete = snap.docs;
      } else {
        const docId = sid.startsWith('legacy_') ? sid.replace('legacy_', '') : sid;
        const d = await getDocs(query(collection(db, 'survey_responses'), where('__name__', '==', docId)));
        docsToDelete = d.docs;
      }
      docsToDelete.forEach(d => batch.delete(d.ref));
      await batch.commit();
      fetchData();
      alert(`Deleted ${docsToDelete.length} records.`);
    } catch (error) {
      alert("Delete failed: " + error.message);
    }
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const interfaces = ['traditional', 'chatbot', 'ai-enhanced'];
    interfaces.forEach(intName => {
      const rows = Object.entries(studies).map(([sid, data]) => {
        const entry = data[intName];
        if (!entry) return null;
        return {
          StudyID: sid,
          Name: entry.formData?.name || "Unknown",
          PersonaID: entry.personaId,
          TimeSeconds: (entry.completionTimeMs / 1000).toFixed(1),
          Timestamp: entry.timestamp?.toDate().toLocaleString(),
          ...entry.formData
        };
      }).filter(Boolean);
      if (rows.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, intName.toUpperCase());
      }
    });
    XLSX.writeFile(workbook, `Survey_Results_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const runAIAnalysis = async () => {
    setIsProcessingAI(true);
    try {
      const updatedStudies = { ...studies };
      for (const [sid, data] of Object.entries(updatedStudies)) {
        for (const intName of ['traditional', 'chatbot', 'ai-enhanced']) {
          const entry = data[intName];
          if (entry && !entry.errorRatePercent) {
            const submittedData = intName === 'chatbot' ? { summary: entry.chatHistory?.map(m => `${m.role}: ${m.content}`).join('\n') } : entry.formData;
            const res = await fetch('/api/admin/analyze', { method: 'POST', body: JSON.stringify({ action: 'calculate_error_rate', payload: { personaId: entry.personaId, submittedData } }) });
            const result = await res.json();
            entry.errorRatePercent = result.errorRatePercent;
          }
        }
        const postSurvey = data['post-survey'];
        if (postSurvey && postSurvey.responses && !postSurvey.responses.highlightedFeedback) {
          const res = await fetch('/api/admin/analyze', { method: 'POST', body: JSON.stringify({ action: 'bold_keywords', payload: { text: postSurvey.responses.openEndedFeedback } }) });
          const result = await res.json();
          postSurvey.responses.highlightedFeedback = result.text;
        }
      }
      setStudies(updatedStudies);
      alert("AI Analysis complete!");
    } catch (error) {
      alert("AI analysis failed.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading...</div>;
  const studyIds = Object.keys(studies);

  return (
    <div style={{ maxWidth: '90rem', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800 }}>Researcher Dashboard</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleWipeDatabase} className="btn" style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', boxShadow: '0 4px 12px rgba(239,68,68,0.3)', border:'none' }}>Wipe</button>
          <button onClick={runAIAnalysis} disabled={isProcessingAI} className="btn" style={{ backgroundColor: 'var(--accent)', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', boxShadow: '0 4px 14px rgba(168,85,247,0.4)', border:'none' }}>{isProcessingAI ? 'Analyzing...' : 'Analyze'}</button>
          <button onClick={exportToExcel} className="btn" style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', border:'none' }}>Export</button>
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
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>📋 Master Participant List</h2>
            <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Study ID</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studyIds.map(sid => (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{sid}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{studies[sid].traditional?.timestamp?.toDate().toLocaleString() || "Unknown"}</td>
                      <td style={{ padding: '0.75rem 1rem' }}><span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', backgroundColor: Object.keys(studies[sid]).length >= 4 ? '#10b98122' : '#f59e0b22', color: Object.keys(studies[sid]).length >= 4 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{Object.keys(studies[sid]).length}/4 Steps</span></td>
                      <td style={{ padding: '0.75rem 1rem' }}><button onClick={() => handleDelete(sid, studies[sid])} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Delete All</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {['traditional', 'chatbot', 'ai-enhanced'].map(intName => (
            <section key={intName}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'capitalize' }}>{intName.replace('-', ' ')} Data</h2>
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Name</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>DOB</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Sex</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Reason</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Dur.</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Pain</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Meds</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Allergies</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Family Hx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studyIds.map(sid => {
                      const f = studies[sid][intName]?.formData || {};
                      if (!studies[sid][intName]) return null;
                      return (
                        <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{f.name || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.dob || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.sex || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.reasonForVisit || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.duration || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{f.painLevel ?? "N/A"}/10</td>
                          <td style={{ padding: '0.75rem 0.5rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.medications || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.allergies || "N/A"}</td>
                          <td style={{ padding: '0.75rem 0.5rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.familyHistory || "N/A"}</td>
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Error Rate (%)</h2>
            <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                  <tr><th style={{ padding: '1rem' }}>Study ID</th><th style={{ padding: '1rem' }}>Traditional</th><th style={{ padding: '1rem' }}>Chatbot</th><th style={{ padding: '1rem' }}>AI-Enhanced</th></tr>
                </thead>
                <tbody>
                  {studyIds.map(sid => (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{sid}</td>
                      <td style={{ padding: '1rem' }}>{studies[sid].traditional?.errorRatePercent ?? '-'}%</td>
                      <td style={{ padding: '1rem' }}>{studies[sid].chatbot?.errorRatePercent ?? '-'}%</td>
                      <td style={{ padding: '1rem' }}>{studies[sid]['ai-enhanced']?.errorRatePercent ?? '-'}%</td>
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
                  <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                    <tr><th style={{ padding: '0.75rem' }}>Study ID</th><th style={{ padding: '0.75rem' }}>T</th><th style={{ padding: '0.75rem' }}>C</th><th style={{ padding: '0.75rem' }}>E</th></tr>
                  </thead>
                  <tbody>
                    {studyIds.map(sid => (
                      <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{sid}</td>
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
                  <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                    <tr><th style={{ padding: '0.75rem' }}>Study ID</th><th style={{ padding: '0.75rem' }}>T</th><th style={{ padding: '0.75rem' }}>C</th><th style={{ padding: '0.75rem' }}>E</th></tr>
                  </thead>
                  <tbody>
                    {studyIds.map(sid => (
                      <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{sid}</td>
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
              <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                <tr><th style={{ padding: '1rem', width: '300px' }}>Study ID</th><th style={{ padding: '1rem' }}>Feedback</th></tr>
              </thead>
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
    </div>
  );
}
