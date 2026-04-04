import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fetchAlerts, fetchCluster, generateSAR } from '../api/client';
import { truncateAddress, formatCurrency, riskColor } from '../utils/formatters';
import SARModal from './SARModal';

const URGENCY_COLORS = {
  critical: 'var(--risk-critical)',
  high: 'var(--risk-high)',
  medium: 'var(--risk-medium)',
  low: 'var(--risk-low)',
};

export default function InvestigationPanel() {
  const [searchParams] = useSearchParams();
  const [alerts, setAlerts] = useState([]);
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sarData, setSarData] = useState(null);
  const [sarLoading, setSarLoading] = useState(false);

  useEffect(() => {
    fetchAlerts(20).then(setAlerts);
    const clusterId = searchParams.get('cluster');
    if (clusterId) selectCluster(Number(clusterId));
  }, []);

  const selectCluster = (id) => {
    setSelectedClusterId(id);
    setLoading(true);
    setSarData(null);
    fetchCluster(id).then((data) => { setClusterData(data); setLoading(false); });
  };

  const handleGenerateSAR = () => {
    setSarLoading(true);
    generateSAR(selectedClusterId)
      .then((data) => {
        setSarData(data);
        setSarLoading(false);
      })
      .catch(() => {
        setSarLoading(false);
      });
  };

  const typo = clusterData?.typology || {};
  const fp = clusterData?.freeze_priority || {};
  const ka = clusterData?.known_actor || {};

  return (
    <div className="flex h-full gap-4">
      {/* Cluster List — now with typology + freeze priority */}
      <div className="w-80 rounded-xl border overflow-y-auto flex-shrink-0"
        className="glass-card-static">
        <div className="p-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
          <h3 className="text-sm font-semibold">Flagged Clusters</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{alerts.length} clusters ranked by risk</p>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--glass-border)' }}>
          {alerts.map((alert) => (
            <div key={alert.cluster_id} className="px-4 py-3 cursor-pointer transition-colors"
              style={{ background: selectedClusterId === alert.cluster_id ? 'var(--bg-card-hover)' : 'transparent', borderColor: 'var(--border)' }}
              onClick={() => selectCluster(alert.cluster_id)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              onMouseLeave={(e) => { if (selectedClusterId !== alert.cluster_id) e.currentTarget.style.background = 'transparent'; }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: riskColor(alert.score) }} />
                  <span className="text-sm font-medium">#{alert.cluster_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  {alert.freeze_urgency && alert.freeze_urgency !== 'low' && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: `${URGENCY_COLORS[alert.freeze_urgency]}18`, color: URGENCY_COLORS[alert.freeze_urgency] }}>
                      {alert.freeze_urgency === 'critical' ? 'URGENT' : 'HIGH'}
                    </span>
                  )}
                  <span className="text-sm font-bold" style={{ color: riskColor(alert.score) }}>{alert.score}</span>
                </div>
              </div>
              {alert.typology && alert.typology !== 'Unclassified' && (
                <p className="text-xs mt-1 font-medium" style={{ color: 'var(--accent-cyan)' }}>
                  {alert.typology}
                </p>
              )}
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {alert.size} wallets · {formatCurrency(alert.total_volume)}
              </p>
              {alert.known_actor_label && (
                <p className="text-xs mt-1 font-medium" style={{ color: 'var(--risk-critical)' }}>
                  State-sponsored risk
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Investigation Detail */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {!clusterData && !loading && (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>Select a cluster to investigate</div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>Loading cluster data...</div>
        )}

        {clusterData && !loading && (
          <>
            {/* Header with SAR button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Cluster #{clusterData.cluster_id}</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Investigation Report</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleGenerateSAR} disabled={sarLoading}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: sarLoading ? 'var(--border)' : 'var(--accent-cyan)', color: sarLoading ? 'var(--text-secondary)' : '#000' }}>
                  {sarLoading ? 'Generating...' : 'Generate SAR'}
                </button>
                <div className="text-right">
                  <p className="text-3xl font-bold" style={{ color: riskColor(clusterData.score) }}>{clusterData.score}</p>
                  <span className="text-xs px-3 py-1 rounded font-semibold"
                    style={{ background: `${riskColor(clusterData.score)}22`, color: riskColor(clusterData.score) }}>
                    {clusterData.risk_level?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Typology Classification */}
            {typo.name && (
              <div className="rounded-xl p-5 border"
                style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.05), rgba(59, 130, 246, 0.05))', borderColor: 'var(--accent-cyan)', borderWidth: 1 }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--accent-cyan)' }}>
                    FinCEN Typology Classification
                  </h3>
                  {typo.fincen_code && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
                      {typo.fincen_code}
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold mb-1">{typo.name}</p>
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{typo.description}</p>
                {typo.indicators && (
                  <div className="space-y-1">
                    {typo.indicators.map((ind, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span style={{ color: 'var(--accent-cyan)' }}>&#10003;</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{ind}</span>
                      </div>
                    ))}
                  </div>
                )}
                {typo.confidence > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Confidence:</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)', maxWidth: 200 }}>
                      <div className="h-full rounded-full" style={{ width: `${typo.confidence}%`, background: 'var(--accent-cyan)' }} />
                    </div>
                    <span className="text-xs font-mono">{typo.confidence}%</span>
                  </div>
                )}
              </div>
            )}

            {/* Freeze Priority + Known Actor — side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Freeze Priority */}
              <div className="rounded-xl p-5 border" className="glass-card-static">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Freeze Priority</h3>
                  <span className="text-xs px-2 py-0.5 rounded font-bold"
                    style={{ background: `${URGENCY_COLORS[fp.urgency] || 'var(--risk-low)'}22`, color: URGENCY_COLORS[fp.urgency] || 'var(--risk-low)' }}>
                    {(fp.urgency || 'low').toUpperCase()}
                  </span>
                </div>
                <p className="text-3xl font-bold mb-2">{fp.score || 0}<span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>/100</span></p>
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{fp.recommendation}</p>
                {fp.factors && (
                  <div className="space-y-2">
                    {Object.entries(fp.factors).map(([key, f]) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="capitalize">{key}</span>
                          <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{f.detail}</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(f.score / f.max) * 100}%`, background: 'var(--accent-blue)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Known Actor Analysis */}
              <div className="rounded-xl p-5 border"
                style={{
                  background: ka.similarity_score >= 40 ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-card)',
                  borderColor: ka.similarity_score >= 40 ? 'var(--risk-critical)' : 'var(--border)',
                }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Known Actor Analysis</h3>
                  {ka.threat_actor && (
                    <span className="text-xs px-2 py-0.5 rounded font-bold"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)' }}>
                      STATE-SPONSORED
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold mb-1" style={{ color: ka.similarity_score >= 40 ? 'var(--risk-critical)' : 'var(--text-primary)' }}>
                  {ka.similarity_score || 0}%
                  <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-secondary)' }}>similarity</span>
                </p>
                <p className="text-xs mb-2" style={{ color: ka.similarity_score >= 40 ? 'var(--risk-critical)' : 'var(--text-secondary)' }}>
                  {ka.risk_label}
                </p>
                {ka.threat_actor && (
                  <div className="p-3 rounded-lg mt-2" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--risk-critical)' }}>
                      Potential match: {ka.threat_actor}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {ka.reference}
                    </p>
                  </div>
                )}
                {ka.behavioral_signals && (
                  <div className="space-y-1.5 mt-3">
                    {ka.behavioral_signals.map((sig) => (
                      <div key={sig.signal} className="flex items-center justify-between text-xs">
                        <span className="capitalize">{sig.signal.replace(/_/g, ' ')}</span>
                        <span className="font-mono" style={{ color: sig.score >= 70 ? 'var(--risk-critical)' : 'var(--text-secondary)' }}>
                          {sig.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Wallets', value: clusterData.size },
                { label: 'Total Volume', value: formatCurrency(clusterData.total_volume) },
                { label: 'Density', value: (clusterData.density * 100).toFixed(1) + '%' },
                { label: 'Internal Txns', value: clusterData.transactions?.length || 0 },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg p-3 border"
                  className="glass-card-static">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>

            {/* Why Suspicious */}
            <div className="rounded-xl p-5 border" className="glass-card-static">
              <h3 className="text-sm font-semibold mb-3">Flagged Indicators</h3>
              <div className="flex flex-wrap gap-2">
                {clusterData.flags?.map((flag) => (
                  <div key={flag} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <span style={{ color: 'var(--risk-critical)' }}>&#9888;</span>
                    <span>{flag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Wallet Risk Scores */}
            <div className="rounded-xl p-5 border" className="glass-card-static">
              <h3 className="text-sm font-semibold mb-3">Wallet Risk Scores</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={(clusterData.wallets || []).slice(0, 15).map((w) => ({
                  name: truncateAddress(w.address), score: w.score,
                }))}>
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Bar dataKey="score" name="Risk Score">
                    {(clusterData.wallets || []).slice(0, 15).map((w, i) => (
                      <Cell key={i} fill={riskColor(w.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Transaction Table */}
            <div className="rounded-xl border overflow-hidden" className="glass-card-static">
              <div className="p-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                <h3 className="text-sm font-semibold">Cluster Transactions ({clusterData.transactions?.length || 0})</h3>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>From</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>To</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Amount</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Timestamp</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Pattern</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(clusterData.transactions || []).slice(0, 50).map((tx, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                        <td className="px-4 py-2 font-mono">{truncateAddress(tx.from_address)}</td>
                        <td className="px-4 py-2 font-mono">{truncateAddress(tx.to_address)}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatCurrency(tx.amount)}</td>
                        <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{tx.timestamp?.slice(0, 19)}</td>
                        <td className="px-4 py-2">
                          {tx.pattern_type && (
                            <span className="px-1.5 py-0.5 rounded text-xs"
                              style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)' }}>
                              {tx.pattern_type}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SAR Modal */}
      {sarData && <SARModal sar={sarData} onClose={() => setSarData(null)} />}
    </div>
  );
}
