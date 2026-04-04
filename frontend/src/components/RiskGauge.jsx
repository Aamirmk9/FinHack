import { useState, useEffect } from 'react';

export default function RiskGauge({ value = 0, size = 180, label = 'Network Threat Level' }) {
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

  const radius = 70;
  const circumference = Math.PI * radius; // half circle
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2 + 10;

  // Color gradient based on value
  const getColor = (v) => {
    if (v >= 70) return '#ef4444';
    if (v >= 50) return '#f59e0b';
    if (v >= 30) return '#eab308';
    return '#22c55e';
  };

  const color = getColor(animatedValue);
  const riskLabel = animatedValue >= 70 ? 'CRITICAL' : animatedValue >= 50 ? 'ELEVATED' : animatedValue >= 30 ? 'MODERATE' : 'LOW';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(100, 140, 200, 0.08)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Animated arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            filter: `drop-shadow(0 0 8px ${color}66)`,
            transition: 'stroke 0.3s ease',
          }}
        />
        {/* Center value */}
        <text x={cx} y={cy - 18} textAnchor="middle" fill={color}
          fontSize="28" fontWeight="bold" fontFamily="Inter, system-ui">
          {Math.round(animatedValue)}
        </text>
        <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--text-secondary)"
          fontSize="10" fontFamily="Inter, system-ui" letterSpacing="2">
          {riskLabel}
        </text>
      </svg>
      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}
