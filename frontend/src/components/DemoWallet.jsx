import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

const ACCOUNTS = {
  personal: {
    id: 'personal', name: 'Personal', holder: 'Hassan Khan', number: '•••• 4821',
    address: '0xDEMO_PERSONAL_ACCT_001_LIVE', balance: 918380.70,
  },
  business: {
    id: 'business', name: 'Business', holder: 'Khan Capital LLC', number: '•••• 7193',
    address: '0xDEMO_BUSINESS_ACCT_002_LIVE', balance: 243810.75,
  },
};

const RECEIVER_ACCOUNT = {
  name: 'Offshore Holdings', holder: 'Unknown Entity', number: '•••• 0091',
  address: '0xEXTERNAL_UNKNOWN_ENTITY_001', balance: 12450.00,
};

const SEED_HISTORY = {
  personal: [
    { type: 'received', from: 'Payroll Deposit', amount: 4250.00, time: '30 min ago', icon: '💰', status: 'clear' },
    { type: 'sent', to: 'Rent Payment', amount: 2100.00, time: '2 days ago', icon: '🏠', status: 'clear' },
    { type: 'sent', to: 'Amazon', amount: 67.43, time: '3 days ago', icon: '📦', status: 'clear' },
    { type: 'received', from: 'Zelle Transfer', amount: 150.00, time: '5 days ago', icon: '💸', status: 'clear' },
  ],
  business: [
    { type: 'received', from: 'Client — Apex Inc.', amount: 18500.00, time: '1 day ago', icon: '🏢', status: 'clear' },
    { type: 'sent', to: 'AWS Services', amount: 3420.00, time: '3 days ago', icon: '☁️', status: 'clear' },
    { type: 'sent', to: 'Contractor — J.Wu', amount: 6000.00, time: '5 days ago', icon: '👤', status: 'clear' },
  ],
};

const STRUCTURING_AMOUNTS = [9500, 9800, 9200, 9700, 9400];
const QUICK_AMOUNTS = [1000, 5000, 9500, 15000, 25000, 50000];

const CONTACTS = [
  { name: 'Sarah', initials: 'SM', color: '#6366f1' },
  { name: 'Mike', initials: 'MJ', color: '#f59e0b' },
  { name: 'Alex', initials: 'AK', color: '#ef4444' },
  { name: 'Priya', initials: 'PD', color: '#22c55e' },
  { name: 'James', initials: 'JP', color: '#3b82f6' },
];

