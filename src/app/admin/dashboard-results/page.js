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
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const runAIAnalysis = async () => {
    setIsProcessingAI(true);
    setAnalysisStatus("Analyzing data...");
    const updatedStudies = { ...studies };
    for (const [sid, data] of Object.entries(studies)) {
      setAnalysisStatus(`Processing: ${sid}`);
      for (const intName of ['traditional', 'chatbot', 'ai-enhanced']) {
        const entry = data[intName];
        if (entry && entry.id && entry.personaId) {
          try {
            const facts = intName === 'chatbot' ? { chat: entry.chatHistory, extracted: entry.formData } : entry.formData;
            const res = await fetch('/api/admin/analyze', { method: 'POST', body: JSON.stringify({ action: 'calculate_error_rate', payload: { personaId: entry.personaId, submittedData: facts } }) });
            const result = await res.json();
            if (result.errorRatePercent !== undefined) {
              updatedStudies[sid][intName] = { ...entry, errorRatePercent: result.errorRatePercent, details: result.details };
              setStudies({ ...updatedStudies });
              await updateDoc(doc(db, 'survey_responses', entry.id), { errorRatePercent: result.errorRatePercent, details: result.details || "" });
            }
          } catch (err) { console.error(err); }
        }
      }
      const postSurvey = data['post-survey'];
      if (postSurvey?.id && postSurvey.responses?.openEndedFeedback) {
        try {
          const res = await fetch('/api/admin/analyze', { method: 'POST', body: JSON.stringify({ action: 'bold_keywords', payload: { text: postSurvey.responses.openEndedFeedback } }) });
          const result = await res.json();
          if (result.text) {
            updatedStudies[sid]['post-survey'].responses.highlightedFeedback = result.text;
            setStudies({ ...updatedStudies });
            await updateDoc(doc(db, 'survey_responses', postSurvey.id), { 'responses.highlightedFeedback': result.text });
          }
        } catch (err) { console.error(err); }
      }
    }
    setAnalysisStatus("");
    setIsProcessingAI(false);
    alert("Analysis Complete.");
  };

  const handleWipeDatabase = async () => {
    if (!confirm("⚠️ Are you sure?")) return;
    setIsProcessingAI(true);
    try {
      const snap = await getDocs(collection(db, 'survey_responses'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setStudies({});
      alert("Database wiped.");
    } finally { setIsProcessingAI(false); }
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    ['traditional', 'chatbot', 'ai-enhanced'].forEach(intName => {
      const rows = Object.entries(studies).map(([sid, data]) => {
        const entry = data[intName];
        if (!entry) return null;
        return { StudyID: sid, Name: entry.formData?.name || "Unknown", PersonaID: entry.personaId, TimeS: (entry.completionTimeMs/1000).toFixed(1), Error: `${entry.errorRatePercent||0}%`, ...entry.formData };
      }).filter(Boolean);
      if (rows.length > 0) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), intName.toUpperCase());
    });
    const summary = Object.entries(studies).map(([sid, data]) => {
      const p = data['post-survey']?.responses || {};
      return { StudyID: sid, 
        Time_T: data.traditional?.completionTimeMs/1000, Time_C: data.chatbot?.completionTimeMs/1000, Time_AI: data['ai-enhanced']?.completionTimeMs/1000,
        Err_T: data.traditional?.errorRatePercent, Err_C: data.chatbot?.errorRatePercent, Err_AI: data['ai-enhanced']?.errorRatePercent,
        Usability_T: p.usabilityTraditional, Usability_C: p.usabilityChatbot, Usability_AI: p.usabilityAIEnhanced,
        Feedback: p.openEndedFeedback
      };
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "SUMMARY");
    XLSX.writeFile(workbook, `Study_Export.xlsx`);
  };

  const studyIds = Object.keys(studies);
  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '95rem', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Researcher Dashboard</h1>
          {analysisStatus && <p style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>🔄 {analysisStatus}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleWipeDatabase} style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', border: 'none' }}>Wipe</button>
          <button onClick={runAIAnalysis} disabled={isProcessingAI} style={{ backgroundColor: 'var(--accent)', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', border: 'none' }}>Analyze</button>
          <button onClick={exportToExcel} style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', border: 'none' }}>Export Excel</button>
        </div>
      </div>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Master Participant Registry</h2>
        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'color-mix(in srgb, var(--background) 50%, var(--card-bg))' }}>
              <tr><th style={{ padding: '1rem' }}>Study ID</th><th style={{ padding: '1rem' }}>Name</th><th style={{ padding: '1rem' }}>Progress</th><th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {studyIds.map(sid => {
                const count = Object.keys(studies[sid]).filter(k => k !== 'post-survey').length;
                const main = studies[sid].traditional || studies[sid].chatbot || studies[sid]['ai-enhanced'] || {};
                return (
                  <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{sid}</td>
                    <td style={{ padding: '1rem' }}>{main.formData?.name || "Anonymous"}</td>
                    <td style={{ padding: '1rem' }}><span style={{ padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.7rem', backgroundColor: '#eee' }}>{count}/3 Steps</span></td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}><button onClick={async () => { if(!confirm("Delete?")) return; const batch = writeBatch(db); Object.values(studies[sid]).forEach(e => batch.delete(doc(db, 'survey_responses', e.id))); await batch.commit(); fetchData(); }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
        {['individual', 'quantitative', 'qualitative'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.75rem 0.5rem', fontWeight: 600, background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)' }}>{tab.toUpperCase()}</button>
        ))}
      </div>

      {activeTab === 'individual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {['traditional', 'chatbot', 'ai-enhanced'].map(intName => (
            <section key={intName}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'capitalize' }}>{intName} Results</h2>
              <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.5rem' }}>Study ID</th>
                      <th style={{ padding: '0.5rem' }}>Name</th>
                      <th style={{ padding: '0.5rem' }}>DOB</th>
                      <th style={{ padding: '0.5rem' }}>Sex</th>
                      <th style={{ padding: '0.5rem' }}>Reason</th>
                      <th style={{ padding: '0.5rem' }}>Duration</th>
                      <th style={{ padding: '0.5rem' }}>Pain</th>
                      <th style={{ padding: '0.5rem' }}>Meds</th>
                      <th style={{ padding: '0.5rem' }}>Allergies</th>
                      <th style={{ padding: '0.5rem' }}>Family</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studyIds.map(sid => {
                      const f = studies[sid][intName]?.formData || {};
                      if (!studies[sid][intName]) return null;
                      return (
                        <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{sid}</td>
                          <td style={{ padding: '0.5rem' }}>{f.name}</td>
                          <td style={{ padding: '0.5rem' }}>{f.dob}</td>
                          <td style={{ padding: '0.5rem' }}>{f.sex}</td>
                          <td style={{ padding: '0.5rem' }}>{f.reasonForVisit}</td>
                          <td style={{ padding: '0.5rem' }}>{f.duration}</td>
                          <td style={{ padding: '0.5rem' }}>{f.painLevel}</td>
                          <td style={{ padding: '0.5rem' }}>{f.medications}</td>
                          <td style={{ padding: '0.5rem' }}>{f.allergies}</td>
                          <td style={{ padding: '0.5rem' }}>{f.familyHistory}</td>
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
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Metrics (Time in Sec / Error %)</h2>
            <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr><th style={{ padding: '1rem' }}>Study ID</th><th style={{ padding: '1rem' }}>Traditional (T/E)</th><th style={{ padding: '1rem' }}>Chatbot (T/E)</th><th style={{ padding: '1rem' }}>AI (T/E)</th></tr>
                </thead>
                <tbody>
                  {studyIds.map(sid => (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{sid}</td>
                      {['traditional', 'chatbot', 'ai-enhanced'].map(int => {
                        const e = studies[sid][int];
                        return <td key={int} style={{ padding: '1rem' }}>{e ? `${(e.completionTimeMs/1000).toFixed(1)}s / ${e.errorRatePercent||0}%` : '-'}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <section>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Usability (1-5)</h2>
              <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
                {studyIds.map(sid => { const p = studies[sid]['post-survey']?.responses || {}; return <div key={sid} style={{ padding: '0.5rem', borderBottom: '1px solid #eee', fontSize: '0.8rem' }}>{sid}: {p.usabilityTraditional||'-'} | {p.usabilityChatbot||'-'} | {p.usabilityAIEnhanced||'-'}</div>})}
              </div>
            </section>
            <section>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Trust (1-5)</h2>
              <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
                {studyIds.map(sid => { const p = studies[sid]['post-survey']?.responses || {}; return <div key={sid} style={{ padding: '0.5rem', borderBottom: '1px solid #eee', fontSize: '0.8rem' }}>{sid}: {p.trustTraditional||'-'} | {p.trustChatbot||'-'} | {p.trustAIEnhanced||'-'}</div>})}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'qualitative' && (
        <section>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Participant Feedback</h2>
          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '0.75rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <tbody>
                {studyIds.map(sid => {
                  const p = studies[sid]['post-survey']?.responses;
                  if (!p) return null;
                  const f = p.highlightedFeedback || p.openEndedFeedback;
                  return (
                    <tr key={sid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', width: '150px', fontWeight: 600 }}>{sid}</td>
                      <td style={{ padding: '1rem', lineHeight: '1.5' }}>
                        {f.split(/(\*\*.*?\*\*)/g).map((part, i) => part.startsWith('**') ? <strong key={i} style={{color:'var(--primary)'}}>{part.slice(2,-2)}</strong> : part)}
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
