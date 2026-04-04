import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { fetchStats, fetchAlerts, fetchCompare } from '../api/client';
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

const generateActivityData = () => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let base = 40;
  return months.map(m => {
    base += Math.floor(Math.random() * 30 - 12);
    base = Math.max(10, Math.min(95, base));
    const avg = base + Math.floor(Math.random() * 20 - 10);
    return { month: m, score: base, avg: Math.max(5, Math.min(95, avg)) };
  });
};

const generateRadarData = () => {
  const cats = [
    'Structuring','Layering','Round-Trip','Fan-Out','Rapid Relay',
    'Smurfing','Peel Chain','Mixer Use','Shell Corp','Cross-Border',
    'Dormant Acct','High Freq',
  ];
  return cats.map((c, i) => ({
    category: (i + 1).toString(),
    fullName: c,
    detected: Math.floor(Math.random() * 60 + 30),
    baseline: Math.floor(Math.random() * 40 + 20),
  }));
};

const tt = {
  background: 'var(--bg-card)', border: '1px solid #1a1a1a',
  borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', color: '#bbb',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [compare, setCompare] = useState(null);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [activityData] = useState(generateActivityData);
  const [radarData] = useState(generateRadarData);
  const navigate = useNavigate();
  const { lastUpdate } = useWebSocket();

  useEffect(() => {
    fetchStats().then(setStats);
    fetchAlerts(10).then(setAlerts);
    fetchCompare().then(setCompare);
  }, []);

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
  const threatLevel = Math.min(
    (stats.high_risk_wallets * 3 + stats.medium_risk_wallets * 1.5 + stats.critical_clusters * 10) / 5,
    100
  );
  const scorePercent = Math.max(0, Math.min(100, 100 - threatLevel));
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
    { name: 'Critical', value: stats.critical_clusters || 1, color: RISK_COLORS.critical },
    { name: 'High', value: stats.high_risk_wallets || 1, color: RISK_COLORS.high },
    { name: 'Medium', value: stats.medium_risk_wallets, color: RISK_COLORS.medium },
  ].filter(d => d.value > 0);

  const allAlerts = [
    ...liveAlerts.map(a => ({ ...a, isLive: true })),
    ...alerts.filter(a => !liveAlerts.find(la => la.cluster_id === a.cluster_id)),
  ];

  // ML accuracy bar segments
  const mlMetrics = stats.ml_metrics;

  return (
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
          {/* Line chart */}
          <div className="glass-card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', margin: '0 0 2px' }}>
              Detection score over time
            </p>
            <p style={{ fontSize: 10, color: '#666', margin: '0 0 12px' }}>
              Track detection confidence scores over time
            </p>
            <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 10, color: '#666' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#ef4444' }} /> ARIA
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#4ade80' }} /> Baseline
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={activityData}>
                <XAxis dataKey="month" stroke="#333333" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#333333" fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={tt} />
                <Line type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} name="ARIA" />
                <Line type="monotone" dataKey="avg" stroke="#4ade80" strokeWidth={2} dot={{ r: 3, fill: '#4ade80' }} name="Baseline" />
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
          <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 24 }}>
            <ResponsiveContainer width={100} height={85}>
              <PieChart>
                <Pie data={riskDist} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={22} outerRadius={38} strokeWidth={0} paddingAngle={2}>
                  {riskDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {riskDist.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                    <span style={{ fontSize: 12, color: '#bbb', fontWeight: 500 }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: d.color }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT ═══ */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        borderLeft: '1px solid rgba(0,0,0,0.06)', paddingLeft: 20, overflow: 'auto',
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
              padding: '7px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)',
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
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
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

        {/* ML Accuracy — compact colored bar at bottom right */}
        {mlMetrics && (
          <div className="glass-card" style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#bbb', margin: '0 0 8px' }}>Model Accuracy</p>
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1, marginBottom: 6 }}>
              <div style={{ flex: mlMetrics.precision * 100, background: '#ef4444', borderRadius: '3px 0 0 3px' }} title="Precision" />
              <div style={{ flex: mlMetrics.recall * 100, background: '#f97316' }} title="Recall" />
              <div style={{ flex: mlMetrics.f1 * 100, background: '#7c3aed' }} title="F1" />
              <div style={{ flex: mlMetrics.accuracy * 100, background: '#16a34a', borderRadius: '0 3px 3px 0' }} title="Accuracy" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#666' }}>
              {[
                { label: 'Precision', val: mlMetrics.precision, color: '#ef4444' },
                { label: 'Recall', val: mlMetrics.recall, color: '#f97316' },
                { label: 'F1', val: mlMetrics.f1, color: '#7c3aed' },
                { label: 'Accuracy', val: mlMetrics.accuracy, color: '#16a34a' },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 5, height: 5, borderRadius: 2, background: m.color }} />
                  <span>{m.label}</span>
                  <span style={{ fontWeight: 700, color: m.color }}>{(m.val * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
