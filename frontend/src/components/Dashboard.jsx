import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, Legend,
} from 'recharts';
import { fetchStats, fetchAlerts, fetchCompare, fetchChartData } from '../api/client';
import { formatCurrency, riskColor } from '../utils/formatters';
import StatsCard from './StatsCard';
import AnimatedNumber from './AnimatedNumber';
import useWebSocket from '../hooks/useWebSocket';

const RISK_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#16a34a',
};



const tt = {
  background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', color: '#bbb',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [compare, setCompare] = useState(null);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [radarData, setRadarData] = useState([]);
  const navigate = useNavigate();
  const { lastUpdate } = useWebSocket();

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
    fetchAlerts(100).then(setAlerts).catch(() => {});
    fetchCompare().then(setCompare).catch(() => {});
    fetchChartData().then(data => {
      if (data.monthly_timeline) setActivityData(data.monthly_timeline);
      if (data.typology_coverage) {
        setRadarData(data.typology_coverage.map(t => ({
          category: t.name,
          fullName: t.name,
          detected: t.detected,
          baseline: t.baseline,
        })));
      }
    }).catch(() => {});
  }, []);

  const [alertBanner, setAlertBanner] = useState(null);

  useEffect(() => {
    if (lastUpdate && lastUpdate.type === 'transaction_injected') {
      fetchStats().then(setStats);
      fetchAlerts(10).then(setAlerts);
      if (lastUpdate.alert) {
        setLiveAlerts(prev => [{
          ...lastUpdate.alert,
          total_volume: lastUpdate.transaction.amount,
          flags: [...(lastUpdate.sender.flags || []), ...(lastUpdate.receiver.flags || [])],
          timestamp: Date.now(),
        }, ...prev.slice(0, 4)]);

        // Show fullscreen alert banner
        setAlertBanner({
          ...lastUpdate.alert,
          amount: lastUpdate.transaction.amount,
          from: lastUpdate.transaction.from_address,
          to: lastUpdate.transaction.to_address,
        });
        // Auto-dismiss after 8 seconds
        setTimeout(() => setAlertBanner(null), 8000);
      }
    }
  }, [lastUpdate]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#666' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: '#333333', borderTopColor: 'transparent' }} />
          <p style={{ fontSize: 12 }}>Initializing pipeline...</p>
        </div>
      </div>
    );
  }

  // Score bar: compute overall "grade"
  const totalWallets = stats.total_wallets || 1;
  const riskyWallets = (stats.critical_wallets || 0) + stats.high_risk_wallets + stats.medium_risk_wallets;
  const riskRatio = riskyWallets / totalWallets;
  const scorePercent = Math.max(0, Math.min(100, Math.round(100 - riskRatio * 100)));
  // Grade thresholds — equal segments on the bar (each ~16.7% width)
  const GRADES = [
    { min: 83.4, letter: 'A+', label: 'Excellent', color: '#15803d' },
    { min: 66.7, letter: 'A',  label: 'Strong',    color: '#22c55e' },
    { min: 50.0, letter: 'B',  label: 'Adequate',  color: '#a3e635' },
    { min: 33.3, letter: 'C',  label: 'Fair',      color: '#eab308' },
    { min: 16.7, letter: 'D',  label: 'Poor',      color: '#ea580c' },
    { min: 0,    letter: 'F',  label: 'Critical',  color: '#dc2626' },
  ];
  const grade = GRADES.find(g => scorePercent >= g.min) || GRADES[GRADES.length - 1];
  const gradeColor = grade.color;

  const riskDist = [
    { name: 'Critical', value: stats.critical_wallets, color: RISK_COLORS.critical },
    { name: 'High', value: stats.high_risk_wallets, color: RISK_COLORS.high },
    { name: 'Medium', value: stats.medium_risk_wallets, color: RISK_COLORS.medium },
    { name: 'Elevated', value: stats.elevated_risk_wallets, color: '#eab308' },
  ].filter(d => d.value > 0);

  const allAlerts = [
    ...liveAlerts.map(a => ({ ...a, isLive: true })),
    ...alerts.filter(a => !liveAlerts.find(la => la.cluster_id === a.cluster_id)),
  ];

  // ML accuracy bar segments
  const mlMetrics = stats.ml_metrics;

  return (
    <>
    {/* ═══ FULLSCREEN ALERT BANNER ═══ */}
    {alertBanner && (
      <div onClick={() => setAlertBanner(null)} style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        animation: 'alertBannerIn 0.3s ease-out',
        cursor: 'pointer',
      }}>
        <div style={{
          textAlign: 'center', padding: '40px 60px', borderRadius: 20,
          background: '#1a1a1a', border: '2px solid rgba(239,68,68,0.3)',
          boxShadow: '0 0 80px rgba(239,68,68,0.15), 0 0 200px rgba(239,68,68,0.05)',
          animation: 'alertPulse 1.5s ease-in-out infinite',
          maxWidth: 600,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 30, background: 'rgba(239,68,68,0.1)',
            border: '2px solid rgba(239,68,68,0.3)', margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          }}>⚠</div>
          <p style={{ fontSize: 11, letterSpacing: 3, color: '#ef4444', fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase' }}>
            Threat Detected
          </p>
          <p style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
            {alertBanner.typology || 'Suspicious Activity'}
          </p>
          <p style={{ fontSize: 14, color: '#999', margin: '0 0 20px' }}>
            Cluster #{alertBanner.cluster_id} · Risk Level: <span style={{ color: '#ef4444', fontWeight: 700 }}>{alertBanner.risk_level?.toUpperCase()}</span>
          </p>
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 24, padding: '16px 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div>
              <p style={{ fontSize: 9, color: '#666', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Risk Score</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#ef4444', margin: 0 }}>{alertBanner.score?.toFixed?.(1)}</p>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
            <div>
              <p style={{ fontSize: 9, color: '#666', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Amount</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#f97316', margin: 0 }}>${alertBanner.amount?.toLocaleString()}</p>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
            <div>
              <p style={{ fontSize: 9, color: '#666', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Wallets</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#eab308', margin: 0 }}>{alertBanner.size}</p>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#555', marginTop: 16 }}>Click anywhere to dismiss</p>
        </div>
      </div>
    )}

    <style>{`
      @keyframes alertBannerIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes alertPulse {
        0%, 100% { box-shadow: 0 0 80px rgba(239,68,68,0.15), 0 0 200px rgba(239,68,68,0.05); }
        50% { box-shadow: 0 0 120px rgba(239,68,68,0.25), 0 0 300px rgba(239,68,68,0.1); }
      }
    `}</style>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 20, height: '100%' }}>

      {/* ═══ LEFT ═══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', paddingBottom: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#e0e0e0' }}>Overview</h2>
            <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>
              ShadowTrace ARIA — Financial Intelligence Platform
            </p>
          </div>
          <div style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#16a34a',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: '#16a34a', animation: 'livePulse 2s infinite' }} />
            Online
          </div>
        </div>

        {/* Overall Score Bar — like the screenshot */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', margin: '0 0 3px' }}>Overall network health score</p>
          <p style={{ fontSize: 11, color: '#666', margin: '0 0 14px' }}>Composite assessment based on detection pipeline results</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 18, background: gradeColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--bg-card)', fontSize: 14, fontWeight: 800,
            }}>{grade.letter}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#e0e0e0' }}>{Math.round(scorePercent)}%</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: gradeColor }}>{grade.label}</span>
            </div>
          </div>

          {/* Gradient grade bar — equal segments, green (A+) to red (F) */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
              {[
                { color: '#dc2626' },  // F
                { color: '#ea580c' },  // D
                { color: '#eab308' },  // C
                { color: '#a3e635' },  // B
                { color: '#22c55e' },  // A
                { color: '#15803d' },  // A+
              ].map((seg, i) => (
                <div key={i} style={{
                  flex: 1, background: seg.color,
                  opacity: scorePercent >= (i * 100 / 6) ? 1 : 0.15,
                }} />
              ))}
            </div>
            {/* Labels underneath — equally spaced */}
            <div style={{ display: 'flex', marginTop: 4 }}>
              {['F', 'D', 'C', 'B', 'A', 'A+'].map((label) => (
                <span key={label} style={{ flex: 1, fontSize: 9, color: '#666', fontWeight: 600, textAlign: 'center' }}>{label}</span>
              ))}
            </div>
            {/* Marker — positioned to match the score */}
            <div style={{
              position: 'absolute', top: -4, left: `${scorePercent}%`, transform: 'translateX(-50%)',
              width: 2, height: 16, background: '#e0e0e0', borderRadius: 1,
            }} />
          </div>
        </div>

        {/* Stats */}
        <div>
          <p className="section-label">System Metrics</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <StatsCard label="Transactions" value={stats.total_transactions} delay={30} />
            <StatsCard label="Wallets" value={stats.total_wallets} delay={60} />
            <StatsCard label="Flagged" value={allAlerts.length} color="#dc2626" delay={90} />
            <StatsCard label="Urgent" value={allAlerts.filter(a => a.risk_level === 'high' || a.risk_level === 'critical').length} color="#ea580c" delay={120} />
            <StatsCard label="Clusters" value={stats.total_clusters || 0} delay={150} />
          </div>
        </div>

        {/* Charts — Line + Radar like the screenshot */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Line chart — Baseline vs Detected */}
          <div className="glass-card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', margin: '0 0 2px' }}>
              Baseline vs Detected
            </p>
            <p style={{ fontSize: 10, color: '#666', margin: '0 0 12px' }}>
              Rule-based baseline vs hybrid model detection rate
            </p>
            <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 10, color: '#666' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#ef4444' }} /> Detected
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#4ade80' }} /> Baseline
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={activityData}>
                <XAxis dataKey="month" stroke="#333333" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#333333" fontSize={9} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                <Tooltip contentStyle={tt} />
                <Line type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} name="Detected" />
                <Line type="monotone" dataKey="baseline" stroke="#4ade80" strokeWidth={2} dot={{ r: 3, fill: '#4ade80' }} name="Baseline" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Radar chart */}
          <div className="glass-card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', margin: '0 0 2px' }}>
              Typology coverage
            </p>
            <p style={{ fontSize: 10, color: '#666', margin: '0 0 12px' }}>
              Detection coverage by threat category
            </p>
            <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 10, color: '#666' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#ef4444' }} /> Detected
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#4ade80' }} /> Baseline
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={65}>
                <PolarGrid stroke="#333" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 9, fill: '#666' }} />
                <PolarRadiusAxis tick={{ fontSize: 8, fill: '#333333' }} domain={[0, 100]} axisLine={false} />
                <Radar name="Detected" dataKey="detected" stroke="#ef4444" fill="#ef4444" fillOpacity={0.08} strokeWidth={1.5} dot={{ r: 2 }} />
                <Radar name="Baseline" dataKey="baseline" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.06} strokeWidth={1.5} dot={{ r: 2 }} />
                <Tooltip contentStyle={tt} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Breakdown */}
        <div>
          <p className="section-label">Risk Breakdown</p>
          <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={riskDist} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={50} outerRadius={85} strokeWidth={0} paddingAngle={3}
                  label={({ name, value, percent, cx, cy, midAngle, outerRadius, index }) => {
                    const RADIAN = Math.PI / 180;
                    const total = riskDist.reduce((s, d) => s + d.value, 0);
                    const pct = Math.round((value / total) * 100);
                    const radius = outerRadius + 28;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill="#ccc" textAnchor={x > cx ? 'start' : 'end'}
                        dominantBaseline="central" fontSize={11} fontWeight={600}>
                        {value.toLocaleString()} ({pct}%)
                      </text>
                    );
                  }}
                  labelLine={{ stroke: '#666', strokeWidth: 1 }}
                >
                  {riskDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
              {riskDist.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                  <span style={{ fontSize: 12, color: '#bbb', fontWeight: 500 }}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT ═══ */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: 20, overflow: 'auto',
      }}>

        {/* Threats */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p className="section-label" style={{ margin: 0 }}>Flagged Clusters</p>
            <span style={{ fontSize: 10, color: '#666' }}>{allAlerts.length} total</span>
          </div>

          <div className="glass-card" style={{ flex: 1, overflow: 'auto' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 48px 36px',
              padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontSize: 9, fontWeight: 600, color: '#666',
              textTransform: 'uppercase', letterSpacing: 0.5,
              background: '#161616', borderRadius: '10px 10px 0 0',
            }}>
              <span>ID</span>
              <span>Type</span>
              <span>Level</span>
              <span style={{ textAlign: 'right' }}>Score</span>
            </div>

            {allAlerts.map((alert, i) => (
              <div
                key={`${alert.cluster_id}-${alert.timestamp || i}`}
                onClick={() => navigate(`/investigation?cluster=${alert.cluster_id}`)}
                className={alert.isLive ? 'animate-fade-in-up' : ''}
                style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 48px 36px',
                  padding: '7px 12px', cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: alert.isLive ? 'rgba(239,68,68,0.06)' : 'var(--bg-card)',
                  transition: 'background 0.15s', alignItems: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = alert.isLive ? 'rgba(239,68,68,0.1)' : '#161616'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = alert.isLive ? 'rgba(239,68,68,0.06)' : 'var(--bg-card)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: 3, background: RISK_COLORS[alert.risk_level] || '#666' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#bbb' }}>{alert.cluster_id}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                  <span style={{ fontSize: 10, color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {alert.typology || '—'}
                  </span>
                  {alert.isLive && (
                    <span style={{
                      fontSize: 7, padding: '1px 4px', borderRadius: 3, fontWeight: 700,
                      background: 'rgba(239,68,68,0.15)', color: '#dc2626', flexShrink: 0,
                    }}>LIVE</span>
                  )}
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: RISK_COLORS[alert.risk_level] || '#666' }}>
                  {alert.risk_level || '—'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: riskColor(alert.score), fontVariantNumeric: 'tabular-nums' }}>
                  {typeof alert.score === 'number' ? Math.round(alert.score) : alert.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Baseline vs Detected — performance comparison */}
        {compare && (
          <div className="glass-card" style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#bbb', margin: '0 0 2px' }}>Baseline vs Detected</p>
            <p style={{ fontSize: 9, color: '#555', margin: '0 0 8px' }}>Rule-based vs hybrid model performance</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[
                { metric: 'Precision', baseline: Math.round(compare.rule_based.precision * 100), detected: Math.round(compare.hybrid.precision * 100) },
                { metric: 'Recall', baseline: Math.round(compare.rule_based.recall * 100), detected: Math.round(compare.hybrid.recall * 100) },
                { metric: 'F1', baseline: Math.round(compare.rule_based.f1 * 100), detected: Math.round(compare.hybrid.f1 * 100) },
                { metric: 'Accuracy', baseline: Math.round(compare.rule_based.accuracy * 100), detected: Math.round(compare.hybrid.accuracy * 100) },
              ]} barGap={2} barCategoryGap="20%">
                <XAxis dataKey="metric" stroke="#333" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={tt} formatter={(v) => `${v}%`} />
                <Bar dataKey="baseline" fill="#4ade80" name="Baseline" radius={[3, 3, 0, 0]} />
                <Bar dataKey="detected" fill="#ef4444" name="Detected" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 9, color: '#666' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4ade80' }} /> Baseline (Rules)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} /> Detected (Hybrid)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