export default function DemoWallet() {
  // Check URL for role=receiver
  const params = new URLSearchParams(window.location.search);
  const isReceiver = params.get('role') === 'receiver';

  const [activeAccount, setActiveAccount] = useState('personal');
  const [mode, setMode] = useState(null);
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
  const [structuring, setStructuring] = useState(false);
  const [structureStep, setStructureStep] = useState(0);
  const amountRef = useRef(null);

  // Receiver state
  const [recvBalance, setRecvBalance] = useState(RECEIVER_ACCOUNT.balance);
  const [recvHistory, setRecvHistory] = useState([
    { type: 'received', from: 'Wire Transfer', amount: 5200.00, time: '2 days ago', icon: '💸', status: 'clear' },
    { type: 'sent', to: 'Cash Withdrawal', amount: 3000.00, time: '4 days ago', icon: '🏧', status: 'clear' },
  ]);

  // WebSocket listener for receiver — listen for incoming transactions
  useEffect(() => {
    if (!isReceiver) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const ws = new WebSocket(`${protocol}//${host}:8000/ws`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'transaction_injected' && data.transaction.to_address === RECEIVER_ACCOUNT.address) {
          const amt = data.transaction.amount;
          setRecvBalance(prev => prev + amt);
          setRecvHistory(prev => [{
            type: 'received',
            from: 'Incoming Transfer',
            amount: amt,
            time: 'Just now',
            icon: '🔴',
            status: data.alert ? 'flagged' : 'clear',
          }, ...prev]);
        }
      } catch {}
    };
    const keepalive = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 30000);
    return () => { clearInterval(keepalive); ws.close(); };
  }, [isReceiver]);

  useLayoutEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.background = '#0a0e1a';
    return () => { document.body.style.overflow = ''; document.body.style.background = ''; };
  }, []);

  const acct = ACCOUNTS[activeAccount];
  const otherAcct = activeAccount === 'personal' ? 'business' : 'personal';
  const parsedAmount = parseFloat(amount) || 0;
  const isHighValue = parsedAmount >= 15000;

  useEffect(() => {
    if (mode && amountRef.current) setTimeout(() => amountRef.current.focus(), 300);
  }, [mode]);

  const handleTransaction = async () => {
    if (parsedAmount <= 0) return;
    setSending(true);
    setResult(null);
    const fromAddr = mode === 'send' ? acct.address : (recipient === 'external' ? RECEIVER_ACCOUNT.address : ACCOUNTS[otherAcct].address);
    const toAddr = mode === 'send' ? (recipient === 'external' ? RECEIVER_ACCOUNT.address : ACCOUNTS[otherAcct].address) : acct.address;
    try {
      const resp = await api.post('/inject', { from_address: fromAddr, to_address: toAddr, amount: parsedAmount });
      setResult(resp.data);
      setBalances(prev => {
        const u = { ...prev };
        if (mode === 'send') { u[activeAccount] -= parsedAmount; if (recipient !== 'external') u[otherAcct] += parsedAmount; }
        else { u[activeAccount] += parsedAmount; if (recipient !== 'external') u[otherAcct] -= parsedAmount; }
        return u;
      });
      const label = recipient === 'external' ? 'External Transfer' : ACCOUNTS[otherAcct].name;
      setHistory(prev => ({
        ...prev,
        [activeAccount]: [{
          type: mode === 'send' ? 'sent' : 'received',
          ...(mode === 'send' ? { to: label } : { from: label }),
          amount: parsedAmount, time: 'Just now', icon: recipient === 'external' ? '🌐' : '🔄',
          status: resp.data.alert ? 'flagged' : 'clear', alert: resp.data.alert,
        }, ...prev[activeAccount]],
      }));
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); if (!resp.data.alert) { setMode(null); setAmount(''); setRecipient(''); } }, 2500);
    } catch { setResult({ error: 'Transaction failed.' }); }
    setSending(false);
  };

  // Structuring attack — send 5 rapid sub-threshold transactions
  const runStructuring = async () => {
    setStructuring(true);
    setStructureStep(0);
    for (let i = 0; i < STRUCTURING_AMOUNTS.length; i++) {
      setStructureStep(i + 1);
      const amt = STRUCTURING_AMOUNTS[i];
      try {
        const resp = await api.post('/inject', {
          from_address: acct.address, to_address: RECEIVER_ACCOUNT.address, amount: amt,
        });
        setBalances(prev => ({ ...prev, [activeAccount]: prev[activeAccount] - amt }));
        setHistory(prev => ({
          ...prev,
          [activeAccount]: [{
            type: 'sent', to: 'External Transfer', amount: amt, time: 'Just now', icon: '🌐',
            status: resp.data.alert ? 'flagged' : 'clear', alert: resp.data.alert,
          }, ...prev[activeAccount]],
        }));
      } catch {}
      if (i < STRUCTURING_AMOUNTS.length - 1) await new Promise(r => setTimeout(r, 1200));
    }
    setStructuring(false);
  };

  const fmt = (val) => {
    const parts = Math.abs(val).toFixed(2).split('.');
    return { whole: parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','), cents: parts[1] };
  };
  const formatMoney = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const s = {
    page: { minHeight: '100vh', background: '#0a0e1a', fontFamily: "'Inter', -apple-system, system-ui, sans-serif", color: '#e2e8f0' },
    card: { background: '#111827', borderRadius: 20, boxShadow: '0 2px 16px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' },
    accent: '#c8f542', bgSurface: '#151c2c', border: 'rgba(255,255,255,0.06)',
    textDark: '#e2e8f0', textMed: '#8896ab', textLight: '#4b5563', green: '#22c55e', red: '#ef4444',
  };

  // ═══ RECEIVER VIEW ═══
  if (isReceiver) {
    const bal = fmt(recvBalance);
    return (
      <div style={s.page}>
        <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>?</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: s.textDark, margin: 0 }}>{RECEIVER_ACCOUNT.holder}</p>
              <p style={{ fontSize: 12, color: s.textMed, margin: 0 }}>{RECEIVER_ACCOUNT.name}</p>
            </div>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
            MONITORED
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ ...s.card, padding: '28px 24px', background: 'linear-gradient(135deg, #1c1015, #1a1020)', border: '1px solid rgba(239,68,68,0.1)' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', letterSpacing: 1, textTransform: 'uppercase' }}>Receiving Account</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, margin: '4px 0 4px' }}>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>$</span>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>{bal.whole}</span>
              <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>.{bal.cents}</span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{RECEIVER_ACCOUNT.number}</p>
          </div>
        </div>

        <div style={{ padding: '0 20px 100px' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: s.textDark, margin: '0 0 12px' }}>Incoming Transactions</p>
          <div style={{ ...s.card, overflow: 'hidden' }}>
            {recvHistory.map((tx, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: i < recvHistory.length - 1 ? `1px solid ${s.border}` : 'none',
                background: tx.status === 'flagged' ? 'rgba(239,68,68,0.08)' : '#111827',
                animation: tx.time === 'Just now' ? 'demoSlideIn 0.4s ease-out' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: tx.status === 'flagged' ? 'rgba(239,68,68,0.12)' : s.bgSurface, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{tx.icon}</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: s.textDark, margin: 0 }}>{tx.from || tx.to}</p>
                    <p style={{ fontSize: 11, color: s.textLight, margin: '2px 0 0' }}>
                      {tx.time}
                      {tx.status === 'flagged' && <span style={{ color: s.red, fontWeight: 700, fontSize: 10, marginLeft: 6 }}>FLAGGED</span>}
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: s.green }}>
                  +${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>

        <style>{`@keyframes demoSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      </div>
    );
  }

  // ═══ SENDER HOME SCREEN ═══
  if (!mode) {
    const bal = fmt(balances[activeAccount]);
    return (
      <div style={s.page}>
        <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: s.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#111' }}>H</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: s.textDark, margin: 0 }}>Hello, Hassan</p>
              <p style={{ fontSize: 12, color: s.textMed, margin: 0 }}>Good morning!</p>
            </div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: s.bgSurface, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔔</div>
        </div>

        <div style={{ padding: '16px 20px 8px', display: 'flex', gap: 8 }}>
          {Object.values(ACCOUNTS).map(a => (
            <button key={a.id} onClick={() => setActiveAccount(a.id)} style={{
              flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: activeAccount === a.id ? s.accent : s.bgSurface,
              color: activeAccount === a.id ? '#111' : s.textMed,
            }}>{a.name}</button>
          ))}
        </div>

        <div style={{ padding: '8px 20px' }}>
          <div style={{ ...s.card, padding: '28px 24px', background: 'linear-gradient(135deg, #151c2c, #1a2540)', border: '1px solid rgba(200,245,66,0.1)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, background: 'rgba(200,245,66,0.06)' }} />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', letterSpacing: 1, textTransform: 'uppercase' }}>Available Balance</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, margin: '4px 0 4px' }}>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>$</span>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>{bal.whole}</span>
              <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>.{bal.cents}</span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{acct.holder} — {acct.number}</p>
          </div>
        </div>

        {/* Actions + Structuring button */}
        <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'center', gap: 16 }}>
          {[
            { icon: '↑', label: 'Send', action: () => { setMode('send'); setRecipient(''); } },
            { icon: '↓', label: 'Request', action: () => { setMode('receive'); setRecipient(''); } },
            { icon: '⚡', label: 'Structure', action: runStructuring, danger: true },
            { icon: '≡', label: 'More', action: () => { setMode(null); setAmount(''); setRecipient(''); } },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action} disabled={structuring && btn.label === 'Structure'}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 26,
                background: btn.label === 'Send' ? s.accent : btn.danger ? 'rgba(239,68,68,0.12)' : s.bgSurface,
                border: btn.danger ? '1px solid rgba(239,68,68,0.2)' : btn.label === 'Send' ? 'none' : `1px solid ${s.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, color: btn.label === 'Send' ? '#111' : btn.danger ? '#ef4444' : s.textDark, fontWeight: 700,
                boxShadow: btn.label === 'Send' ? '0 4px 16px rgba(200,245,66,0.4)' : btn.danger ? '0 4px 12px rgba(239,68,68,0.15)' : 'none',
              }}>{btn.icon}</div>
              <span style={{ fontSize: 11, color: btn.danger ? '#ef4444' : s.textMed, fontWeight: 500 }}>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Structuring progress */}
        {structuring && (
          <div style={{ padding: '0 20px', animation: 'demoSlideIn 0.3s ease-out' }}>
            <div style={{ ...s.card, padding: '14px 16px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: '#ef4444', animation: 'demoPulse 0.8s infinite' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Structuring Attack</span>
                <span style={{ fontSize: 11, color: s.textMed, marginLeft: 'auto' }}>{structureStep}/{STRUCTURING_AMOUNTS.length}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {STRUCTURING_AMOUNTS.map((a, i) => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: i < structureStep ? '#ef4444' : 'rgba(255,255,255,0.06)',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
              <p style={{ fontSize: 10, color: s.textMed, margin: '6px 0 0' }}>
                Sending ${STRUCTURING_AMOUNTS.map(a => a.toLocaleString()).join(' → $')}
              </p>
            </div>
          </div>
        )}

        {/* Contacts */}
        <div style={{ padding: '8px 20px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: s.textMed, margin: '0 0 10px' }}>Recent</p>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
            {CONTACTS.map(c => (
              <div key={c.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>{c.initials}</div>
                <span style={{ fontSize: 10, color: s.textMed }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <div style={{ padding: '16px 20px 100px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: s.textDark, margin: 0 }}>Transactions</p>
            <span style={{ fontSize: 12, color: s.textMed }}>View all</span>
          </div>
          <div style={{ ...s.card, overflow: 'hidden' }}>
            {history[activeAccount].map((tx, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: i < history[activeAccount].length - 1 ? `1px solid ${s.border}` : 'none',
                background: tx.status === 'flagged' ? 'rgba(239,68,68,0.08)' : '#111827',
                animation: tx.time === 'Just now' ? 'demoSlideIn 0.4s ease-out' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: s.bgSurface, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{tx.icon || '↑'}</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: s.textDark, margin: 0 }}>{tx.type === 'sent' ? tx.to : tx.from}</p>
                    <p style={{ fontSize: 11, color: s.textLight, margin: '2px 0 0' }}>
                      {tx.time}{tx.status === 'flagged' && <span style={{ color: s.red, fontWeight: 700, fontSize: 10, marginLeft: 6 }}>FLAGGED</span>}
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: tx.type === 'sent' ? s.textDark : s.green }}>
                  {tx.type === 'sent' ? '-' : '+'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111827', borderTop: `1px solid ${s.border}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0 env(safe-area-inset-bottom, 10px)' }}>
          {['🏠', '📊', '', '💳', '👤'].map((icon, i) => (
            i === 2 ? (
              <div key={i} onClick={() => { setMode('send'); setRecipient(''); }} style={{ width: 52, height: 52, borderRadius: 26, background: s.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginTop: -20, cursor: 'pointer', boxShadow: '0 4px 16px rgba(200,245,66,0.4)' }}>↑</div>
            ) : (
              <div key={i} style={{ fontSize: 20, padding: '8px 12px', cursor: 'pointer', opacity: i === 0 ? 1 : 0.4 }}>{icon}</div>
            )
          ))}
        </div>

        <style>{`
          @keyframes demoSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes demoPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        `}</style>
      </div>
    );
  }

  // ═══ SEND / RECEIVE SCREEN ═══
  return (
    <div style={s.page}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111827', borderBottom: `1px solid ${s.border}` }}>
        <button onClick={() => { setMode(null); setAmount(''); setRecipient(''); setResult(null); }}
          style={{ fontSize: 22, border: 'none', background: 'none', cursor: 'pointer', color: s.textDark, padding: 0 }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: s.textDark }}>{mode === 'send' ? 'Send Money' : 'Request Money'}</span>
        <div style={{ width: 24 }} />
      </div>

      <div style={{ padding: '16px 20px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...s.card, padding: '24px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: s.textMed, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>Enter Amount</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: s.textLight }}>$</span>
            <input ref={amountRef} type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
              style={{ fontSize: 42, fontWeight: 800, color: '#fff', border: 'none', outline: 'none', background: 'transparent', width: '60%', textAlign: 'center', caretColor: s.accent }} />
          </div>
          {isHighValue && (
            <div style={{ margin: '16px auto 0', padding: '8px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.red }}>⚠️ High-value — enhanced monitoring</span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
            {QUICK_AMOUNTS.map(q => (
              <button key={q} onClick={() => setAmount(String(q))} style={{
                padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: parsedAmount === q ? s.accent : s.bgSurface, color: parsedAmount === q ? '#111' : s.textMed,
              }}>${q >= 1000 ? `${q / 1000}k` : q}</button>
            ))}
          </div>
        </div>

        <div style={s.card}>
          <p style={{ fontSize: 12, color: s.textMed, margin: 0, padding: '16px 20px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>{mode === 'send' ? 'Send to' : 'Receive from'}</p>
          <button onClick={() => setRecipient('internal')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 20px', border: 'none', cursor: 'pointer', textAlign: 'left', background: recipient === 'internal' ? 'rgba(34,197,94,0.08)' : '#111827', borderBottom: `1px solid ${s.border}` }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏦</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: s.textDark, margin: 0 }}>{ACCOUNTS[otherAcct].name} Account</p>
              <p style={{ fontSize: 11, color: s.textLight, margin: '2px 0 0' }}>{ACCOUNTS[otherAcct].number}</p>
            </div>
            {recipient === 'internal' && <span style={{ fontSize: 18, color: s.green }}>✓</span>}
          </button>
          <button onClick={() => setRecipient('external')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 20px', border: 'none', cursor: 'pointer', textAlign: 'left', background: recipient === 'external' ? 'rgba(239,68,68,0.08)' : '#111827', borderRadius: '0 0 20px 20px' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌐</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: s.textDark, margin: 0 }}>External Transfer</p>
              <p style={{ fontSize: 11, color: s.textLight, margin: '2px 0 0' }}>Third-party account</p>
            </div>
            {recipient === 'external' && <span style={{ fontSize: 18, color: s.red }}>✓</span>}
          </button>
        </div>

        {result && !result.error && (
          <div style={{ ...s.card, padding: 20, border: result.alert ? '2px solid rgba(239,68,68,0.3)' : '2px solid rgba(34,197,94,0.3)' }}>
            {showSuccess && !result.alert && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: 28, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px' }}>✓</div>
                <p style={{ fontSize: 16, fontWeight: 700, color: s.green, margin: 0 }}>Transaction Complete</p>
              </div>
            )}
            {result.alert && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: s.red, boxShadow: '0 0 12px rgba(239,68,68,0.6)', animation: 'demoPulse 1.5s infinite' }} />
                  <span style={{ fontSize: 15, fontWeight: 800, color: s.red }}>ARIA Alert Triggered</span>
                </div>
                {[['Cluster ID', `#${result.alert.cluster_id}`], ['Risk Score', result.alert.score?.toFixed(1)], ['Risk Level', result.alert.risk_level?.toUpperCase()], ['Typology', result.alert.typology]].map(([l, v]) => v && (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${s.border}` }}>
                    <span style={{ fontSize: 13, color: s.textMed }}>{l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: l.includes('Score') || l === 'Risk Level' ? s.red : s.textDark }}>{v}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {result?.error && (
          <div style={{ ...s.card, padding: 20, textAlign: 'center', border: '2px solid rgba(239,68,68,0.3)' }}>
            <p style={{ fontSize: 14, color: s.red, fontWeight: 600, margin: 0 }}>{result.error}</p>
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px env(safe-area-inset-bottom, 12px)', background: 'linear-gradient(to top, #0a0e1a 60%, transparent)' }}>
        <button onClick={handleTransaction} disabled={sending || !recipient || parsedAmount <= 0}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 16, fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer',
            background: (sending || !recipient || parsedAmount <= 0) ? '#1e293b' : isHighValue ? s.red : s.accent,
            color: (sending || !recipient || parsedAmount <= 0) ? '#4b5563' : isHighValue ? '#fff' : '#111',
            boxShadow: (sending || !recipient || parsedAmount <= 0) ? 'none' : isHighValue ? '0 4px 20px rgba(239,68,68,0.3)' : '0 4px 20px rgba(200,245,66,0.4)',
          }}>
          {sending ? 'Processing...' : `${mode === 'send' ? 'Send' : 'Request'} ${parsedAmount > 0 ? formatMoney(parsedAmount) : ''}`}
        </button>
      </div>

      <style>{`
        @keyframes demoSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes demoPulse { 0%, 100% { box-shadow: 0 0 8px rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 20px rgba(239,68,68,0.8); } }
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
