import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fetchAlerts, fetchCluster } from '../api/client';
import { truncateAddress, formatCurrency, riskColor } from '../utils/formatters';

export default function InvestigationPanel() {
  const [searchParams] = useSearchParams();
  const [alerts, setAlerts] = useState([]);
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAlerts(20).then(setAlerts);
    const clusterId = searchParams.get('cluster');
    if (clusterId) selectCluster(Number(clusterId));
  }, []);

  const selectCluster = (id) => {
    setSelectedClusterId(id);
    setLoading(true);
    fetchCluster(id).then((data) => { setClusterData(data); setLoading(false); });
  };

  return (
    <div className="flex h-full gap-4">
      <div className="w-72 rounded-xl border overflow-y-auto flex-shrink-0"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold">Flagged Clusters</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{alerts.length} clusters ranked by risk</p>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {alerts.map((alert) => (
            <div key={alert.cluster_id} className="px-4 py-3 cursor-pointer transition-colors"
              style={{ background: selectedClusterId === alert.cluster_id ? 'var(--bg-card-hover)' : 'transparent', borderColor: 'var(--border)' }}
              onClick={() => selectCluster(alert.cluster_id)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              onMouseLeave={(e) => { if (selectedClusterId !== alert.cluster_id) e.currentTarget.style.background = 'transparent'; }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: riskColor(alert.score) }} />
                  <span className="text-sm font-medium">Cluster #{alert.cluster_id}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: riskColor(alert.score) }}>{alert.score}</span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {alert.size} wallets · {formatCurrency(alert.total_volume)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {!clusterData && !loading && (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>Select a cluster to investigate</div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>Loading cluster data...</div>
        )}

        {clusterData && !loading && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Cluster #{clusterData.cluster_id}</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Investigation Report</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold" style={{ color: riskColor(clusterData.score) }}>{clusterData.score}</p>
                <span className="text-xs px-3 py-1 rounded font-semibold"
                  style={{ background: `${riskColor(clusterData.score)}22`, color: riskColor(clusterData.score) }}>
                  {clusterData.risk_level?.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Wallets', value: clusterData.size },
                { label: 'Total Volume', value: formatCurrency(clusterData.total_volume) },
                { label: 'Density', value: (clusterData.density * 100).toFixed(1) + '%' },
                { label: 'Internal Txns', value: clusterData.transactions?.length || 0 },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg p-3 border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold mb-3">Why Is This Suspicious?</h3>
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

            <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
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

            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
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
                      <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
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
    </div>
  );
}
