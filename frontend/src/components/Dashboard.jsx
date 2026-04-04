import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { fetchStats, fetchAlerts, fetchCompare } from '../api/client';
import { formatNumber, formatCurrency, riskColor } from '../utils/formatters';
import StatsCard from './StatsCard';

const RISK_COLORS = {
  critical: 'var(--risk-critical)',
  high: 'var(--risk-high)',
  medium: 'var(--risk-medium)',
  low: 'var(--risk-low)',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [compare, setCompare] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats().then(setStats);
    fetchAlerts(10).then(setAlerts);
    fetchCompare().then(setCompare);
  }, []);

  if (!stats) {
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>Loading pipeline results...</div>;
  }

  const riskDistribution = [
    { name: 'Critical', value: stats.critical_clusters, color: RISK_COLORS.critical },
    { name: 'High', value: stats.high_risk_wallets, color: RISK_COLORS.high },
    { name: 'Medium', value: stats.medium_risk_wallets, color: RISK_COLORS.medium },
  ];

  const compareData = compare ? [
    { name: 'Rule-Based', precision: compare.rule_based.precision, recall: compare.rule_based.recall, f1: compare.rule_based.f1 },
    { name: 'ML-Only', precision: compare.ml_only.precision, recall: compare.ml_only.recall, f1: compare.ml_only.f1 },
    { name: 'Hybrid', precision: compare.hybrid.precision, recall: compare.hybrid.recall, f1: compare.hybrid.f1 },
  ] : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid grid-cols-4 gap-4">
        <StatsCard label="Transactions Analyzed" value={formatNumber(stats.total_transactions)} />
        <StatsCard label="Wallets Monitored" value={formatNumber(stats.total_wallets)} />
        <StatsCard label="High Risk Wallets" value={stats.high_risk_wallets} color="var(--risk-critical)" />
        <StatsCard label="Critical Clusters" value={stats.critical_clusters} color="var(--risk-critical)" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80}>
                {riskDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="col-span-2 rounded-xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4">Detection Model Comparison</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={compareData}>
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} domain={[0, 1]} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="precision" fill="var(--accent-blue)" name="Precision" />
              <Bar dataKey="recall" fill="var(--accent-cyan)" name="Recall" />
              <Bar dataKey="f1" fill="#a78bfa" name="F1 Score" />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold">Suspicious Cluster Alerts</h3>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {alerts.map((alert) => (
            <div
              key={alert.cluster_id}
              className="flex items-center justify-between px-5 py-3 cursor-pointer transition-colors"
              style={{ borderColor: 'var(--border)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate(`/investigation?cluster=${alert.cluster_id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full" style={{ background: RISK_COLORS[alert.risk_level] }} />
                <div>
                  <span className="text-sm font-medium">Cluster #{alert.cluster_id}</span>
                  <span className="text-xs ml-3" style={{ color: 'var(--text-secondary)' }}>
                    {alert.size} wallets · {formatCurrency(alert.total_volume)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {alert.flags.slice(0, 3).map((flag) => (
                    <span key={flag} className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)' }}>
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <span className="text-sm font-bold" style={{ color: riskColor(alert.score) }}>
                  {alert.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {stats.ml_metrics && (
        <div className="grid grid-cols-4 gap-4">
          <StatsCard label="ML Precision" value={`${(stats.ml_metrics.precision * 100).toFixed(1)}%`} color="var(--accent-blue)" />
          <StatsCard label="ML Recall" value={`${(stats.ml_metrics.recall * 100).toFixed(1)}%`} color="var(--accent-cyan)" />
          <StatsCard label="ML F1 Score" value={`${(stats.ml_metrics.f1 * 100).toFixed(1)}%`} color="#a78bfa" />
          <StatsCard label="ML Accuracy" value={`${(stats.ml_metrics.accuracy * 100).toFixed(1)}%`} color="var(--risk-low)" />
        </div>
      )}
    </div>
  );
}
