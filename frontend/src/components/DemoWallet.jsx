import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Two realistic "bank" accounts
const ACCOUNTS = {
  personal: {
    id: 'personal',
    name: 'Personal Checking',
    holder: 'Alex Morgan',
    number: '•••• 4821',
    address: '0xDEMO_PERSONAL_ACCT_001_LIVE',
    balance: 87432.50,
    icon: '👤',
  },
  business: {
    id: 'business',
    name: 'Business Operations',
    holder: 'Morgan Capital LLC',
    number: '•••• 7193',
    address: '0xDEMO_BUSINESS_ACCT_002_LIVE',
    balance: 243810.75,
    icon: '🏢',
  },
};

// Seed some realistic-looking transaction history
const SEED_HISTORY = {
  personal: [
    { type: 'received', from: 'Payroll Direct Dep.', amount: 4250.00, time: 'Mar 28', status: 'clear' },
    { type: 'sent', to: 'Rent — Apt 14B', amount: 2100.00, time: 'Mar 25', status: 'clear' },
    { type: 'sent', to: 'Amazon', amount: 67.43, time: 'Mar 22', status: 'clear' },
    { type: 'received', from: 'Venmo Transfer', amount: 150.00, time: 'Mar 20', status: 'clear' },
    { type: 'sent', to: 'Whole Foods', amount: 124.87, time: 'Mar 18', status: 'clear' },
  ],
  business: [
    { type: 'received', from: 'Client — Apex Inc.', amount: 18500.00, time: 'Mar 30', status: 'clear' },
    { type: 'sent', to: 'AWS Cloud Services', amount: 3420.00, time: 'Mar 27', status: 'clear' },
    { type: 'sent', to: 'Contractor — J.Wu', amount: 6000.00, time: 'Mar 24', status: 'clear' },
    { type: 'received', from: 'Client — Bolt Co.', amount: 12000.00, time: 'Mar 21', status: 'clear' },
    { type: 'sent', to: 'Office Lease Q2', amount: 8500.00, time: 'Mar 15', status: 'clear' },
  ],
};

// Quick amount presets
const QUICK_AMOUNTS = [1000, 5000, 9500, 15000, 25000, 50000];

