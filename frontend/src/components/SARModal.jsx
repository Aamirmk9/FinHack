import { useState } from 'react';

export default function SARModal({ sar, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sar.sar_narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-[800px] max-h-[85vh] rounded-xl border flex flex-col"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-lg font-bold">Suspicious Activity Report</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Cluster #{sar.cluster_id} · Generated {sar.generated_by === 'ai' ? 'by AI' : 'from template'}
              {sar.model && ` (${sar.model})`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border"
              style={{
                borderColor: copied ? 'var(--risk-low)' : 'var(--border)',
                color: copied ? 'var(--risk-low)' : 'var(--text-primary)',
                background: copied ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
              }}>
              {copied ? 'Copied' : 'Copy to Clipboard'}
            </button>
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ color: 'var(--text-secondary)' }}>
              Close
            </button>
          </div>
        </div>

        {/* SAR Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono"
            style={{ color: 'var(--text-primary)' }}>
            {sar.sar_narrative}
          </pre>
        </div>
      </div>
    </div>
  );
}
