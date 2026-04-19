'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ThankYouContent() {
  const searchParams = useSearchParams();
  const exited = searchParams.get('exited') === 'true';

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '28rem', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem' }}>
          Thank You for your time!
        </h1>
        {exited ? (
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Your partial responses have been recorded. We appreciate your time.
          </p>
        ) : (
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Your responses have been recorded successfully.
          </p>
        )}
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          You may now close this window.
        </p>
      </div>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: '28rem', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--foreground)' }}>Thank You for your time!</h1>
        </div>
      </div>
    }>
      <ThankYouContent />
    </Suspense>
  );
}
