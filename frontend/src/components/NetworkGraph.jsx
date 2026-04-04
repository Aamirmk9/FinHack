import { useState, useEffect, useCallback, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { fetchNetwork, fetchWallet } from '../api/client';
import { truncateAddress, formatCurrency, riskColor, riskLabel } from '../utils/formatters';
import AnimatedNumber from './AnimatedNumber';
import useWebSocket from '../hooks/useWebSocket';

const NODE_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#eab308',
  low: '#22c55e',
};

function getRiskLevel(score) {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

export default function NetworkGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [walletDetail, setWalletDetail] = useState(null);
  const [minScore, setMinScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const graphRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const { lastUpdate } = useWebSocket();
  const [refreshKey, setRefreshKey] = useState(0);
  const [newNodeIds, setNewNodeIds] = useState(new Set());
  const newNodeTimers = useRef({});

  // Auto-refresh when a live transaction is injected + track new nodes
  useEffect(() => {
    if (lastUpdate && lastUpdate.type === 'transaction_injected') {
      const injectedIds = [lastUpdate.sender?.address, lastUpdate.receiver?.address].filter(Boolean);
      setNewNodeIds(prev => new Set([...prev, ...injectedIds]));
      // Clear glow after 30s
      injectedIds.forEach(id => {
        if (newNodeTimers.current[id]) clearTimeout(newNodeTimers.current[id]);
        newNodeTimers.current[id] = setTimeout(() => {
          setNewNodeIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 30000);
      });
      setRefreshKey(k => k + 1);
    }
  }, [lastUpdate]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchNetwork(minScore, 400).then((data) => {
      setGraphData({
        nodes: data.nodes.map((n) => ({
          ...n,
          val: Math.max(Math.sqrt(n.tx_count) * 1.5, 2),
          riskLevel: getRiskLevel(n.score),
          nodeColor: NODE_COLORS[getRiskLevel(n.score)],
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
  }, [minScore, refreshKey]);

  // Auto-rotate + zoom to fit all nodes
  useEffect(() => {
    if (!loading && graphRef.current) {
      const controls = graphRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
      }
      // Zoom out enough to see the full graph
      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.zoomToFit(800, 80);
        }
      }, 500);
    }
  }, [loading]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    fetchWallet(node.id).then(setWalletDetail);
    if (graphRef.current) {
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
      graphRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        1000
      );
      const controls = graphRef.current.controls();
      if (controls) controls.autoRotate = false;
    }
  }, []);

  const nodeThreeObject = useCallback((node) => {
    const isNew = newNodeIds.has(node.id);
    const color = isNew ? '#ff2020' : node.nodeColor;
    const radius = isNew ? Math.max(node.val * 2.5, 6) : node.val;
    const group = new THREE.Group();

    const geometry = new THREE.SphereGeometry(radius, 20, 20);
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: isNew ? 1.0 : 0.85,
      emissive: new THREE.Color(color),
      emissiveIntensity: isNew ? 0.8 : (node.score >= 40 ? 0.4 : 0.15),
    });
    group.add(new THREE.Mesh(geometry, material));

    // Ring for high-risk or new nodes
    if (node.score >= 40 || isNew) {
      const ringGeometry = new THREE.RingGeometry(radius + 1.5, radius + 2.5, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: isNew ? 0.6 : 0.25,
        side: THREE.DoubleSide,
      });
      group.add(new THREE.Mesh(ringGeometry, ringMaterial));
    }

    // Outer glow for critical or new nodes
    if (node.score >= 70 || isNew) {
      const glowGeometry = new THREE.SphereGeometry(radius * 2.5, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(isNew ? '#ff0000' : color),
        transparent: true,
        opacity: isNew ? 0.15 : 0.08,
      });
      group.add(new THREE.Mesh(glowGeometry, glowMaterial));
    }

    // Extra pulsing outer shell for brand-new injected nodes
    if (isNew) {
      const pulseGeometry = new THREE.SphereGeometry(radius * 4, 16, 16);
      const pulseMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ff0000'),
        transparent: true,
        opacity: 0.05,
      });
      group.add(new THREE.Mesh(pulseGeometry, pulseMaterial));
    }

    return group;
  }, [newNodeIds]);

  return (
    <div className="flex h-full gap-4 animate-fade-in">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Network Explorer</h2>
          <div className="flex items-center gap-3">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Min Risk:</label>
            <input type="range" min={0} max={80} value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))} className="w-32" />
            <span className="text-xs font-mono w-8" style={{ color: 'var(--accent-cyan)' }}>{minScore}</span>
            <div className="flex gap-2 ml-4">
              {Object.entries(NODE_COLORS).map(([level, color]) => (
                <div key={level} className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                  <span className="capitalize">{level}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 glass-card-static overflow-hidden" style={{ background: '#030712' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                  style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
                Loading network...
              </div>
            </div>
          ) : (
            <ForceGraph3D
              ref={graphRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              nodeThreeObject={nodeThreeObject}
              nodeThreeObjectExtend={false}
              linkColor={() => 'rgba(59, 130, 246, 0.12)'}
              linkWidth={(link) => Math.max(Math.log(link.txCount + 1) * 0.3, 0.2)}
              linkOpacity={0.3}
              linkDirectionalParticles={(link) => Math.min(link.txCount, 4)}
              linkDirectionalParticleWidth={1.5}
              linkDirectionalParticleSpeed={(link) => Math.min(link.txCount * 0.002, 0.02)}
              linkDirectionalParticleColor={() => '#06b6d4'}
              onNodeClick={handleNodeClick}
              backgroundColor="#030712"
              showNavInfo={false}
              enableNodeDrag={true}
            />
          )}
        </div>
      </div>

      {selectedNode && (
        <div className="w-80 glass-card overflow-y-auto animate-slide-in-right glow-cyan">
          <div className="p-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Wallet Details</h3>
              <button onClick={() => { setSelectedNode(null); setWalletDetail(null); }}
                className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-secondary)' }}>Close</button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Address</p>
              <p className="text-xs font-mono break-all" style={{ color: 'var(--accent-cyan)' }}>{selectedNode.id}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Risk Score</p>
                <p className="text-2xl font-bold" style={{ color: riskColor(selectedNode.score) }}>
                  <AnimatedNumber value={selectedNode.score} />
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Risk Level</p>
                <span className="text-xs px-2 py-1 rounded font-semibold inline-block mt-1"
                  style={{ background: `${riskColor(selectedNode.score)}18`, color: riskColor(selectedNode.score) }}>
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
                      style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--risk-critical)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Sent', value: formatCurrency(selectedNode.total_sent) },
                { label: 'Total Received', value: formatCurrency(selectedNode.total_received) },
                { label: 'Transactions', value: selectedNode.tx_count },
                { label: 'Community', value: '#' + selectedNode.community },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                  <p className="text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>
            {walletDetail && (
              <div className="animate-fade-in">
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Score Breakdown</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Rule-based</span>
                    <span className="font-mono">{walletDetail.rule_score}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(100, 140, 200, 0.1)' }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: walletDetail.rule_score + '%', background: 'var(--accent-blue)', boxShadow: '0 0 6px var(--accent-blue)' }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>ML Probability</span>
                    <span className="font-mono">{(walletDetail.ml_probability * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(100, 140, 200, 0.1)' }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: (walletDetail.ml_probability * 100) + '%', background: 'var(--accent-cyan)', boxShadow: '0 0 6px var(--accent-cyan)' }} />
                  </div>
                </div>
              </div>
            )}
            {walletDetail?.transactions?.length > 0 && (
              <div className="animate-fade-in">
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Recent Transactions ({walletDetail.transactions.length})
                </p>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {walletDetail.transactions.slice(0, 20).map((tx, i) => (
                    <div key={i} className="text-xs p-2 rounded"
                      style={{ background: 'rgba(10, 18, 32, 0.5)', border: '1px solid var(--glass-border)' }}>
                      <div className="flex justify-between">
                        <span style={{ color: tx.from_address === selectedNode.id ? 'var(--risk-critical)' : 'var(--risk-low)' }}>
                          {tx.from_address === selectedNode.id ? 'SENT' : 'RECV'}
                        </span>
                        <span className="font-mono">{formatCurrency(tx.amount)}</span>
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
