import { useState, useEffect } from 'react';
import { truncateAddress, formatCurrency } from '../utils/formatters';

export default function LiveToast({ update, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (update) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [update]);

  if (!update) return null;

  const tx = update.transaction;
  const alert = update.alert;

  return (
    <div
      className="fixed top-5 right-5 z-50 max-w-md transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
      }}
    >
      <div className="glass-card p-4 glow-cyan" style={{ background: 'rgba(8, 14, 28, 0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full mt-1.5 animate-pulse"
            style={{ background: alert ? 'var(--risk-critical)' : 'var(--accent-cyan)', boxShadow: `0 0 8px ${alert ? 'var(--risk-critical)' : 'var(--accent-cyan)'}` }} />
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {alert ? 'Suspicious Activity Detected' : 'New Transaction'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {truncateAddress(tx.from_address)} → {truncateAddress(tx.to_address)} · {formatCurrency(tx.amount)}
            </p>
            {alert && (
              <div className="mt-2 flex gap-2">
                <span className="text-xs px-2 py-0.5 rounded font-semibold"
                  style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--risk-critical)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                  Cluster #{alert.cluster_id} · {alert.risk_level.toUpperCase()}
                </span>
                {alert.typology && alert.typology !== 'Unclassified' && (
                  <span className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
                    {alert.typology}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={() => { setVisible(false); onDismiss(); }}
            className="text-xs opacity-50 hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
            &times;
          </button>
        </div>
      </div>
    </div>
  );
}
