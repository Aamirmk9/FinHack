import { useState, useEffect } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Pre-configured demo wallets — these connect to existing suspicious clusters
const DEMO_WALLETS = [
  { label: 'My Wallet', address: '0xDEMO_USER_WALLET_001_LIVE_TRANSACTION' },
  { label: 'Trading Account', address: '0xDEMO_USER_WALLET_002_LIVE_TRANSACTION' },
];

// Targets — mix of clean and suspicious
const TARGET_WALLETS = [
  { label: 'Exchange Deposit', address: '0xDEMO_EXCHANGE_001', risk: 'clean' },
  { label: 'OTC Desk', address: '0xDEMO_OTC_BROKER_001', risk: 'clean' },
  { label: 'Unknown Wallet', address: '0xDEMO_UNKNOWN_WALLET_001', risk: 'suspicious' },
  { label: 'Mixer Service', address: '0xDEMO_MIXER_SERVICE_001', risk: 'suspicious' },
];

// Pre-set suspicious amounts for quick demo
const QUICK_AMOUNTS = [
  { label: '$9,500', value: 9500, note: 'Below reporting threshold' },
  { label: '$9,800', value: 9800, note: 'Structuring pattern' },
  { label: '$49,999', value: 49999, note: 'Large transfer' },
  { label: '$150,000', value: 150000, note: 'High value' },
];

export default function SendPage() {
  const [fromWallet, setFromWallet] = useState(DEMO_WALLETS[0].address);
  const [toWallet, setToWallet] = useState(TARGET_WALLETS[2].address);
  const [amount, setAmount] = useState(9500);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const resp = await api.post('/inject', {
        from_address: fromWallet,
        to_address: toWallet,
        amount: parseFloat(amount),
      });
      setResult(resp.data);
      setHistory(prev => [{
        from: fromWallet,
        to: toWallet,
        amount: parseFloat(amount),
        time: new Date().toLocaleTimeString(),
        alert: resp.data.alert,
      }, ...prev]);
    } catch (e) {
      setResult({ error: 'Failed to send' });
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--glass-border)', background: 'rgba(10, 18, 32, 0.8)' }}>
        <div className="flex items-center gap-2 justify-center">
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-cyan)', boxShadow: '0 0 6px var(--accent-cyan)' }} />
          <span className="text-sm font-bold tracking-wider" style={{ color: 'var(--accent-cyan)' }}>SHADOWPAY</span>
        </div>
        <p className="text-xs text-center mt-1" style={{ color: 'var(--text-secondary)' }}>Demo Crypto Wallet</p>
      </div>

      <div className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {/* From Wallet */}
        <div className="glass-card-static p-4">
          <label className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>From</label>
          <select value={fromWallet} onChange={(e) => setFromWallet(e.target.value)}
            className="w-full mt-2 p-3 rounded-lg text-sm"
            style={{ background: 'rgba(10, 18, 32, 0.6)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
            {DEMO_WALLETS.map((w) => (
              <option key={w.address} value={w.address}>{w.label}</option>
            ))}
          </select>
          <p className="text-xs font-mono mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>
            {fromWallet.slice(0, 20)}...
          </p>
        </div>

        {/* Arrow */}
        <div className="text-center text-lg" style={{ color: 'var(--accent-cyan)' }}>&#8595;</div>

        {/* To Wallet */}
        <div className="glass-card-static p-4">
          <label className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>To</label>
          <select value={toWallet} onChange={(e) => setToWallet(e.target.value)}
            className="w-full mt-2 p-3 rounded-lg text-sm"
            style={{ background: 'rgba(10, 18, 32, 0.6)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>
            {TARGET_WALLETS.map((w) => (
              <option key={w.address} value={w.address}>
                {w.label} {w.risk === 'suspicious' ? '⚠' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div className="glass-card-static p-4">
          <label className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Amount (USD)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full mt-2 p-3 rounded-lg text-2xl font-bold text-center"
            style={{ background: 'rgba(10, 18, 32, 0.6)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
          />
          {/* Quick amounts */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            {QUICK_AMOUNTS.map((q) => (
              <button key={q.value} onClick={() => setAmount(q.value)}
                className="text-xs py-2 rounded-lg transition-all duration-200"
                style={{
                  background: amount == q.value ? 'rgba(6, 182, 212, 0.12)' : 'rgba(10, 18, 32, 0.4)',
                  border: `1px solid ${amount == q.value ? 'var(--accent-cyan)' : 'var(--glass-border)'}`,
                  color: amount == q.value ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                }}>
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full py-4 rounded-xl text-base font-bold transition-all duration-200"
          style={{
            background: sending ? 'var(--glass-border)' : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            color: sending ? 'var(--text-secondary)' : '#000',
            boxShadow: sending ? 'none' : '0 0 20px rgba(6, 182, 212, 0.25)',
          }}
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-secondary)', borderTopColor: 'transparent' }} />
              Processing...
            </span>
          ) : (
            'Send Transaction'
          )}
        </button>

        {/* Result */}
        {result && !result.error && (
          <div className="glass-card-static p-4 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full"
                style={{ background: result.alert ? 'var(--risk-critical)' : 'var(--risk-low)', boxShadow: `0 0 6px ${result.alert ? 'var(--risk-critical)' : 'var(--risk-low)'}` }} />
              <span className="text-sm font-semibold">
                {result.alert ? 'Flagged as Suspicious' : 'Transaction Sent'}
              </span>
            </div>
            <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-secondary)' }}>
              {result.tx_hash?.slice(0, 24)}...
            </p>
            <div className="flex gap-4 text-xs mt-2">
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Sender Risk: </span>
                <span className="font-bold" style={{ color: result.sender_score >= 40 ? 'var(--risk-critical)' : 'var(--text-primary)' }}>
                  {result.sender_score}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Receiver Risk: </span>
                <span className="font-bold" style={{ color: result.receiver_score >= 40 ? 'var(--risk-critical)' : 'var(--text-primary)' }}>
                  {result.receiver_score}
                </span>
              </div>
            </div>
            {result.alert && (
              <div className="mt-2 p-2 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--risk-critical)' }}>
                  Alert: Cluster #{result.alert.cluster_id} — {result.alert.typology || result.alert.risk_level}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Transaction History */}
        {history.length > 0 && (
          <div className="glass-card-static p-4">
            <h3 className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Recent</h3>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg"
                  style={{ background: 'rgba(10, 18, 32, 0.4)', border: h.alert ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid transparent' }}>
                  <div>
                    <span className="font-mono">${h.amount.toLocaleString()}</span>
                    <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>{h.time}</span>
                  </div>
                  {h.alert && (
                    <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--risk-critical)' }}>
                      FLAGGED
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
