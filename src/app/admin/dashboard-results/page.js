'use client';

import { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

export default function AdminDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const snap = await getDocs(query(collection(db, 'survey_responses'), orderBy('timestamp', 'desc')));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setData(items);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading dashboard data...</div>;

  // Aggregate Metrics
  const getAverageTime = (type) => {
    const relevant = data.filter(s => s.interface === type && s.completionTimeMs);
    if (relevant.length === 0) return "0.0";
    const total = relevant.reduce((acc, curr) => acc + curr.completionTimeMs, 0);
    return (total / relevant.length / 1000).toFixed(1); // in seconds
  };

  const getSubmissionsCount = (type) => data.filter(s => s.interface === type).length;
  
  const postSurveyResults = data.filter(s => s.interface === 'post-survey');

  const cardStyle = {
    backgroundColor: 'var(--card-bg)',
    padding: '1.5rem',
    borderRadius: '0.75rem',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-md)'
  };

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--foreground)' }}>Researcher Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Real-time metrics and feedback from the clinical intake study.</p>
      </div>
      
      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Traditional Form</h3>
          <p style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.25rem' }}>{getAverageTime('traditional')}s</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{getSubmissionsCount('traditional')} completions</p>
        </div>
        
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Chatbot</h3>
          <p style={{ fontSize: '2.25rem', fontWeight: 700, color: '#10b981', marginBottom: '0.25rem' }}>{getAverageTime('chatbot')}s</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{getSubmissionsCount('chatbot')} completions</p>
        </div>
        
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI-Enhanced Form</h3>
          <p style={{ fontSize: '2.25rem', fontWeight: 700, color: '#a855f7', marginBottom: '0.25rem' }}>{getAverageTime('ai-enhanced')}s</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{getSubmissionsCount('ai-enhanced')} completions</p>
        </div>
      </div>

      {/* Qualitative Table */}
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '1rem' }}>Qualitative Feedback</h2>
      <div style={{ 
        backgroundColor: 'var(--card-bg)', 
        borderRadius: '0.75rem', 
        border: '1px solid var(--border)', 
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'color-mix(in srgb, var(--background) 40%, var(--card-bg))', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Preference Rank</th>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Usability (T / C / E)</th>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trust (T / C / E)</th>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Open Feedback</th>
            </tr>
          </thead>
          <tbody>
            {postSurveyResults.map((ps) => (
              <tr key={ps.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>1: {ps.responses.rankFirst}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>2: {ps.responses.rankSecond}</div>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--foreground)' }}>
                  {ps.responses.usabilityTraditional} / {ps.responses.usabilityChatbot} / {ps.responses.usabilityAIEnhanced}
                </td>
                <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--foreground)' }}>
                  {ps.responses.trustTraditional} / {ps.responses.trustChatbot} / {ps.responses.trustAIEnhanced}
                </td>
                <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {ps.responses.openEndedFeedback}
                </td>
              </tr>
            ))}
            {postSurveyResults.length === 0 && (
              <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No survey results yet. Data will appear here once participants complete the study.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
