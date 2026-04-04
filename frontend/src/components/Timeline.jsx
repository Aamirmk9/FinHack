import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { fetchAlerts, fetchTimeline } from '../api/client';
import { truncateAddress, formatCurrency } from '../utils/formatters';

const tt = {
  background: 'var(--bg-card)', border: '1px solid #1a1a1a',
  borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', color: '#bbb',
};

export default function Timeline() {
  const [alerts, setAlerts] = useState([]);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchAlerts(20).then((data) => {
      setAlerts(data);
      if (data.length > 0) loadTimeline(data[0].cluster_id);
    });
  }, []);

  const loadTimeline = (clusterId) => {
    setSelectedCluster(clusterId);
    setCurrentIndex(0);
    setPlaying(false);
    fetchTimeline(clusterId).then((data) => setTimelineData(data.timeline || []));
  };

  useEffect(() => {
    if (!playing || timelineData.length === 0) return;
    if (currentIndex >= timelineData.length) { setPlaying(false); return; }
    const timer = setTimeout(() => setCurrentIndex((i) => i + 1), 300);
    return () => clearTimeout(timer);
  }, [playing, currentIndex, timelineData.length]);

  const cumulativeData = timelineData.slice(0, currentIndex || timelineData.length).reduce(
    (acc, tx, i) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
      acc.push({
        index: i, amount: tx.amount, cumulative: prev + tx.amount,
        timestamp: tx.timestamp?.slice(0, 16),
        from: truncateAddress(tx.from), to: truncateAddress(tx.to), pattern: tx.pattern_type,
      });
      return acc;
    }, []
  );

  const visibleTxns = timelineData.slice(0, currentIndex || timelineData.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#e0e0e0' }}>Timeline Analysis</h2>
          <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>Temporal fund flow visualization</p>
        </div>
        <select
          value={selectedCluster || ''}
          onChange={(e) => loadTimeline(Number(e.target.value))}
          style={{
            fontSize: 12, padding: '6px 12px', borderRadius: 6,
            background: 'var(--bg-card)', border: '1px solid #1a1a1a', color: '#bbb',
            outline: 'none', cursor: 'pointer',
          }}>
          {alerts.map((a) => (
            <option key={a.cluster_id} value={a.cluster_id}>
              Cluster #{a.cluster_id} — Score: {a.score}
            </option>
          ))}
        </select>
      </div>

      {/* Controls */}
      <div className="glass-card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => {
          if (currentIndex >= timelineData.length) setCurrentIndex(0);
          setPlaying(!playing);
        }} style={{
          padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          border: 'none', cursor: 'pointer',
          background: playing ? '#222222' : '#ef4444', color: playing ? '#bbb' : '#fff',
        }}>
          {playing ? 'Pause' : currentIndex >= timelineData.length ? 'Replay' : 'Play'}
        </button>
        <button onClick={() => { setCurrentIndex(0); setPlaying(false); }}
          style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 12,
            border: '1px solid #1a1a1a', background: 'var(--bg-card)', color: '#666', cursor: 'pointer',
          }}>Reset</button>
        <div style={{ flex: 1 }}>
          <input type="range" min={0} max={timelineData.length}
            value={currentIndex || timelineData.length}
            onChange={(e) => { setPlaying(false); setCurrentIndex(Number(e.target.value)); }}
            style={{ width: '100%' }} />
        </div>
        <span style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>
          {currentIndex || timelineData.length} / {timelineData.length}
        </span>
      </div>

      {/* Chart */}
      <div className="glass-card" style={{ padding: '16px 18px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', margin: '0 0 2px' }}>Cumulative Fund Flow</p>
        <p style={{ fontSize: 10, color: '#666', margin: '0 0 12px' }}>Track total volume and individual transaction amounts</p>
        <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 10, color: '#666' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: '#ef4444' }} /> Cumulative
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: '#4ade80' }} /> Per-Txn
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={cumulativeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
            <XAxis dataKey="index" stroke="#333333" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#333333" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tt} formatter={(value) => [formatCurrency(value)]}
              labelFormatter={(i) => cumulativeData[i]?.timestamp || ''} />
            <Line type="monotone" dataKey="cumulative" stroke="#ef4444" strokeWidth={2} dot={false} name="Cumulative" />
            <Line type="monotone" dataKey="amount" stroke="#4ade80" strokeWidth={1.5} dot={{ r: 2, fill: '#4ade80' }} name="Amount" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Transaction flow table */}
      <div className="glass-card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Transaction Flow</p>
          <span style={{ fontSize: 10, color: '#666' }}>{visibleTxns.length} transactions</span>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 1fr 20px 1fr 90px 80px',
          padding: '6px 16px', fontSize: 9, fontWeight: 600, color: '#666',
          textTransform: 'uppercase', letterSpacing: 0.5, background: '#161616',
          borderBottom: '1px solid rgba(0,0,0,0.04)',
        }}>
          <span>#</span><span>From</span><span></span><span>To</span>
          <span style={{ textAlign: 'right' }}>Amount</span><span style={{ textAlign: 'right' }}>Pattern</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {visibleTxns.map((tx, i) => {
            const isActive = i === (currentIndex || timelineData.length) - 1;
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 20px 1fr 90px 80px',
                padding: '7px 16px', fontSize: 11, alignItems: 'center',
                borderBottom: '1px solid rgba(0,0,0,0.03)',
                background: isActive ? 'rgba(239,68,68,0.06)' : 'var(--bg-card)',
                borderLeft: isActive ? '2px solid #ef4444' : '2px solid transparent',
              }}>
                <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 10 }}>{i + 1}</span>
                <span style={{ fontFamily: 'monospace', color: '#bbb', fontSize: 10 }}>{truncateAddress(tx.from)}</span>
                <span style={{ color: '#333333' }}>→</span>
                <span style={{ fontFamily: 'monospace', color: '#bbb', fontSize: 10 }}>{truncateAddress(tx.to)}</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#e0e0e0', fontSize: 11 }}>{formatCurrency(tx.amount)}</span>
                <span style={{ textAlign: 'right' }}>
                  {tx.pattern_type && (
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(239,68,68,0.06)', color: '#dc2626', fontWeight: 600,
                    }}>{tx.pattern_type}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
