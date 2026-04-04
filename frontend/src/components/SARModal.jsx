import { useState } from 'react';

const ACTIONS = [
  {
    id: 'case',
    label: 'Open Case File',
    icon: '📁',
    desc: 'Assign case number and initiate formal investigation',
    agency: 'Internal',
    time: '~2s',
    result: (clusterId) => ({
      title: 'Case File Opened',
      details: [
        { label: 'Case Number', value: `FIU-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}` },
        { label: 'Status', value: 'ACTIVE — Assigned to Lead Analyst', color: '#3b82f6' },
        { label: 'Classification', value: 'LAW ENFORCEMENT SENSITIVE' },
        { label: 'Priority', value: 'HIGH' },
      ],
    }),
  },
  {
    id: 'preserve',
    label: 'Issue Preservation Letter',
    icon: '🔒',
    desc: 'Compel exchanges to preserve account records for 90 days — no court order required',
    agency: 'Exchange/VASP',
    time: '~3s',
    result: (clusterId) => ({
      title: 'Preservation Letter Issued',
      details: [
        { label: 'Letter ID', value: `PL-${Date.now().toString(36).toUpperCase()}` },
        { label: 'Directed To', value: 'Binance, Coinbase, Kraken (auto-detected)' },
        { label: 'Retention Period', value: '90 Days' },
        { label: 'Scope', value: 'All account records, KYC, transaction history' },
        { label: 'Legal Basis', value: '18 U.S.C. § 2703(f)' },
      ],
    }),
  },
  {
    id: 'freeze',
    label: 'Request Asset Freeze',
    icon: '🧊',
    desc: 'Submit court-ordered restraint on exchange-held assets via AUSA',
    agency: 'DOJ / USAO',
    time: '~4s',
    result: (clusterId) => ({
      title: 'Freeze Request Submitted',
      details: [
        { label: 'Request ID', value: `FR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}` },
        { label: 'Routed To', value: 'Assistant U.S. Attorney — Asset Forfeiture Unit' },
        { label: 'Type', value: 'Temporary Restraining Order (TRO)' },
        { label: 'Status', value: 'PENDING JUDICIAL REVIEW', color: '#f59e0b' },
        { label: 'Legal Basis', value: '18 U.S.C. § 981 — Civil Forfeiture' },
      ],
    }),
  },
  {
    id: 'subpoena',
    label: 'Serve Administrative Subpoena',
    icon: '📋',
    desc: 'Compel exchanges to produce KYC records and transaction history',
    agency: 'FBI / HSI / IRS-CI',
    time: '~3s',
    result: (clusterId) => ({
      title: 'Subpoena Served',
      details: [
        { label: 'Subpoena ID', value: `SUB-${Date.now().toString(36).toUpperCase()}` },
        { label: 'Type', value: 'Administrative Subpoena' },
        { label: 'Records Requested', value: 'KYC identity, full transaction logs, IP logs, linked accounts' },
        { label: 'Compliance Deadline', value: '14 Business Days' },
        { label: 'Authority', value: '31 U.S.C. § 5318(a) — Bank Secrecy Act' },
      ],
    }),
  },
  {
    id: 'refer',
    label: 'Refer to Agency',
    icon: '🏛️',
    desc: 'Formal referral package to FBI, HSI, DEA, or IRS-CI with full evidence',
    agency: 'Inter-Agency',
    time: '~3s',
    agencies: ['FBI — Cyber Division', 'HSI — Transnational Crime', 'DEA — Narcotics Proceeds', 'IRS-CI — Tax Evasion'],
    result: (clusterId, agency) => ({
      title: 'Agency Referral Submitted',
      details: [
        { label: 'Referral ID', value: `REF-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}` },
        { label: 'Referred To', value: agency || 'FBI — Cyber Division' },
        { label: 'Package', value: 'Case summary, wallet graph, transaction logs, risk analysis' },
        { label: 'Status', value: 'SENT — Awaiting Acknowledgment', color: '#3b82f6' },
        { label: 'Deconfliction', value: 'Cleared via HIDTA/OCDETF — No existing investigation' },
      ],
    }),
  },
  {
    id: 'intel',
    label: 'Generate Intel Report',
    icon: '📊',
    desc: 'Produce classified intelligence brief for prosecution referral to USAO',
    agency: 'USAO / DOJ',
    time: '~4s',
    result: (clusterId) => ({
      title: 'Intelligence Report Generated',
      details: [
        { label: 'Report ID', value: `FININT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}` },
        { label: 'Classification', value: 'LAW ENFORCEMENT SENSITIVE' },
        { label: 'Type', value: 'Financial Intelligence Assessment' },
        { label: 'Distribution', value: 'USAO, Case Agent, Supervisory Analyst' },
        { label: 'Status', value: 'READY FOR REVIEW', color: '#22c55e' },
      ],
    }),
  },
];

