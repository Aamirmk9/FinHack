import { useState, useEffect, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { fetchNetwork, fetchWallet } from '../api/client';
import { truncateAddress, formatCurrency, riskColor, riskLabel } from '../utils/formatters';

export default function NetworkGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [walletDetail, setWalletDetail] = useState(null);
  const [minScore, setMinScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const graphRef = useRef();

  useEffect(() => {
    setLoading(true);
    fetchNetwork(minScore, 500).then((data) => {
      setGraphData({
        nodes: data.nodes.map((n) => ({
          ...n,
          val: Math.max(Math.sqrt(n.tx_count) * 2, 3),
          color: riskColor(n.score),
        })),
        links: data.edges.map((e) => ({
          source: e.source,
          target: e.target,
          value: e.total_amount,
          txCount: e.tx_count,
        })),
      });
      setLoading(false);
    });
  }, [minScore]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    fetchWallet(node.id).then(setWalletDetail);
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 500);
      graphRef.current.zoom(3, 500);
    }
  }, []);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const radius = node.val;
    if (node.score >= 40) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
      ctx.fillStyle = `${node.color}33`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.strokeStyle = selectedNode?.id === node.id ? '#fff' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = selectedNode?.id === node.id ? 2 : 0.5;
    ctx.stroke();
    if (globalScale > 2) {
      ctx.font = `${10 / globalScale}px Inter, sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(truncateAddress(node.id), node.x, node.y + radius + 8 / globalScale);
    }
  }, [selectedNode]);

  return (
    <div className="flex h-full gap-4">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Network Explorer</h2>
          <div className="flex items-center gap-3">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Min Risk Score:</label>
            <input type="range" min={0} max={80} value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))} className="w-32" />
            <span className="text-xs font-mono w-8">{minScore}</span>
            <div className="flex gap-2 ml-4">
              {['Low', 'Medium', 'High', 'Critical'].map((label, i) => (
                <div key={label} className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <div className="w-2 h-2 rounded-full" style={{
                    background: ['var(--risk-low)', 'var(--risk-medium)', 'var(--risk-high)', 'var(--risk-critical)'][i]
                  }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 rounded-xl border overflow-hidden"
          style={{ background: '#060a12', borderColor: 'var(--border)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>Loading network...</div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeCanvasObject={nodeCanvasObject}
              linkColor={() => 'rgba(59, 130, 246, 0.15)'}
              linkWidth={(link) => Math.max(Math.log(link.txCount + 1), 0.5)}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={1}
              onNodeClick={handleNodeClick}
              backgroundColor="#060a12"
              cooldownTicks={100}
              nodeRelSize={4}
            />
          )}
        </div>
      </div>

      {selectedNode && (
        <div className="w-80 rounded-xl border overflow-y-auto"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Wallet Details</h3>
              <button onClick={() => { setSelectedNode(null); setWalletDetail(null); }}
                className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-secondary)' }}>Close</button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Address</p>
              <p className="text-xs font-mono break-all">{selectedNode.id}</p>
            </div>

            <div className="flex gap-4">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Risk Score</p>
                <p className="text-xl font-bold" style={{ color: riskColor(selectedNode.score) }}>{selectedNode.score}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Risk Level</p>
                <span className="text-xs px-2 py-1 rounded font-semibold"
                  style={{ background: `${riskColor(selectedNode.score)}22`, color: riskColor(selectedNode.score) }}>
                  {riskLabel(selectedNode.score)}
                </span>
              </div>
            </div>

            {selectedNode.flags?.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Flags</p>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.flags.map((flag) => (
                    <span key={flag} className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)' }}>
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Sent</p>
                <p className="text-sm font-semibold">{formatCurrency(selectedNode.total_sent)}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Received</p>
                <p className="text-sm font-semibold">{formatCurrency(selectedNode.total_received)}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Transactions</p>
                <p className="text-sm font-semibold">{selectedNode.tx_count}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Community</p>
                <p className="text-sm font-semibold">#{selectedNode.community}</p>
              </div>
            </div>

            {walletDetail && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Score Breakdown</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Rule-based</span>
                    <span className="font-mono">{walletDetail.rule_score}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${walletDetail.rule_score}%`, background: 'var(--accent-blue)' }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>ML Probability</span>
                    <span className="font-mono">{(walletDetail.ml_probability * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${walletDetail.ml_probability * 100}%`, background: 'var(--accent-cyan)' }} />
                  </div>
                </div>
              </div>
            )}

            {walletDetail?.transactions?.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Recent Transactions ({walletDetail.transactions.length})
                </p>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {walletDetail.transactions.slice(0, 20).map((tx, i) => (
                    <div key={i} className="text-xs p-2 rounded" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="flex justify-between">
                        <span style={{ color: tx.from_address === selectedNode.id ? 'var(--risk-critical)' : 'var(--risk-low)' }}>
                          {tx.from_address === selectedNode.id ? 'SENT' : 'RECV'}
                        </span>
                        <span className="font-mono">{formatCurrency(tx.amount)}</span>
                      </div>
                      <div className="font-mono mt-0.5" style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                        {tx.from_address === selectedNode.id
                          ? `→ ${truncateAddress(tx.to_address)}`
                          : `← ${truncateAddress(tx.from_address)}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
