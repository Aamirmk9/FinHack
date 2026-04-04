import { useState } from 'react';

export default function SARModal({ sar, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sar.sar_narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      onClick={onClose}>
      <div className="animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 780, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #1a1a1a',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #222222',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: '#dc2626' }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>
                Suspicious Activity Report
              </h2>
            </div>
            <p style={{ fontSize: 10, color: '#666', margin: '3px 0 0' }}>
              Cluster #{sar.cluster_id} · Generated {sar.generated_by === 'ai' ? 'by AI' : 'from template'}
              {sar.model && ` (${sar.model})`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleCopy}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                border: `1px solid ${copied ? 'rgba(34,197,94,0.15)' : '#1a1a1a'}`,
                background: copied ? 'rgba(34,197,94,0.08)' : '#fff',
                color: copied ? '#16a34a' : '#bbb',
                cursor: 'pointer',
              }}>
              {copied ? 'Copied' : 'Copy Report'}
            </button>
            <button onClick={onClose}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 11,
                border: '1px solid #1a1a1a', background: 'var(--bg-card)',
                color: '#666', cursor: 'pointer',
              }}>
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          <pre style={{
            whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.7,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            color: '#bbb', margin: 0,
          }}>
            {sar.sar_narrative}
          </pre>
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px', borderTop: '1px solid #222222',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: '#666' }}>
            ShadowTrace Financial Intelligence Platform
          </span>
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#dc2626', fontWeight: 600, letterSpacing: 1 }}>
            CONFIDENTIAL
          </span>
        </div>
      </div>
    </div>
  );
}
