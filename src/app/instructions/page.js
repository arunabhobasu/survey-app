import Link from 'next/link';

export default function InstructionsPage() {
  return (
    <div style={{ maxWidth: '48rem', margin: '3rem auto', padding: '0 1rem' }}>
      <div className="card" style={{ padding: '2rem' }}>
        <h1 style={{ color: 'var(--primary)', marginBottom: '1.5rem', fontSize: '2rem', fontWeight: 700 }}>
          Instructions & Persona Cards
        </h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              The Use Case : Clinical Intake Questionnaire
            </h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              In this study you will be acting as a patient filling out a clinical intake form.
            </p>
          </section>

          <section style={{
            backgroundColor: 'color-mix(in srgb, var(--primary) 8%, var(--card-bg))',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            border: '1px solid color-mix(in srgb, var(--primary) 20%, var(--border))'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--foreground)' }}>
              Important : Use Persona Cards
            </h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
              Do <strong style={{ color: 'var(--foreground)' }}>NOT</strong> use your real medical or personal information. This study is about interaction design and we are not collecting personal data.
            </p>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, marginTop: '0.75rem' }}>
              During the survey, you will see a deck of &quot;Persona Cards&quot; on the right side of the screen. Each card contains fictional details for a specific patient. You must adopt the persona of the card you select and use its information to enter data. You can fabricate extra details but may not use real details.
            </p>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, marginTop: '0.75rem' }}>
              You are expected to adopt three <strong style={{ color: 'var(--foreground)' }}>different</strong> persona for the three interfaces.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--foreground)' }}>
              Example Persona Card
            </h2>
            <div style={{
              maxWidth: '24rem',
              backgroundColor: 'color-mix(in srgb, #eab308 10%, var(--card-bg))',
              border: '2px solid color-mix(in srgb, #eab308 30%, var(--border))',
              borderRadius: '0.5rem',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--foreground)' }}>Alex Johnson</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-muted)', listStyle: 'none' }}>
                <li><strong style={{ color: 'var(--foreground)' }}>DOB:</strong> 04/15/1982</li>
                <li><strong style={{ color: 'var(--foreground)' }}>Gender at Birth:</strong> Male</li>
                <li><strong style={{ color: 'var(--foreground)' }}>Reason for Visit:</strong> Severe lower back pain</li>
                <li><strong style={{ color: 'var(--foreground)' }}>Duration:</strong> 2 weeks</li>
                <li><strong style={{ color: 'var(--foreground)' }}>Pain Level:</strong> 8/10</li>
                <li><strong style={{ color: 'var(--foreground)' }}>Medications:</strong> Ibuprofen 400mg</li>
                <li><strong style={{ color: 'var(--foreground)' }}>Allergies:</strong> Penicillin</li>
                <li><strong style={{ color: 'var(--foreground)' }}>Family History:</strong> Father had arthritis</li>
              </ul>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem' }}>
          <Link href="/survey/traditional" className="btn btn-primary">
            Start First Interface →
          </Link>
        </div>
      </div>
    </div>
  );
}
