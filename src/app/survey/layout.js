import PersonaDeck from '../../components/PersonaDeck';

export default function SurveyLayout({ children }) {
  return (
    <div style={{
      maxWidth: '80rem',
      margin: '2rem auto',
      padding: '0 1rem',
      height: 'calc(100vh - 160px)',
      display: 'flex',
      gap: '1.5rem'
    }}>
      {/* Left side: The Interface */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: 'var(--card-bg)',
        borderRadius: '0.75rem',
        boxShadow: 'var(--shadow)',
        border: '1px solid var(--border)'
      }}>
        {children}
      </div>
      
      {/* Right side: The Persona Deck */}
      <div style={{
        width: '20rem',
        flexShrink: 0,
        position: 'sticky',
        top: '2rem',
        height: 'calc(100vh - 200px)'
      }}>
        <PersonaDeck />
      </div>
    </div>
  );
}
