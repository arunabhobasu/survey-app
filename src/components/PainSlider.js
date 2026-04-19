'use client';

export default function PainSlider({ value, onChange, name = "painLevel", showLabel = true }) {
  const numVal = parseInt(value) || 0;

  return (
    <div>
      {showLabel && (
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Pain Level (0-10)
        </label>
      )}
      <input
        type="range"
        min="0"
        max="10"
        step="1"
        name={name}
        value={numVal}
        onChange={onChange}
        className="pain-slider"
        style={{ background: 'var(--border)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
        {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
          <span
            key={n}
            style={{
              fontSize: '0.75rem',
              fontWeight: n === numVal ? 700 : 400,
              color: n === numVal ? 'var(--primary)' : 'var(--text-muted)',
              width: '20px',
              textAlign: 'center',
              transition: 'all 0.15s'
            }}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
