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
      
      // Group by studyId
      const grouped = {};
      rawDocs.forEach(doc => {
        // Fallback for older entries without studyId
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
    if (!confirm("⚠️ NUCLEAR OPTION: Are you sure you want to delete EVERY SINGLE record in the entire database? This will wipe all participant data forever.")) return;
    if (!confirm("FINAL CONFIRMATION: Are you absolutely sure? This cannot be undone.")) return;

    setIsProcessingAI(true); // Reuse loading state
    try {
      const snap = await getDocs(collection(db, 'survey_responses'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      setStudies({});
      alert("Database wiped successfully. You now have a blank slate.");
    } catch (error) {
      alert("Wipe failed: " + error.message);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleDelete = async (sid, data) => {
    const name = data.traditional?.formData?.name || data.chatbot?.formData?.name || data['ai-enhanced']?.formData?.name || "this participant";
    if (!confirm(`Are you sure you want to delete ALL data for ${name}? This will remove them from ALL tables (Individual, Quantitative, and Qualitative).`)) return;

    try {
      const batch = writeBatch(db);
      let docsToDelete = [];

      if (sid && !sid.startsWith('legacy_')) {
        // 1. BEST CASE: Delete by studyId (exact match for all 4 interfaces)
        const q = query(collection(db, 'survey_responses'), where('studyId', '==', sid));
        const snap = await getDocs(q);
        docsToDelete = snap.docs;
      } else if (name && name !== "Anonymous") {
        // 2. LEGACY CASE: Delete by Name (finds all docs for this person)
        // Note: We check multiple fields where the name might be stored
        const q1 = query(collection(db, 'survey_responses'), where('formData.name', '==', name));
        const snap1 = await getDocs(q1);
        docsToDelete = [...snap1.docs];
      } else {
        // 3. FALLBACK: Delete the specific single doc
        const docId = sid.startsWith('legacy_') ? sid.replace('legacy_', '') : sid;
        const d = await getDocs(query(collection(db, 'survey_responses'), where('__name__', '==', docId)));
        docsToDelete = d.docs;
      }

      if (docsToDelete.length === 0) {
        alert("Could not find related records to delete.");
        return;
      }

      docsToDelete.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      fetchData(); // Refresh UI
      alert(`Successfully deleted ${docsToDelete.length} records for ${name}.`);
    } catch (error) {
      console.error("Delete failed:", error);
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
          Participant: data.traditional?.formData?.name || "Unknown",
          PersonaID: entry.personaId,
          TimeSeconds: (entry.completionTimeMs / 1000).toFixed(1),
          Timestamp: entry.timestamp?.toDate().toLocaleString(),
          ...entry.formData,
          AI_Usage: entry.aiUsage || 0
        };
      }).filter(Boolean);
      
      if (rows.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, intName.charAt(0).toUpperCase() + intName.slice(1));
      }
    });

    XLSX.writeFile(workbook, `HCI_Survey_Results_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const runAIAnalysis = async () => {
    setIsProcessingAI(true);
    try {
      const updatedStudies = { ...studies };
      for (const [sid, data] of Object.entries(updatedStudies)) {
        for (const intName of ['traditional', 'chatbot', 'ai-enhanced']) {
          const entry = data[intName];
          if (entry && !entry.errorRatePercent) {
            const submittedData = intName === 'chatbot' 
              ? { summary: entry.chatHistory?.map(m => `${m.role}: ${m.content}`).join('\n') }
              : entry.formData;

            const res = await fetch('/api/admin/analyze', {
              method: 'POST',
              body: JSON.stringify({
                action: 'calculate_error_rate',
                payload: { personaId: entry.personaId, submittedData }
              })
            });
            const result = await res.json();
            entry.errorRatePercent = result.errorRatePercent;
            entry.errorDetails = result.details;
          }
        }
        const postSurvey = data['post-survey'];
        if (postSurvey && postSurvey.responses && !postSurvey.responses.highlightedFeedback) {
          const res = await fetch('/api/admin/analyze', {
            method: 'POST',
            body: JSON.stringify({
              action: 'bold_keywords',
              payload: { text: postSurvey.responses.openEndedFeedback }
            })
          });
          const result = await res.json();
          postSurvey.responses.highlightedFeedback = result.text;
        }
      }
      setStudies(updatedStudies);
      alert("AI Analysis complete!");
    } catch (error) {
      console.error("AI Analysis failed:", error);
      alert("AI analysis encountered an error.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading researcher dashboard...</div>;

  const studyIds = Object.keys(studies);

  return (
    <div style={{ maxWidth: '90rem', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.025em' }}>Researcher Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={handleWipeDatabase} 
            className="btn" 
            style={{ 
              backgroundColor: '#ef4444', 
              color: 'white', 
              border: 'none', 
              fontSize: '0.75rem', 
              padding: '0.4rem 1rem', 
              borderRadius: '2rem',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}
          >
            Wipe
          </button>
          <button 
            onClick={runAIAnalysis} 
            disabled={isProcessingAI} 
            className="btn" 
            style={{ 
              backgroundColor: 'var(--accent)', 
              color: 'white', 
              border: 'none', 
              fontSize: '0.75rem', 
              padding: '0.4rem 1rem', 
              borderRadius: '2rem',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)'
            }}
          >
            {isProcessingAI ? 'Analyzing...' : 'Analyze'}
          </button>
          <button 
            onClick={exportToExcel} 
            className="btn" 
            style={{ 
              backgroundColor: '#10b981', 
              color: 'white', 
              border: 'none', 
              fontSize: '0.75rem', 
              padding: '0.4rem 1rem', 
              borderRadius: '2rem',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            Export
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
        {['individual', 'quantitative', 'qualitative'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            {tab} Responses
          </button>
        ))}
      </div>

      {activeTab === 'individual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {/* MASTER PARTICIPANT LIST */}
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📋</span> Master Participant List
            </h2>
            <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflowX: 'auto', boxShadow: 'var(--shadow-sm)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Study ID</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Name</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Date & Time</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studyIds.map(sid => {
                    const data = studies[sid];
                    const mainDoc = data.traditional || data.chatbot || data['ai-enhanced'] || data['post-survey'];
                    const name = data.traditional?.formData?.name || data.chatbot?.formData?.name || data['ai-enhanced']?.formData?.name || "Anonymous";
                    const timestamp = mainDoc?.timestamp?.toDate().toLocaleString() || "Unknown";
                    const completedCount = Object.keys(data).length;
                    
                    return (
                      <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.8rem' }}>{sid}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{name}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{timestamp}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '1rem', 
                            backgroundColor: completedCount >= 4 ? '#10b98122' : '#f59e0b22',
                            color: completedCount >= 4 ? '#10b981' : '#f59e0b',
                            fontWeight: 700
                          }}>
                            {completedCount}/4 Steps
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <button onClick={() => handleDelete(sid, data)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Delete All</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {['traditional', 'chatbot', 'ai-enhanced'].map(intName => (
            <section key={intName}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: intName === 'traditional' ? 'var(--primary)' : intName === 'chatbot' ? '#10b981' : '#a855f7' }}></span>
                {intName.replace('-', ' ')} Data
              </h2>
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Participant Name</th>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Reason</th>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Pain</th>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Time (s)</th>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studyIds.map(sid => {
                      const entry = studies[sid][intName];
                      if (!entry) return null;
                      const pName = studies[sid].traditional?.formData?.name || studies[sid].chatbot?.formData?.name || "Anonymous";
                      return (
                        <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{pName}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{entry.formData?.reasonForVisit || "Collected"}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{entry.formData?.painLevel ?? "N/A"}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{(entry.completionTimeMs / 1000).toFixed(1)}s</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <button onClick={() => handleDelete(sid, studies[sid])} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
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

      {activeTab === 'quantitative' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Completion Times (Seconds)</h2>
            <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '1rem' }}>Participant</th>
                    <th style={{ padding: '1rem' }}>Traditional</th>
                    <th style={{ padding: '1rem' }}>Chatbot</th>
                    <th style={{ padding: '1rem' }}>AI-Enhanced</th>
                  </tr>
                </thead>
                <tbody>
                  {studyIds.map(sid => (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{studies[sid].traditional?.formData?.name || studies[sid].chatbot?.formData?.name || "Anon"}</td>
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
                  <tr>
                    <th style={{ padding: '1rem' }}>Participant</th>
                    <th style={{ padding: '1rem' }}>Traditional</th>
                    <th style={{ padding: '1rem' }}>Chatbot</th>
                    <th style={{ padding: '1rem' }}>AI-Enhanced</th>
                  </tr>
                </thead>
                <tbody>
                  {studyIds.map(sid => (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{studies[sid].traditional?.formData?.name || "Anon"}</td>
                      <td style={{ padding: '1rem' }}>{studies[sid].traditional?.errorRatePercent ?? '-'}%</td>
                      <td style={{ padding: '1rem' }}>{studies[sid].chatbot?.errorRatePercent ?? '-'}%</td>
                      <td style={{ padding: '1rem' }}>{studies[sid]['ai-enhanced']?.errorRatePercent ?? '-'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Preference Ranking</h2>
            <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '1rem' }}>Participant</th>
                    <th style={{ padding: '1rem' }}>Traditional</th>
                    <th style={{ padding: '1rem' }}>Chatbot</th>
                    <th style={{ padding: '1rem' }}>AI-Enhanced</th>
                  </tr>
                </thead>
                <tbody>
                  {studyIds.map(sid => {
                    const post = studies[sid]['post-survey']?.responses;
                    const getRank = (n) => post?.rankFirst === n ? '#1' : post?.rankSecond === n ? '#2' : post?.rankThird === n ? '#3' : '-';
                    return (
                      <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem', fontWeight: 600 }}>{studies[sid].traditional?.formData?.name || "Anon"}</td>
                        <td style={{ padding: '1rem' }}>{getRank('Traditional')}</td>
                        <td style={{ padding: '1rem' }}>{getRank('Chatbot')}</td>
                        <td style={{ padding: '1rem' }}>{getRank('AI-Enhanced')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          {/* Table: Usability/Trust Scores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <section>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Usability Score (1-5)</h2>
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem' }}>Participant</th>
                      <th style={{ padding: '0.75rem' }}>T</th>
                      <th style={{ padding: '0.75rem' }}>C</th>
                      <th style={{ padding: '0.75rem' }}>E</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studyIds.map(sid => {
                      const post = studies[sid]['post-survey']?.responses;
                      if (!post) return null;
                      return (
                        <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{studies[sid].traditional?.formData?.name || "Anon"}</td>
                          <td style={{ padding: '0.75rem' }}>{post.usabilityTraditional}</td>
                          <td style={{ padding: '0.75rem' }}>{post.usabilityChatbot}</td>
                          <td style={{ padding: '0.75rem' }}>{post.usabilityAIEnhanced}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Trust Score (1-5)</h2>
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem' }}>Participant</th>
                      <th style={{ padding: '0.75rem' }}>T</th>
                      <th style={{ padding: '0.75rem' }}>C</th>
                      <th style={{ padding: '0.75rem' }}>E</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studyIds.map(sid => {
                      const post = studies[sid]['post-survey']?.responses;
                      if (!post) return null;
                      return (
                        <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{studies[sid].traditional?.formData?.name || "Anon"}</td>
                          <td style={{ padding: '0.75rem' }}>{post.trustTraditional}</td>
                          <td style={{ padding: '0.75rem' }}>{post.trustChatbot}</td>
                          <td style={{ padding: '0.75rem' }}>{post.trustAIEnhanced}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'qualitative' && (
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Participant Feedback</h2>
          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '1rem', width: '200px' }}>Participant</th>
                  <th style={{ padding: '1rem' }}>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {studyIds.map(sid => {
                  const post = studies[sid]['post-survey']?.responses;
                  if (!post) return null;
                  const feedback = post.highlightedFeedback || post.openEndedFeedback;
                  return (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{studies[sid].traditional?.formData?.name || "Anon"}</td>
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
