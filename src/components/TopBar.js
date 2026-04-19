'use client';

import { useTheme } from '../context/ThemeContext';
import { useRouter, usePathname } from 'next/navigation';

export default function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Hide on landing page and admin
  if (pathname === '/' || pathname.startsWith('/admin')) {
    return null;
  }

  const handleExit = () => {
    if (confirm('Are you sure you want to exit the survey? Your progress will be saved as incomplete.')) {
      console.log("Mock Firebase: marking submission as incomplete");
      router.push('/thank-you?exited=true');
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backgroundColor: 'var(--background)',
      borderBottom: '1px solid var(--border)'
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '0.5rem',
          color: 'var(--foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          fontSize: '1.1rem',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Exit survey */}
      <button
        onClick={handleExit}
        title="Exit Survey"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '0.5rem',
          color: 'var(--error)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          fontSize: '1.1rem',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        ✕
      </button>
    </div>
  );
}
