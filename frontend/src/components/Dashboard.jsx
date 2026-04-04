import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { fetchStats, fetchAlerts, fetchCompare } from '../api/client';
import { formatNumber, formatCurrency, riskColor } from '../utils/formatters';
import StatsCard from './StatsCard';
import RiskGauge from './RiskGauge';
import ParticleBackground from './ParticleBackground';
import AnimatedNumber from './AnimatedNumber';
import useWebSocket from '../hooks/useWebSocket';

const RISK_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#eab308',
  low: '#22c55e',
};

const URGENCY_COLORS = {
  critical: 'var(--risk-critical)',
  high: 'var(--risk-high)',
  medium: 'var(--risk-medium)',
  low: 'var(--risk-low)',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [compare, setCompare] = useState(null);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const navigate = useNavigate();
  const { lastUpdate } = useWebSocket();

  useEffect(() => {
    fetchStats().then(setStats);
    fetchAlerts(10).then(setAlerts);
    fetchCompare().then(setCompare);
  }, []);

  // Auto-refresh dashboard when live transaction comes in
  useEffect(() => {
    if (lastUpdate && lastUpdate.type === 'transaction_injected') {
      // Re-fetch stats and alerts immediately
      fetchStats().then(setStats);
      fetchAlerts(10).then(setAlerts);
      // Add live alert to top of feed with animation flag
      if (lastUpdate.alert) {
        setLiveAlerts(prev => [{
          ...lastUpdate.alert,
          total_volume: lastUpdate.transaction.amount,
          flags: [...(lastUpdate.sender.flags || []), ...(lastUpdate.receiver.flags || [])],
          isNew: true,
          timestamp: Date.now(),
        }, ...prev.slice(0, 4)]);
      }
    }
  }, [lastUpdate]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
          <p>Running detection pipeline...</p>
        </div>
      </div>
    );
  }

  const threatLevel = Math.min(
    (stats.high_risk_wallets * 3 + stats.medium_risk_wallets * 1.5 + stats.critical_clusters * 10) / 5,
    100
  );

  const riskDistribution = [
    { name: 'Critical', value: stats.critical_clusters || 1, color: RISK_COLORS.critical },
    { name: 'High', value: stats.high_risk_wallets || 1, color: RISK_COLORS.high },
    { name: 'Medium', value: stats.medium_risk_wallets, color: RISK_COLORS.medium },
  ].filter(d => d.value > 0);

  const compareData = compare ? [
    { name: 'Rule-Based', precision: compare.rule_based.precision, recall: compare.rule_based.recall, f1: compare.rule_based.f1 },
    { name: 'ML-Only', precision: compare.ml_only.precision, recall: compare.ml_only.recall, f1: compare.ml_only.f1 },
    { name: 'Hybrid', precision: compare.hybrid.precision, recall: compare.hybrid.recall, f1: compare.hybrid.f1 },
  ] : [];

  return (
    <div className="space-y-5 relative">
      <ParticleBackground />

      <div className="relative z-10 space-y-5">
        <h2 className="text-2xl font-bold animate-fade-in">Dashboard</h2>

        {/* Top Row: Gauge + Stats */}
        <div className="flex gap-5 stagger-children">
          {/* Risk Gauge */}
          <div className="glass-card p-6 flex items-center justify-center" style={{ minWidth: 220 }}>
            <RiskGauge value={threatLevel} />
          </div>

          {/* Stats Grid */}
          <div className="flex-1 grid grid-cols-4 gap-4">
            <StatsCard label="Transactions" value={stats.total_transactions} delay={100} />
            <StatsCard label="Wallets Monitored" value={stats.total_wallets} delay={150} />
            <StatsCard label="High Risk Wallets" value={stats.high_risk_wallets} color="var(--risk-critical)" delay={200} />
            <StatsCard label="Urgent Cases" value={stats.urgent_cases || 0} color="var(--risk-high)" delay={250} />
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-4 stagger-children">
          {/* Risk Distribution */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={70} strokeWidth={0}>
                  {riskDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(10, 18, 32, 0.9)', border: '1px solid var(--glass-border)', borderRadius: 12, backdropFilter: 'blur(8px)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Model Comparison */}
          <div className="col-span-2 glass-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Detection Model Comparison</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={compareData} barGap={2}>
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} domain={[0, 1]} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'rgba(10, 18, 32, 0.9)', border: '1px solid var(--glass-border)', borderRadius: 12 }} />
                <Bar dataKey="precision" fill="var(--accent-blue)" name="Precision" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recall" fill="var(--accent-cyan)" name="Recall" radius={[4, 4, 0, 0]} />
                <Bar dataKey="f1" fill="#8b5cf6" name="F1 Score" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Alerts from Demo */}
        {liveAlerts.length > 0 && (
          <div className="glass-card glow-red animate-fade-in-up" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div className="p-5 border-b flex items-center gap-2" style={{ borderColor: 'rgba(239, 68, 68, 0.15)' }}>
              <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--risk-critical)', boxShadow: '0 0 8px var(--risk-critical)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--risk-critical)' }}>LIVE — Threat Detection Feed</h3>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(239, 68, 68, 0.1)' }}>
              {liveAlerts.map((alert, i) => (
                <div key={`live-${alert.cluster_id}-${alert.timestamp}`}
                  className="flex items-center justify-between px-5 py-4 cursor-pointer animate-fade-in-up"
                  style={{ background: 'rgba(239, 68, 68, 0.03)' }}
                  onClick={() => navigate(`/investigation?cluster=${alert.cluster_id}`)}>
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full risk-pulse"
                      style={{ background: RISK_COLORS[alert.risk_level] || RISK_COLORS.high, boxShadow: `0 0 10px ${RISK_COLORS[alert.risk_level] || RISK_COLORS.high}` }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: 'var(--risk-critical)' }}>Cluster #{alert.cluster_id}</span>
                        <span className="text-xs px-2 py-0.5 rounded font-bold animate-pulse"
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                          NEW
                        </span>
                        {alert.typology && (
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}>
                            {alert.typology}
                          </span>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {alert.size} wallets — detected just now
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded font-bold"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      {alert.risk_level?.toUpperCase()}
                    </span>
                    <span className="text-lg font-bold tabular-nums" style={{ color: riskColor(alert.score) }}>
                      {alert.score?.toFixed?.(1) || alert.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alert Feed */}
        <div className="glass-card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="p-5 border-b" style={{ borderColor: 'var(--glass-border)' }}>
            <h3 className="text-sm font-semibold">Suspicious Cluster Alerts</h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--glass-border)' }}>
            {alerts.map((alert, i) => (
              <div
                key={alert.cluster_id}
                className="flex items-center justify-between px-5 py-3.5 cursor-pointer transition-all duration-200 animate-fade-in-up"
                style={{ animationDelay: `${0.35 + i * 0.05}s` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(6, 182, 212, 0.03)';
                  e.currentTarget.style.borderLeft = '2px solid var(--accent-cyan)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderLeft = '2px solid transparent';
                }}
                onClick={() => navigate(`/investigation?cluster=${alert.cluster_id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-2.5 h-2.5 rounded-full"
                    style={{ background: RISK_COLORS[alert.risk_level], boxShadow: `0 0 6px ${RISK_COLORS[alert.risk_level]}` }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Cluster #{alert.cluster_id}</span>
                      {alert.typology && alert.typology !== 'Unclassified' && (
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
                          {alert.typology}
                        </span>
                      )}
                      {alert.known_actor_label && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                          style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--risk-critical)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                          {alert.known_actor_label}
                        </span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {alert.size} wallets &middot; {formatCurrency(alert.total_volume)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {alert.freeze_urgency && alert.freeze_urgency !== 'low' && (
                    <span className="text-xs px-2 py-0.5 rounded font-semibold"
                      style={{
                        background: alert.freeze_urgency === 'critical' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        color: URGENCY_COLORS[alert.freeze_urgency],
                        border: `1px solid ${alert.freeze_urgency === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
                      }}>
                      {alert.freeze_urgency === 'critical' ? 'URGENT' : 'HIGH'}
                    </span>
                  )}
                  <div className="flex gap-1">
                    {alert.flags.slice(0, 2).map((flag) => (
                      <span key={flag} className="text-xs px-2 py-0.5 rounded"
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--risk-critical)' }}>
                        {flag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color: riskColor(alert.score) }}>
                    {alert.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ML Metrics */}
        {stats.ml_metrics && (
          <div className="grid grid-cols-4 gap-4 stagger-children">
            <StatsCard label="ML Precision" value={`${(stats.ml_metrics.precision * 100).toFixed(1)}%`} color="var(--accent-blue)" delay={500} />
            <StatsCard label="ML Recall" value={`${(stats.ml_metrics.recall * 100).toFixed(1)}%`} color="var(--accent-cyan)" delay={550} />
            <StatsCard label="ML F1 Score" value={`${(stats.ml_metrics.f1 * 100).toFixed(1)}%`} color="#8b5cf6" delay={600} />
            <StatsCard label="ML Accuracy" value={`${(stats.ml_metrics.accuracy * 100).toFixed(1)}%`} color="var(--risk-low)" delay={650} />
          </div>
        )}
      </div>
    </div>
  );
}
