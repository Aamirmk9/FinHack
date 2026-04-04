import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { fetchAlerts, fetchTimeline } from '../api/client';
import { truncateAddress, formatCurrency } from '../utils/formatters';

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
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Timeline Analysis</h2>
        <select className="text-sm px-3 py-1.5 rounded-lg border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          value={selectedCluster || ''} onChange={(e) => loadTimeline(Number(e.target.value))}>
          {alerts.map((a) => (
            <option key={a.cluster_id} value={a.cluster_id}>
              Cluster #{a.cluster_id} — Score: {a.score}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4 rounded-xl p-4 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <button onClick={() => {
          if (currentIndex >= timelineData.length) setCurrentIndex(0);
          setPlaying(!playing);
        }} className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--accent-cyan)', color: '#000' }}>
          {playing ? 'Pause' : currentIndex >= timelineData.length ? 'Replay' : 'Play'}
        </button>
        <button onClick={() => { setCurrentIndex(0); setPlaying(false); }}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Reset</button>
        <div className="flex-1">
          <input type="range" min={0} max={timelineData.length}
            value={currentIndex || timelineData.length}
            onChange={(e) => { setPlaying(false); setCurrentIndex(Number(e.target.value)); }}
            className="w-full" />
        </div>
        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
          {currentIndex || timelineData.length} / {timelineData.length} txns
        </span>
      </div>

      <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-3">Cumulative Fund Flow</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={cumulativeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="index" stroke="var(--text-secondary)" fontSize={11} />
            <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
              formatter={(value) => [formatCurrency(value)]}
              labelFormatter={(i) => cumulativeData[i]?.timestamp || ''} />
            <Line type="monotone" dataKey="cumulative" stroke="var(--accent-cyan)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="amount" stroke="var(--accent-blue)" strokeWidth={1} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-1 rounded-xl border overflow-y-auto"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold">Transaction Flow</h3>
        </div>
        <div className="p-4 space-y-2">
          {visibleTxns.map((tx, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg text-xs"
              style={{
                background: i === (currentIndex || timelineData.length) - 1 ? 'rgba(6, 182, 212, 0.1)' : 'var(--bg-secondary)',
                border: i === (currentIndex || timelineData.length) - 1 ? '1px solid var(--accent-cyan)' : '1px solid transparent',
              }}>
              <span className="font-mono w-6 text-center" style={{ color: 'var(--text-secondary)' }}>{i + 1}</span>
              <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>{truncateAddress(tx.from)}</span>
              <span style={{ color: 'var(--text-secondary)' }}>→</span>
              <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{truncateAddress(tx.to)}</span>
              <span className="font-mono font-semibold ml-auto">{formatCurrency(tx.amount)}</span>
              {tx.pattern_type && (
                <span className="px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)' }}>
                  {tx.pattern_type}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
