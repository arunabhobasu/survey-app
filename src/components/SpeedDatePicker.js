'use client';

import { useState, useEffect } from 'react';

export default function SpeedDatePicker({ value, onChange, name }) {
  const [parts, setParts] = useState({
    month: '',
    day: '',
    year: ''
  });

  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-');
      setParts({ year: y, month: m, day: d });
    }
  }, [value]);

  const handlePartChange = (part, val) => {
    const newParts = { ...parts, [part]: val };
    setParts(newParts);

    const formattedDate = `${newParts.year}-${newParts.month}-${newParts.day}`;
    onChange({ target: { name, value: formattedDate } });
  };

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 100; y--) {
    years.push(y);
  }

  const months = [
    { v: '01', n: 'Jan' }, { v: '02', n: 'Feb' }, { v: '03', n: 'Mar' },
    { v: '04', n: 'Apr' }, { v: '05', n: 'May' }, { v: '06', n: 'Jun' },
    { v: '07', n: 'Jul' }, { v: '08', n: 'Aug' }, { v: '09', n: 'Sep' },
    { v: '10', n: 'Oct' }, { v: '11', n: 'Nov' }, { v: '12', n: 'Dec' }
  ];

  const days = [];
  const daysInMonth = parts.year && parts.month ? new Date(parts.year, parts.month, 0).getDate() : 31;
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d.toString().padStart(2, '0'));
  }

  const selectStyle = {
    flex: 1,
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--input-border)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    cursor: 'pointer'
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <select 
        value={parts.month} 
        onChange={(e) => handlePartChange('month', e.target.value)}
        style={selectStyle}
      >
        <option value="">Month</option>
        {months.map(m => <option key={m.v} value={m.v}>{m.n}</option>)}
      </select>

      <select 
        value={parts.day} 
        onChange={(e) => handlePartChange('day', e.target.value)}
        style={selectStyle}
      >
        <option value="">Day</option>
        {days.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      <select 
        value={parts.year} 
        onChange={(e) => handlePartChange('year', e.target.value)}
        style={selectStyle}
      >
        <option value="">Year</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