export default function DemoWallet() {
  const [activeAccount, setActiveAccount] = useState('personal');
  const [mode, setMode] = useState(null); // null | 'send' | 'receive'
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [balances, setBalances] = useState({
    personal: ACCOUNTS.personal.balance,
    business: ACCOUNTS.business.balance,
  });
  const [history, setHistory] = useState({
    personal: [...SEED_HISTORY.personal],
    business: [...SEED_HISTORY.business],
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const amountRef = useRef(null);

  // Allow scrolling on this page (body is overflow:hidden globally)
  useLayoutEffect(() => {
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const acct = ACCOUNTS[activeAccount];
  const otherAcct = activeAccount === 'personal' ? 'business' : 'personal';
  const parsedAmount = parseFloat(amount) || 0;
  const isHighValue = parsedAmount >= 15000;

  // Auto-focus amount input when mode opens
  useEffect(() => {
    if (mode && amountRef.current) {
      setTimeout(() => amountRef.current.focus(), 300);
    }
  }, [mode]);

  const handleTransaction = async () => {
    if (parsedAmount <= 0) return;
    setSending(true);
    setResult(null);

    const fromAddr = mode === 'send' ? acct.address : (recipient === 'external' ? '0xEXTERNAL_UNKNOWN_ENTITY_001' : ACCOUNTS[otherAcct].address);
    const toAddr = mode === 'send' ? (recipient === 'external' ? '0xEXTERNAL_UNKNOWN_ENTITY_001' : ACCOUNTS[otherAcct].address) : acct.address;

    try {
      const resp = await api.post('/inject', {
        from_address: fromAddr,
        to_address: toAddr,
        amount: parsedAmount,
      });

      setResult(resp.data);

      // Update balances
      setBalances(prev => {
        const updated = { ...prev };
        if (mode === 'send') {
          updated[activeAccount] -= parsedAmount;
          if (recipient !== 'external') updated[otherAcct] += parsedAmount;
        } else {
          updated[activeAccount] += parsedAmount;
          if (recipient !== 'external') updated[otherAcct] -= parsedAmount;
        }
        return updated;
      });

      // Add to history
      const recipientLabel = recipient === 'external' ? 'External Transfer' :
        ACCOUNTS[otherAcct].name;
      const txEntry = {
        type: mode === 'send' ? 'sent' : 'received',
        ...(mode === 'send' ? { to: recipientLabel } : { from: recipientLabel }),
        amount: parsedAmount,
        time: 'Just now',
        status: resp.data.alert ? 'flagged' : 'clear',
        alert: resp.data.alert,
        senderScore: resp.data.sender_score,
        receiverScore: resp.data.receiver_score,
      };

      setHistory(prev => ({
        ...prev,
        [activeAccount]: [txEntry, ...prev[activeAccount]],
      }));

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        if (!resp.data.alert) {
          setMode(null);
          setAmount('');
          setRecipient('');
        }
      }, 2000);

    } catch (e) {
      setResult({ error: 'Transaction failed. Tap to retry.' });
    }
    setSending(false);
  };

  const formatMoney = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  // ── Main account view ──
  if (!mode) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        {/* Status bar */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--risk-low)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Live</span>
          </div>
        </div>

        {/* Account switcher tabs */}
        <div className="px-4 flex gap-2 mb-2">
          {Object.values(ACCOUNTS).map(a => (
            <button key={a.id} onClick={() => setActiveAccount(a.id)}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300"
              style={{
                background: activeAccount === a.id ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                border: `1px solid ${activeAccount === a.id ? 'rgba(6, 182, 212, 0.3)' : 'var(--glass-border)'}`,
                color: activeAccount === a.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              }}>
              {a.icon} {a.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Balance card */}
        <div className="mx-4 p-5 rounded-2xl relative overflow-hidden" style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(59, 130, 246, 0.06))',
          border: '1px solid rgba(6, 182, 212, 0.15)',
        }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.06), transparent)', transform: 'translate(30%, -30%)' }} />
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>
            {acct.name}
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            {acct.holder} — {acct.number}
          </p>
          <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {formatMoney(balances[activeAccount])}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--risk-low)' }}>Available balance</p>
        </div>

        {/* Action buttons */}
        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => { setMode('send'); setRecipient(''); }}
            className="py-4 rounded-2xl font-semibold text-sm flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
              color: '#000',
              boxShadow: '0 4px 20px rgba(6, 182, 212, 0.25)',
            }}>
            <span className="text-xl">↑</span>
            Send Money
          </button>
          <button onClick={() => { setMode('receive'); setRecipient(''); }}
            className="py-4 rounded-2xl font-semibold text-sm flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: 'var(--risk-low)',
            }}>
            <span className="text-xl">↓</span>
            Receive Money
          </button>
        </div>

        {/* Transaction history */}
        <div className="px-4 mt-5 flex-1 overflow-y-auto pb-6" style={{ maxHeight: 'calc(100vh - 360px)' }}>
          <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Recent Transactions
          </p>
          <div className="space-y-1.5">
            {history[activeAccount].map((tx, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl transition-all"
                style={{
                  background: tx.status === 'flagged' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(10, 18, 32, 0.4)',
                  border: `1px solid ${tx.status === 'flagged' ? 'rgba(239, 68, 68, 0.2)' : 'var(--glass-border)'}`,
                  animation: tx.time === 'Just now' ? 'fadeInUp 0.4s ease-out' : 'none',
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    style={{
                      background: tx.type === 'sent' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                      color: tx.type === 'sent' ? '#ef4444' : '#22c55e',
                    }}>
                    {tx.type === 'sent' ? '↑' : '↓'}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tx.type === 'sent' ? tx.to : tx.from}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{tx.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{
                    color: tx.type === 'sent' ? '#ef4444' : '#22c55e',
                  }}>
                    {tx.type === 'sent' ? '-' : '+'}{formatMoney(tx.amount)}
                  </p>
                  {tx.status === 'flagged' && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)' }}>
                      FLAGGED
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Send / Receive sheet ──
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={() => { setMode(null); setAmount(''); setRecipient(''); setResult(null); }}
          className="text-sm px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
          style={{ color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.08)' }}>
          ← Back
        </button>
        <span className="text-sm font-bold uppercase tracking-wider"
          style={{ color: mode === 'send' ? 'var(--accent-cyan)' : 'var(--risk-low)' }}>
          {mode === 'send' ? 'Send Money' : 'Receive Money'}
        </span>
        <div style={{ width: 60 }} />
      </div>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-6">
        {/* From/To info */}
        <div className="glass-card-static p-4">
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
            {mode === 'send' ? 'From' : 'To'} (Your Account)
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
              {acct.icon}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{acct.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Balance: {formatMoney(balances[activeAccount])}
              </p>
            </div>
          </div>
        </div>

        {/* Recipient / Sender picker */}
        <div className="glass-card-static p-4">
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            {mode === 'send' ? 'Send to' : 'Receive from'}
          </p>
          <div className="space-y-2">
            {/* Other internal account */}
            <button onClick={() => setRecipient('internal')}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98]"
              style={{
                background: recipient === 'internal' ? 'rgba(6, 182, 212, 0.08)' : 'rgba(10, 18, 32, 0.4)',
                border: `1px solid ${recipient === 'internal' ? 'rgba(6, 182, 212, 0.3)' : 'var(--glass-border)'}`,
              }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-base"
                style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                {ACCOUNTS[otherAcct].icon}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ACCOUNTS[otherAcct].name}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ACCOUNTS[otherAcct].number}</p>
              </div>
              {recipient === 'internal' && (
                <span className="ml-auto text-xs" style={{ color: 'var(--accent-cyan)' }}>✓</span>
              )}
            </button>

            {/* External unknown entity */}
            <button onClick={() => setRecipient('external')}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98]"
              style={{
                background: recipient === 'external' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(10, 18, 32, 0.4)',
                border: `1px solid ${recipient === 'external' ? 'rgba(239, 68, 68, 0.2)' : 'var(--glass-border)'}`,
              }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-base"
                style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
                🌐
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>External Transfer</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Unknown third party</p>
              </div>
              {recipient === 'external' && (
                <span className="ml-auto text-xs" style={{ color: 'var(--risk-critical)' }}>✓</span>
              )}
            </button>
          </div>
        </div>

        {/* Amount input */}
        <div className="glass-card-static p-4">
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Amount</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold"
              style={{ color: 'var(--text-secondary)' }}>$</span>
            <input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full py-4 pl-12 pr-4 rounded-xl text-2xl font-bold text-center"
              style={{
                background: 'rgba(10, 18, 32, 0.6)',
                border: `1px solid ${isHighValue ? 'rgba(239, 68, 68, 0.3)' : 'var(--glass-border)'}`,
                color: 'var(--text-primary)',
                outline: 'none',
                caretColor: 'var(--accent-cyan)',
              }}
            />
          </div>

          {/* High value warning */}
          {isHighValue && (
            <div className="mt-3 p-2.5 rounded-xl flex items-center gap-2 animate-fade-in-up"
              style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              <span className="text-base">⚠</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--risk-critical)' }}>
                  High-value transaction — {formatMoney(parsedAmount)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Subject to enhanced monitoring & reporting
                </p>
              </div>
            </div>
          )}

          {/* Quick amounts */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {QUICK_AMOUNTS.map(q => (
              <button key={q} onClick={() => setAmount(String(q))}
                className="py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                style={{
                  background: parsedAmount === q ? 'rgba(6, 182, 212, 0.1)' : 'rgba(10, 18, 32, 0.4)',
                  border: `1px solid ${parsedAmount === q ? 'rgba(6, 182, 212, 0.3)' : 'var(--glass-border)'}`,
                  color: parsedAmount === q ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                }}>
                {q >= 15000 && <span style={{ color: 'var(--risk-high)' }}>! </span>}
                ${q >= 1000 ? `${q / 1000}k` : q}
              </button>
            ))}
          </div>
        </div>

        {/* Result after send */}
        {result && !result.error && (
          <div className="glass-card-static p-4 animate-fade-in-up" style={{
            border: result.alert ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(34, 197, 94, 0.25)',
          }}>
            {showSuccess && !result.alert && (
              <div className="text-center py-2">
                <div className="text-3xl mb-2">✓</div>
                <p className="text-sm font-semibold" style={{ color: 'var(--risk-low)' }}>Transaction Complete</p>
              </div>
            )}
            {result.alert && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full risk-pulse"
                    style={{ background: 'var(--risk-critical)', boxShadow: '0 0 8px var(--risk-critical)' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--risk-critical)' }}>
                    ARIA Alert Triggered
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Cluster ID</span>
                    <span className="font-mono font-bold">#{result.alert.cluster_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Risk Score</span>
                    <span className="font-bold" style={{
                      color: result.alert.score >= 70 ? 'var(--risk-critical)' :
                        result.alert.score >= 40 ? 'var(--risk-high)' : 'var(--risk-medium)',
                    }}>{result.alert.score?.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Risk Level</span>
                    <span className="font-bold uppercase" style={{
                      color: result.alert.risk_level === 'critical' ? 'var(--risk-critical)' :
                        result.alert.risk_level === 'high' ? 'var(--risk-high)' : 'var(--risk-medium)',
                    }}>{result.alert.risk_level}</span>
                  </div>
                  {result.alert.typology && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Typology</span>
                      <span className="font-bold">{result.alert.typology}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Sender Score</span>
                    <span className="font-bold">{result.sender_score?.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Receiver Score</span>
                    <span className="font-bold">{result.receiver_score?.toFixed(1)}</span>
                  </div>
                </div>
                <div className="mt-3 p-2 rounded-lg text-center" style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                }}>
                  <p className="text-xs" style={{ color: 'var(--risk-critical)' }}>
                    Open the dashboard to see the 3D graph update, alert feed, and SAR generation
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {result && result.error && (
          <div className="glass-card-static p-4 text-center animate-fade-in-up"
            style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <p className="text-sm" style={{ color: 'var(--risk-critical)' }}>{result.error}</p>
          </div>
        )}

        {/* Spacer for bottom button */}
        <div style={{ height: 80 }} />
      </div>

      {/* Fixed bottom send button */}
      <div className="fixed bottom-0 left-0 right-0 p-4" style={{
        background: 'linear-gradient(to top, var(--bg-primary) 70%, transparent)',
      }}>
        <button
          onClick={handleTransaction}
          disabled={sending || !recipient || parsedAmount <= 0}
          className="w-full py-4 rounded-2xl text-base font-bold transition-all active:scale-[0.98]"
          style={{
            background: (sending || !recipient || parsedAmount <= 0)
              ? 'rgba(100, 116, 139, 0.2)'
              : mode === 'send'
                ? 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))'
                : 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: (sending || !recipient || parsedAmount <= 0) ? 'var(--text-secondary)' : '#000',
            boxShadow: (sending || !recipient || parsedAmount <= 0) ? 'none'
              : mode === 'send'
                ? '0 4px 20px rgba(6, 182, 212, 0.3)'
                : '0 4px 20px rgba(34, 197, 94, 0.3)',
          }}
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--text-secondary)', borderTopColor: 'transparent' }} />
              Processing...
            </span>
          ) : (
            <>
              {mode === 'send' ? 'Send' : 'Request'} {parsedAmount > 0 ? formatMoney(parsedAmount) : ''}
              {isHighValue ? ' ⚠' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