export default function SARModal({ sar, onClose }) {
  const [copied, setCopied] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [completedActions, setCompletedActions] = useState({});
  const [selectedAgency, setSelectedAgency] = useState(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(sar.sar_narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = (action) => {
    if (completedActions[action.id]) return;
    if (action.agencies && !selectedAgency) {
      setActiveAction(action);
      return;
    }
    setActiveAction(action);
    setProcessing(true);
    const delay = parseInt(action.time) * 1000 || 3000;
    setTimeout(() => {
      setProcessing(false);
      setCompletedActions(prev => ({
        ...prev,
        [action.id]: action.result(sar.cluster_id, selectedAgency),
      }));
      setSelectedAgency(null);
    }, delay);
  };

  const confirmAgency = (agency, action) => {
    setSelectedAgency(agency);
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setCompletedActions(prev => ({
        ...prev,
        [action.id]: action.result(sar.cluster_id, agency),
      }));
      setActiveAction(null);
      setSelectedAgency(null);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      onClick={onClose}>
      <div className="animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          background: 'var(--bg-card)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: '#ef4444' }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>
                Intelligence Report — Cluster #{sar.cluster_id}
              </h2>
            </div>
            <p style={{ fontSize: 10, color: '#666', margin: '3px 0 0' }}>
              Generated {sar.generated_by === 'ai' ? 'by AI' : 'from template'}
              {sar.model && ` (${sar.model})`} · {Object.keys(completedActions).length} action{Object.keys(completedActions).length !== 1 ? 's' : ''} taken
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleCopy}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
                background: copied ? 'rgba(34,197,94,0.08)' : 'transparent',
                color: copied ? '#22c55e' : '#999', cursor: 'pointer',
              }}>
              {copied ? 'Copied' : 'Copy Narrative'}
            </button>
            <button onClick={onClose}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 11,
                border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
                color: '#666', cursor: 'pointer',
              }}>
              Close
            </button>
          </div>
        </div>

        {/* Two-column layout: narrative + actions */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

          {/* Left: Narrative */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 9, fontWeight: 600, color: '#666', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
              Analyst Narrative
            </p>
            <pre style={{
              whiteSpace: 'pre-wrap', fontSize: 11.5, lineHeight: 1.7,
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              color: '#bbb', margin: 0,
            }}>
              {sar.sar_narrative}
            </pre>
          </div>

          {/* Right: Actions */}
          <div style={{ width: 320, flexShrink: 0, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 9, fontWeight: 600, color: '#666', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>
              Enforcement Actions
            </p>

            {ACTIONS.map((action) => {
              const completed = completedActions[action.id];
              const isActive = activeAction?.id === action.id;
              const isProcessing = isActive && processing;

              return (
                <div key={action.id}>
                  <button
                    onClick={() => handleAction(action)}
                    disabled={isProcessing}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                      border: completed
                        ? '1px solid rgba(34,197,94,0.15)'
                        : isProcessing
                          ? '1px solid rgba(239,68,68,0.2)'
                          : '1px solid rgba(255,255,255,0.06)',
                      background: completed
                        ? 'rgba(34,197,94,0.04)'
                        : isProcessing
                          ? 'rgba(239,68,68,0.04)'
                          : 'rgba(255,255,255,0.02)',
                      cursor: completed ? 'default' : isProcessing ? 'wait' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!completed && !isProcessing) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (!completed && !isProcessing) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14 }}>{completed ? '✓' : isProcessing ? '' : action.icon}</span>
                      {isProcessing && (
                        <span style={{
                          width: 14, height: 14, border: '2px solid #ef4444',
                          borderTopColor: 'transparent', borderRadius: 7,
                          animation: 'spin 0.8s linear infinite', display: 'inline-block',
                        }} />
                      )}
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: completed ? '#22c55e' : isProcessing ? '#ef4444' : '#e0e0e0',
                      }}>
                        {isProcessing ? 'Processing...' : completed ? completed.title : action.label}
                      </span>
                    </div>
                    {!completed && !isProcessing && (
                      <p style={{ fontSize: 10, color: '#666', margin: '0 0 0 22px', lineHeight: 1.4 }}>
                        {action.desc}
                      </p>
                    )}
                    {!completed && !isProcessing && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, marginLeft: 22 }}>
                        <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace' }}>{action.agency}</span>
                      </div>
                    )}
                  </button>

                  {/* Agency selector for referral */}
                  {isActive && action.agencies && !processing && !completed && (
                    <div style={{
                      margin: '4px 0 0 0', padding: 8, borderRadius: 6,
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <p style={{ fontSize: 9, color: '#666', margin: '0 0 6px', fontWeight: 600 }}>SELECT RECEIVING AGENCY</p>
                      {action.agencies.map((agency) => (
                        <button key={agency} onClick={() => confirmAgency(agency, action)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '6px 8px', marginBottom: 3, borderRadius: 4,
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.04)',
                            color: '#bbb', fontSize: 10, cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                        >
                          {agency}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Completed result */}
                  {completed && (
                    <div style={{
                      margin: '4px 0 0 0', padding: '8px 10px', borderRadius: 6,
                      background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.08)',
                    }}>
                      {completed.details.map((d) => (
                        <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 9, color: '#555' }}>{d.label}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 600, fontFamily: 'monospace',
                            color: d.color || '#888', textAlign: 'right', maxWidth: 180,
                          }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 20px', borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: '#555' }}>ShadowTrace Financial Intelligence Platform</span>
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#ef4444', fontWeight: 600, letterSpacing: 1 }}>LAW ENFORCEMENT SENSITIVE</span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
