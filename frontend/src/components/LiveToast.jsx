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
      className="fixed top-4 right-4 z-50 max-w-sm transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(8px)',
      }}
    >
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${alert ? 'rgba(239,68,68,0.15)' : '#1a1a1a'}`,
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0,
            background: alert ? '#dc2626' : '#16a34a',
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: alert ? '#dc2626' : '#e0e0e0' }}>
              {alert ? 'Threat Detected' : 'New Transaction'}
            </p>
            <p style={{ fontSize: 11, margin: '3px 0 0', color: '#666' }}>
              {truncateAddress(tx.from_address)} → {truncateAddress(tx.to_address)} · {formatCurrency(tx.amount)}
            </p>
            {alert && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                  background: 'rgba(239,68,68,0.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.15)',
                }}>
                  Cluster #{alert.cluster_id} · {alert.risk_level.toUpperCase()}
                </span>
                {alert.typology && alert.typology !== 'Unclassified' && (
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(8,145,178,0.08)', color: '#0891b2', border: '1px solid rgba(8,145,178,0.15)',
                  }}>
                    {alert.typology}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={() => { setVisible(false); onDismiss(); }}
            style={{
              fontSize: 16, border: 'none', background: 'none', cursor: 'pointer',
              color: '#666', padding: 0, lineHeight: 1,
            }}>
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
