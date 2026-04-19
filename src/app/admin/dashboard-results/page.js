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
        const sid = doc.studyId || `legacy_${doc.id}`; // Handle older entries
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

  const handleDelete = async (studyId) => {
    if (!confirm(`Are you sure you want to delete ALL data for participant ${studyId}? This cannot be undone.`)) return;

    try {
      const batch = writeBatch(db);
      // We need to find all docs with this studyId
      const q = query(collection(db, 'survey_responses'), where('studyId', '==', studyId));
      const snap = await getDocs(q);
      snap.forEach(d => batch.delete(d.ref));
      
      await batch.commit();
      fetchData(); // Refresh
      alert("Entry deleted successfully.");
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
          PersonaID: entry.personaId,
          TimeSeconds: (entry.completionTimeMs / 1000).toFixed(1),
          Timestamp: entry.timestamp?.toDate().toLocaleString(),
          ...entry.formData, // For traditional and enhanced
          AI_Usage: entry.aiUsage || 0 // For enhanced
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
      // We'll iterate through studies and calculate error rates if they don't have them
      const updatedStudies = { ...studies };
      
      for (const [sid, data] of Object.entries(updatedStudies)) {
        for (const intName of ['traditional', 'chatbot', 'ai-enhanced']) {
          const entry = data[intName];
          if (entry && !entry.errorRatePercent) {
            // Prep the data for AI
            const submittedData = intName === 'chatbot' 
              ? { summary: entry.chatHistory.map(m => `${m.role}: ${m.content}`).join('\n') }
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
        
        // Highlight keywords in feedback
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
      alert("AI analysis encountered an error. Check console.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading researcher dashboard...</div>;

  const studyIds = Object.keys(studies);

  return (
    <div style={{ maxWidth: '90rem', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.025em' }}>Researcher Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Analyzing Clinical Intake Modalities ({studyIds.length} Participants)</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={runAIAnalysis} disabled={isProcessingAI} className="btn" style={{ backgroundColor: 'var(--accent)', color: 'white', border: 'none' }}>
            {isProcessingAI ? 'AI Analyzing...' : '✨ Run AI Analysis'}
          </button>
          <button onClick={exportToExcel} className="btn" style={{ backgroundColor: '#10b981', color: 'white', border: 'none' }}>
            📥 Export Excel (Multi-Sheet)
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
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
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab.replace('_', ' ')} Responses
          </button>
        ))}
      </div>

      {/* INDIVIDUAL TAB */}
      {activeTab === 'individual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {['traditional', 'chatbot', 'ai-enhanced'].map(intName => (
            <section key={intName}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: intName === 'traditional' ? 'var(--primary)' : intName === 'chatbot' ? '#10b981' : '#a855f7' }}></span>
                {intName.replace('-', ' ')} Interface Data
              </h2>
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflowX: 'auto', boxShadow: 'var(--shadow-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Study ID</th>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Name</th>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Reason</th>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Pain</th>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Medications</th>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studyIds.map(sid => {
                      const entry = studies[sid][intName];
                      if (!entry) return null;
                      return (
                        <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{sid.slice(-6)}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{entry.formData?.name || "See Chat"}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{entry.formData?.reasonForVisit || "Collected"}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{entry.formData?.painLevel ?? "N/A"}/10</td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.formData?.medications || "..."}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <button onClick={() => handleDelete(sid)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>Delete Study</button>
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
          {/* Table: Completion Times */}
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
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{sid.slice(-6)}</td>
                      <td style={{ padding: '1rem' }}>{studies[sid].traditional ? (studies[sid].traditional.completionTimeMs/1000).toFixed(1) : '-'}</td>
                      <td style={{ padding: '1rem' }}>{studies[sid].chatbot ? (studies[sid].chatbot.completionTimeMs/1000).toFixed(1) : '-'}</td>
                      <td style={{ padding: '1rem' }}>{studies[sid]['ai-enhanced'] ? (studies[sid]['ai-enhanced'].completionTimeMs/1000).toFixed(1) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Table: Error Rates */}
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Accuracy / Error Rate (%) 
              <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>(Run AI Analysis to populate)</span>
            </h2>
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
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{sid.slice(-6)}</td>
                      <td style={{ padding: '1rem', color: studies[sid].traditional?.errorRatePercent > 20 ? '#ef4444' : 'inherit' }}>
                        {studies[sid].traditional?.errorRatePercent ?? '-%'}
                      </td>
                      <td style={{ padding: '1rem', color: studies[sid].chatbot?.errorRatePercent > 20 ? '#ef4444' : 'inherit' }}>
                        {studies[sid].chatbot?.errorRatePercent ?? '-%'}
                      </td>
                      <td style={{ padding: '1rem', color: studies[sid]['ai-enhanced']?.errorRatePercent > 20 ? '#ef4444' : 'inherit' }}>
                        {studies[sid]['ai-enhanced']?.errorRatePercent ?? '-%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Table: Preference Ranking */}
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Interface Preference Ranking</h2>
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
                    if (!post) return null;
                    const getRank = (name) => {
                      if (post.rankFirst === name) return '#1';
                      if (post.rankSecond === name) return '#2';
                      if (post.rankThird === name) return '#3';
                      return '-';
                    };
                    return (
                      <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem', fontWeight: 500 }}>{sid.slice(-6)}</td>
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
                      <th style={{ padding: '0.75rem' }}>ID</th>
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
                          <td style={{ padding: '0.75rem', fontWeight: 500 }}>{sid.slice(-4)}</td>
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
                      <th style={{ padding: '0.75rem' }}>ID</th>
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
                          <td style={{ padding: '0.75rem', fontWeight: 500 }}>{sid.slice(-4)}</td>
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

      {/* QUALITATIVE TAB */}
      {activeTab === 'qualitative' && (
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Open-Ended Participant Feedback</h2>
          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '1rem', width: '150px' }}>Participant</th>
                  <th style={{ padding: '1rem' }}>Qualitative Feedback (Keywords Bolded by AI)</th>
                </tr>
              </thead>
              <tbody>
                {studyIds.map(sid => {
                  const post = studies[sid]['post-survey']?.responses;
                  if (!post) return null;
                  const feedback = post.highlightedFeedback || post.openEndedFeedback;
                  return (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', verticalAlign: 'top', fontWeight: 600 }}>{sid.slice(-6)}</td>
                      <td style={{ padding: '1rem', lineHeight: '1.6' }}>
                        {feedback.split(/(\*\*.*?\*\*)/g).map((part, index) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={index} style={{ color: 'var(--primary)', backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '0 2px', borderRadius: '2px' }}>{part.slice(2, -2)}</strong>;
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
