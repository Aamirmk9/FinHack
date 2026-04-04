import { useState, useEffect, useCallback, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { forceRadial } from 'd3-force-3d';
import { fetchNetwork, fetchWallet } from '../api/client';
import { truncateAddress, formatCurrency, riskColor, riskLabel } from '../utils/formatters';
import AnimatedNumber from './AnimatedNumber';
import useWebSocket from '../hooks/useWebSocket';

const NODE_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const SHELL_RADII = {
  low: 60,
  medium: 120,
  high: 180,
  critical: 240,
};

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

const EMPTY_GRAPH = { nodes: [], links: [] };

const ZOOM_CLOSE = 120;
const ZOOM_FAR = 550;

function assignRiskLevels(nodes) {
  const indexed = nodes.map((n, i) => ({ i, score: n.score }));
  indexed.sort((a, b) => a.score - b.score);
  const n = indexed.length;
  const assignments = new Array(n);
  for (let rank = 0; rank < n; rank++) {
    const quartile = Math.min(Math.floor((rank / n) * 4), 3);
    assignments[indexed[rank].i] = RISK_LEVELS[quartile];
  }
  return assignments;
}

export default function NetworkGraph() {
  const [graphData, setGraphData] = useState(EMPTY_GRAPH);
  const [selectedNode, setSelectedNode] = useState(null);
  const [walletDetail, setWalletDetail] = useState(null);
  const [riskLevel, setRiskLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forcesReady, setForcesReady] = useState(false);
  const graphRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const { lastUpdate } = useWebSocket();
  const [refreshKey, setRefreshKey] = useState(0);
  const [newNodeIds, setNewNodeIds] = useState(new Set());
  const newNodeTimers = useRef({});

  // Auto-refresh when a live transaction is injected
  useEffect(() => {
    if (lastUpdate && lastUpdate.type === 'transaction_injected') {
      const injectedIds = [lastUpdate.sender?.address, lastUpdate.receiver?.address].filter(Boolean);
      setNewNodeIds(prev => new Set([...prev, ...injectedIds]));
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

  // Measure container — use hard calc height as fallback
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        if (w > 0 && h > 0) {
          setDimensions({ width: w, height: h });
        }
      }
    };
    updateSize();
    requestAnimationFrame(updateSize);
    // Also retry after a short delay for client-side navigation
    const t = setTimeout(updateSize, 200);
    window.addEventListener('resize', updateSize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    fetchNetwork(0, 400).then((data) => {
      const levels = assignRiskLevels(data.nodes);
      setGraphData({
        nodes: data.nodes.map((n, i) => ({
          ...n,
          val: 3,
          riskLevel: levels[i],
          nodeColor: NODE_COLORS[levels[i]],
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
  }, [refreshKey]);

  // Setup forces ONCE when graph ref becomes available and data is loaded.
  // Uses a polling approach since ForceGraph3D needs a frame to initialize internally.
  useEffect(() => {
    if (loading || forcesReady) return;

    const setup = () => {
      const fg = graphRef.current;
      if (!fg) return false;

      try {
        const controls = fg.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.5;
        }

        fg.cameraPosition({ z: ZOOM_CLOSE });

        const radial = forceRadial((node) => SHELL_RADII[node.riskLevel] || 120)
          .strength(0.3);
        fg.d3Force('radial', radial);

        const charge = fg.d3Force('charge');
        if (charge) {
          charge.strength(-30);
          charge.distanceMax(100);
        }

        const link = fg.d3Force('link');
        if (link) {
          link.distance(30);
          link.strength(0.2);
        }

        fg.d3Force('center', null);
        fg.d3ReheatSimulation();

        setForcesReady(true);
        return true;
      } catch {
        return false;
      }
    };

    // Try immediately, then retry every 100ms until ForceGraph3D is ready
    if (!setup()) {
      const id = setInterval(() => {
        if (setup()) clearInterval(id);
      }, 100);
      // Safety timeout
      const t = setTimeout(() => clearInterval(id), 5000);
      return () => { clearInterval(id); clearTimeout(t); };
    }
  }, [loading, forcesReady]);

  // Zoom camera based on risk slider
  useEffect(() => {
    if (!forcesReady || !graphRef.current) return;
    const t = riskLevel / 100;
    const targetZ = ZOOM_CLOSE + (ZOOM_FAR - ZOOM_CLOSE) * t;
    graphRef.current.cameraPosition({ z: targetZ }, null, 800);
  }, [riskLevel, forcesReady]);

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
    const color = new THREE.Color(isNew ? '#ff2020' : node.nodeColor);
    const radius = isNew ? 6 : 3;

    const geometry = new THREE.SphereGeometry(radius, 20, 20);
    const material = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      emissive: color,
      emissiveIntensity: isNew ? 0.8 : 0.3,
    });

    if (!isNew) {
      return new THREE.Mesh(geometry, material);
    }

    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, material));
    const glowGeometry = new THREE.SphereGeometry(radius * 2.5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff0000'),
      transparent: true,
      opacity: 0.12,
    });
    group.add(new THREE.Mesh(glowGeometry, glowMaterial));
    return group;
  }, [newNodeIds]);

  return (
    <div className="flex h-full gap-4 animate-fade-in">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Network Explorer</h2>
          <div className="flex items-center gap-3">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Risk Depth:</label>
            <input type="range" min={0} max={100} value={riskLevel}
              onChange={(e) => setRiskLevel(Number(e.target.value))} className="w-32" />
            <span className="text-xs font-mono w-12" style={{ color: 'var(--accent-cyan)' }}>
              {riskLevel === 0 ? 'Low' : riskLevel < 33 ? 'Med' : riskLevel < 66 ? 'High' : 'All'}
            </span>
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

        <div ref={containerRef} className="flex-1 glass-card-static overflow-hidden relative"
          style={{ background: '#030712', height: 'calc(100vh - 140px)' }}>
          {/* ForceGraph3D is ALWAYS mounted — never unmount/remount WebGL */}
          <ForceGraph3D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeThreeObject={nodeThreeObject}
            nodeThreeObjectExtend={false}
            linkColor={() => 'rgba(59, 130, 246, 0.6)'}
            linkWidth={(link) => Math.max(Math.log(link.txCount + 1) * 0.8, 0.5)}
            linkOpacity={0.6}
            linkDirectionalParticles={(link) => Math.min(link.txCount, 4)}
            linkDirectionalParticleWidth={1.5}
            linkDirectionalParticleSpeed={(link) => Math.min(link.txCount * 0.002, 0.02)}
            linkDirectionalParticleColor={() => '#06b6d4'}
            onNodeClick={handleNodeClick}
            backgroundColor="#030712"
            showNavInfo={false}
            enableNodeDrag={true}
          />
          {/* Loading overlay on top of the graph */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#030712', zIndex: 10 }}>
              <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                  style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
                Loading network...
              </div>
            </div>
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
