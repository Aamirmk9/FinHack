import { useState, useEffect } from 'react';

export default function RiskGauge({ value = 0, size = 160, label = 'Threat Level' }) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedValue(eased * value);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  const radius = 60;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2 + 8;

  const getColor = (v) => {
    if (v >= 70) return '#ef4444';
    if (v >= 50) return '#f97316';
    if (v >= 30) return '#eab308';
    return '#22c55e';
  };

  const color = getColor(animatedValue);
  const riskLabel = animatedValue >= 70 ? 'CRITICAL' : animatedValue >= 50 ? 'HIGH' : animatedValue >= 30 ? 'MODERATE' : 'NORMAL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size * 0.55} viewBox={`0 0 ${size} ${size * 0.55}`}>
        <path d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" strokeLinecap="round" />
        <path d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          style={{ filter: `drop-shadow(0 0 6px ${color}44)`, transition: 'stroke 0.3s' }} />
        <text x={cx} y={cy - 16} textAnchor="middle" fill="#e0e0e0"
          fontSize="24" fontWeight="700" fontFamily="Inter, system-ui">{Math.round(animatedValue)}%</text>
        <text x={cx} y={cy - 1} textAnchor="middle" fill={color}
          fontSize="9" fontFamily="Inter, system-ui" letterSpacing="1.5" fontWeight="600">{riskLabel}</text>
      </svg>
      <p style={{ fontSize: 9, color: '#666', marginTop: 2, fontWeight: 500 }}>{label}</p>
    </div>
  );
}
