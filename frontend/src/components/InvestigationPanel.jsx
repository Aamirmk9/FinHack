import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fetchAlerts, fetchCluster, generateSAR } from '../api/client';
import { truncateAddress, formatCurrency, riskColor } from '../utils/formatters';
import SARModal from './SARModal';

const tt = {
  background: 'var(--bg-card)', border: '1px solid #1a1a1a',
  borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', color: '#bbb',
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

  const handleGenerateSAR = async () => {
    setSarLoading(true);
    try {
      const data = await generateSAR(selectedClusterId);
      setSarData(data);
    } catch (err) {
      setSarData({
        cluster_id: selectedClusterId,
        sar_narrative: 'Error generating SAR. Please restart the backend server and try again.',
        generated_by: 'error',
      });
    }
    setSarLoading(false);
  };

  const typo = clusterData?.typology || {};
  const fp = clusterData?.freeze_priority || {};
  const ka = clusterData?.known_actor || {};

  return (
    <div style={{ display: 'flex', height: '100%', gap: 16 }}>

      {/* ═══ LEFT: Cluster list ═══ */}
      <div className="glass-card" style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Flagged Clusters</p>
          <p style={{ fontSize: 10, color: '#666', margin: '2px 0 0' }}>{alerts.length} ranked by risk</p>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 48px 36px',
          padding: '6px 14px', fontSize: 9, fontWeight: 600, color: '#666',
          textTransform: 'uppercase', letterSpacing: 0.5,
          background: '#161616', borderBottom: '1px solid rgba(0,0,0,0.04)',
        }}>
          <span>ID</span><span>Type</span><span>Level</span><span style={{ textAlign: 'right' }}>Risk</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {alerts.map((alert) => (
            <div key={alert.cluster_id}
              onClick={() => selectCluster(alert.cluster_id)}
              style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 48px 36px',
                padding: '8px 14px', cursor: 'pointer', alignItems: 'center',
                borderBottom: '1px solid rgba(0,0,0,0.03)',
                background: selectedClusterId === alert.cluster_id ? 'rgba(239,68,68,0.06)' : 'var(--bg-card)',
                borderLeft: selectedClusterId === alert.cluster_id ? '2px solid #ef4444' : '2px solid transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (selectedClusterId !== alert.cluster_id) e.currentTarget.style.background = '#161616'; }}
              onMouseLeave={(e) => { if (selectedClusterId !== alert.cluster_id) e.currentTarget.style.background = '#fff'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: 3, background: riskColor(alert.score) }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#bbb' }}>{alert.cluster_id}</span>
              </div>
              <span style={{ fontSize: 10, color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {alert.typology && alert.typology !== 'Unclassified' ? alert.typology : '—'}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: riskColor(alert.score) }}>
                {alert.risk_level}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: riskColor(alert.score), fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(alert.score)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ RIGHT: Detail ═══ */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
        {!clusterData && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: 13 }}>
            Select a cluster to investigate
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: 13 }}>
            Loading...
          </div>
        )}

        {clusterData && !loading && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#e0e0e0' }}>
                  Cluster #{clusterData.cluster_id}
                </h2>
                <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>Investigation Report</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={handleGenerateSAR} disabled={sarLoading}
                  style={{
                    padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: sarLoading ? '#222222' : '#ef4444', color: sarLoading ? '#666' : '#fff',
                  }}>
                  {sarLoading ? 'Generating...' : 'Generate SAR'}
                </button>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 24, fontWeight: 800, color: riskColor(clusterData.score), margin: 0, lineHeight: 1 }}>
                    {clusterData.score}
                  </p>
                  <span style={{
                    fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                    background: `${riskColor(clusterData.score)}15`, color: riskColor(clusterData.score),
                    textTransform: 'uppercase',
                  }}>{clusterData.risk_level}</span>
                </div>
              </div>
            </div>

            {/* Top row: stats + typology */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Quick stats */}
              <div className="glass-card" style={{ padding: '14px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#e0e0e0', margin: '0 0 10px' }}>Summary</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Wallets', value: clusterData.size },
                    { label: 'Volume', value: formatCurrency(clusterData.total_volume) },
                    { label: 'Density', value: (clusterData.density * 100).toFixed(1) + '%' },
                    { label: 'Transactions', value: clusterData.transactions?.length || 0 },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '6px 0' }}>
                      <p style={{ fontSize: 9, color: '#666', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typology */}
              {typo.name ? (
                <div className="glass-card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#e0e0e0', margin: 0 }}>FinCEN Typology</p>
                    {typo.fincen_code && (
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontFamily: 'monospace', fontWeight: 600 }}>
                        {typo.fincen_code}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0', margin: '0 0 4px' }}>{typo.name}</p>
                  {typo.confidence > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#222222', maxWidth: 120 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${typo.confidence}%`, background: '#ef4444' }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>{typo.confidence}%</span>
                    </div>
                  )}
                  {typo.indicators && typo.indicators.slice(0, 3).map((ind, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 10, color: '#666', marginBottom: 3 }}>
                      <span style={{ color: '#16a34a', flexShrink: 0 }}>✓</span>
                      <span>{ind}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 12 }}>
                  No typology classified
                </div>
              )}
            </div>

            {/* Freeze + Known Actor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="glass-card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#e0e0e0', margin: 0 }}>Freeze Priority</p>
                  <span style={{
                    fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 700,
                    background: fp.urgency === 'critical' ? 'rgba(239,68,68,0.06)' : fp.urgency === 'high' ? 'rgba(249,115,22,0.08)' : 'rgba(34,197,94,0.08)',
                    color: fp.urgency === 'critical' ? '#dc2626' : fp.urgency === 'high' ? '#ea580c' : '#16a34a',
                    textTransform: 'uppercase',
                  }}>{fp.urgency || 'low'}</span>
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#e0e0e0', margin: '0 0 4px' }}>
                  {fp.score || 0}<span style={{ fontSize: 11, fontWeight: 400, color: '#666' }}>/100</span>
                </p>
                <p style={{ fontSize: 10, color: '#666', margin: '0 0 10px' }}>{fp.recommendation}</p>
                {fp.factors && Object.entries(fp.factors).map(([key, f]) => (
                  <div key={key} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                      <span style={{ color: '#bbb', textTransform: 'capitalize' }}>{key}</span>
                      <span style={{ color: '#666', fontFamily: 'monospace' }}>{f.detail}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: '#222222' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${(f.score / f.max) * 100}%`, background: '#ef4444' }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="glass-card" style={{
                padding: '14px 16px',
                borderColor: ka.similarity_score >= 40 ? 'rgba(239,68,68,0.15)' : undefined,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#e0e0e0', margin: 0 }}>Known Actor</p>
                  {ka.threat_actor && (
                    <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 3, fontWeight: 700, background: 'rgba(239,68,68,0.06)', color: '#dc2626', letterSpacing: 0.5 }}>
                      STATE-SPONSORED
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: ka.similarity_score >= 40 ? '#dc2626' : '#e0e0e0', margin: '0 0 2px' }}>
                  {ka.similarity_score || 0}%
                  <span style={{ fontSize: 11, fontWeight: 400, color: '#666', marginLeft: 4 }}>similarity</span>
                </p>
                <p style={{ fontSize: 10, color: '#666', margin: '0 0 8px' }}>{ka.risk_label}</p>
                {ka.threat_actor && (
                  <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', marginBottom: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', margin: 0 }}>Match: {ka.threat_actor}</p>
                    <p style={{ fontSize: 10, color: '#666', margin: '2px 0 0' }}>{ka.reference}</p>
                  </div>
                )}
                {ka.behavioral_signals && ka.behavioral_signals.map((sig) => (
                  <div key={sig.signal} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                    <span style={{ color: '#777', textTransform: 'capitalize' }}>{sig.signal.replace(/_/g, ' ')}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: sig.score >= 70 ? '#dc2626' : '#666' }}>{sig.score}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Flags */}
            {clusterData.flags?.length > 0 && (
              <div className="glass-card" style={{ padding: '12px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#e0e0e0', margin: '0 0 8px' }}>Flagged Indicators</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {clusterData.flags.map((flag) => (
                    <span key={flag} style={{
                      fontSize: 10, padding: '4px 10px', borderRadius: 4,
                      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#dc2626', fontWeight: 500,
                    }}>
                      {flag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Wallet scores chart */}
            <div className="glass-card" style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', margin: '0 0 2px' }}>Wallet Risk Scores</p>
              <p style={{ fontSize: 10, color: '#666', margin: '0 0 12px' }}>Top 15 wallets by risk score</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={(clusterData.wallets || []).slice(0, 15).map((w) => ({
                  name: truncateAddress(w.address), score: w.score,
                }))}>
                  <XAxis dataKey="name" stroke="#333333" fontSize={9} angle={-45} textAnchor="end" height={50} tickLine={false} axisLine={false} />
                  <YAxis stroke="#333333" fontSize={9} domain={[0, 100]} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tt} />
                  <Bar dataKey="score" name="Risk Score" radius={[3, 3, 0, 0]}>
                    {(clusterData.wallets || []).slice(0, 15).map((w, i) => (
                      <Cell key={i} fill={riskColor(w.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Transaction table */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>
                  Transactions
                </p>
                <span style={{ fontSize: 10, color: '#666' }}>{clusterData.transactions?.length || 0} total</span>
              </div>
              <div style={{ maxHeight: 280, overflow: 'auto' }}>
                {/* Header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 90px 140px 70px',
                  padding: '6px 16px', fontSize: 9, fontWeight: 600, color: '#666',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  background: '#161616', borderBottom: '1px solid rgba(0,0,0,0.04)',
                  position: 'sticky', top: 0,
                }}>
                  <span>From</span><span>To</span><span style={{ textAlign: 'right' }}>Amount</span>
                  <span>Time</span><span>Pattern</span>
                </div>
                {(clusterData.transactions || []).slice(0, 50).map((tx, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 90px 140px 70px',
                    padding: '6px 16px', fontSize: 10, alignItems: 'center',
                    borderBottom: '1px solid rgba(0,0,0,0.03)',
                  }}>
                    <span style={{ fontFamily: 'monospace', color: '#bbb' }}>{truncateAddress(tx.from_address)}</span>
                    <span style={{ fontFamily: 'monospace', color: '#bbb' }}>{truncateAddress(tx.to_address)}</span>
                    <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(tx.amount)}</span>
                    <span style={{ color: '#666', fontSize: 9 }}>{tx.timestamp?.slice(0, 19)}</span>
                    <span>
                      {tx.pattern_type && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.06)', color: '#dc2626', fontWeight: 600 }}>
                          {tx.pattern_type}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {sarData && <SARModal sar={sarData} onClose={() => setSarData(null)} />}
    </div>
  );
}
