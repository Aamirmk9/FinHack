import AnimatedNumber from './AnimatedNumber';

export default function StatsCard({ label, value, subtitle, color, delay = 0 }) {
  const isNumeric = typeof value === 'number' || (!isNaN(parseFloat(value)) && !String(value).includes('%') && !String(value).includes('$'));
  const accentColor = color || '#e8ecf1';

  return (
    <div className="animate-fade-in-up" style={{
      background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
      borderRadius: 8, padding: '10px 14px', animationDelay: `${delay}ms`,
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#666', margin: '0 0 4px' }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 700, color: accentColor, margin: 0, letterSpacing: -0.3 }}>
        {isNumeric ? <AnimatedNumber value={parseFloat(value)} /> : value}
      </p>
      {subtitle && <p style={{ fontSize: 10, color: '#666', margin: '3px 0 0' }}>{subtitle}</p>}
    </div>
  );
}
