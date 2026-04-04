import AnimatedNumber from './AnimatedNumber';

export default function StatsCard({ label, value, subtitle, color, delay = 0 }) {
  const isNumeric = typeof value === 'number' || (!isNaN(parseFloat(value)) && !String(value).includes('%') && !String(value).includes('$'));

  return (
    <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: color || 'var(--text-primary)' }}>
        {isNumeric ? <AnimatedNumber value={parseFloat(value)} /> : value}
      </p>
      {subtitle && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
      )}
    </div>
  );
}
