import Link from 'next/link';

export default function BriefingPage() {
  return (
    <div style={{ maxWidth: '48rem', margin: '3rem auto', padding: '0 1rem' }}>
      <div className="card" style={{ padding: '2rem' }}>
        <h1 style={{ color: 'var(--primary)', marginBottom: '1.5rem', fontSize: '2rem', fontWeight: 700 }}>
          Study Overview
        </h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--foreground)' }}>Goal</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              The primary goal of this research is to find out the impact of AI assistance in data collection methods.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--foreground)' }}>Overview</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              This survey makes you interact with three different interfaces of data entry one after the other.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--foreground)' }}>The Three Interfaces</h2>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <li><strong style={{ color: 'var(--foreground)' }}>Traditional Online Form</strong></li>
              <li><strong style={{ color: 'var(--foreground)' }}>AI-Powered Chatbot</strong></li>
              <li><strong style={{ color: 'var(--foreground)' }}>AI-Enhanced Online Form</strong></li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--foreground)' }}>Risk Involvement</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              This is a minimal risk study and can be completed on any computer. We do not expect any risk other than any discomfort that could arise with use of a computer. Should you want to discontinue, you can exit the survey anytime by clicking the exit survey button in the top right corner.
            </p>
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem' }}>
          <Link href="/instructions" className="btn btn-primary">
            Next →
          </Link>
        </div>
      </div>
    </div>
  );
}
