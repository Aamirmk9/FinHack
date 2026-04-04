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
      <div className="w-[820px] max-h-[85vh] glass-card flex flex-col animate-modal-in glow-cyan"
        style={{ background: 'rgba(8, 14, 28, 0.85)', backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--glass-border)' }}>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--risk-critical)' }} />
              <h2 className="text-lg font-bold">Suspicious Activity Report</h2>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Cluster #{sar.cluster_id} &middot; Generated {sar.generated_by === 'ai' ? 'by AI' : 'from template'}
              {sar.model && ` (${sar.model})`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                border: `1px solid ${copied ? 'var(--risk-low)' : 'var(--glass-border)'}`,
                color: copied ? 'var(--risk-low)' : 'var(--text-primary)',
                background: copied ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                boxShadow: copied ? '0 0 12px rgba(34, 197, 94, 0.15)' : 'none',
              }}>
              {copied ? 'Copied' : 'Copy Report'}
            </button>
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm transition-opacity hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}>
              Close
            </button>
          </div>
        </div>

        {/* SAR Content */}
        <div className="flex-1 overflow-y-auto p-6 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono"
            style={{ color: 'var(--text-primary)' }}>
            {sar.sar_narrative}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--glass-border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            ShadowTrace Financial Intelligence Platform
          </span>
          <span className="text-xs font-mono" style={{ color: 'var(--accent-cyan)', opacity: 0.5 }}>
            CONFIDENTIAL
          </span>
        </div>
      </div>
    </div>
  );
}
