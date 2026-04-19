import Link from 'next/link';

export default function LandingPage() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 80px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '3rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem', lineHeight: 1.3 }}>
          Data Collection Interface Study
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.6 }}>
          This study is being performed as part of coursework for<br />
          CAP5100 Human Computer Interaction at University of Florida
        </p>

        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontWeight: 500 }}>
          Estimated Time to Complete ~ 5 mins
        </p>

        <div>
          <Link href="/briefing" className="btn btn-primary" style={{ fontSize: '1.125rem', padding: '1rem 2.5rem' }}>
            Begin Survey
          </Link>
        </div>
      </div>
    </div>
  );
}
