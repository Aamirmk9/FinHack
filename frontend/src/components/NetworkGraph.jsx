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

const CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Atlanta', 'Seattle',
  'Miami', 'San Francisco', 'Boston', 'Washington DC', 'Philadelphia', 'Dallas',
  'London', 'Paris', 'Tokyo', 'Hong Kong', 'Singapore', 'Moscow',
  'São Paulo', 'Mexico City', 'Dubai', 'Berlin', 'Sydney', 'Seoul',
];

function assignCity(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return CITIES[Math.abs(hash) % CITIES.length];
}

const EMPTY_GRAPH = { nodes: [], links: [] };

const ZOOM_CLOSE = 120;
const ZOOM_FAR = 550;

function getRiskLevel(score) {
  if (score >= 51) return 'critical';
  if (score >= 37) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
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
      setGraphData({
        nodes: data.nodes.map((n) => {
          const level = getRiskLevel(n.score);
          return { ...n, val: 3, riskLevel: level, nodeColor: NODE_COLORS[level] };
        }),
        links: data.edges.map((e) => ({
          source: e.source,
          target: e.target,
          value: e.total_amount,
          txCount: e.tx_count,
        })),
      });
      setLoading(false);
    }).catch(() => setLoading(false));
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

        fg.cameraPosition({ z: ZOOM_FAR });

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
    const targetZ = ZOOM_FAR - (ZOOM_FAR - ZOOM_CLOSE) * t;
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
              {riskLevel === 0 ? 'All' : riskLevel < 33 ? 'High' : riskLevel < 66 ? 'Med' : 'Low'}
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
        <div className="glass-card overflow-y-auto animate-slide-in-right" style={{
          width: 300, flexShrink: 0,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.03) inset',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0' }}>Wallet Details</span>
            <button onClick={() => { setSelectedNode(null); setWalletDetail(null); }}
              style={{ fontSize: 10, color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}>Close</button>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Address */}
            <div>
              <p style={{ fontSize: 9, color: '#666', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Address</p>
              <p style={{ fontSize: 10, fontFamily: 'monospace', color: selectedNode.nodeColor, margin: 0, wordBreak: 'break-all' }}>{selectedNode.id}</p>
            </div>

            {/* Score + Level */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <p style={{ fontSize: 9, color: '#666', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Risk Score</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: selectedNode.nodeColor, margin: 0 }}>
                  <AnimatedNumber value={selectedNode.score} />
                </p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: '#666', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Level</p>
                <span style={{
                  fontSize: 9, padding: '3px 8px', borderRadius: 4, fontWeight: 700,
                  background: `${selectedNode.nodeColor}15`, color: selectedNode.nodeColor,
                  display: 'inline-block', marginTop: 4, textTransform: 'uppercase',
                }}>{selectedNode.riskLevel}</span>
              </div>
            </div>

            {/* Location */}
            <div>
              <p style={{ fontSize: 9, color: '#666', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Location</p>
              <p style={{ fontSize: 11, color: '#bbb', margin: 0 }}>{assignCity(selectedNode.id)}</p>
            </div>

            {/* Flags */}
            {selectedNode.flags?.length > 0 && (
              <div>
                <p style={{ fontSize: 9, color: '#666', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Flags</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedNode.flags.map((flag) => (
                    <span key={flag} style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 4,
                      background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.12)',
                    }}>{flag.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Sent', value: formatCurrency(selectedNode.total_sent) },
                { label: 'Received', value: formatCurrency(selectedNode.total_received) },
                { label: 'Transactions', value: selectedNode.tx_count },
                { label: 'Community', value: '#' + selectedNode.community },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ fontSize: 9, color: '#666', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#e0e0e0', margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Score breakdown */}
            {walletDetail && (
              <div>
                <p style={{ fontSize: 9, color: '#666', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Score Breakdown</p>
                {[
                  { label: 'Rule-based', value: walletDetail.rule_score, color: '#ef4444' },
                  { label: 'ML Probability', value: (walletDetail.ml_probability * 100).toFixed(1), color: '#f97316' },
                ].map(b => (
                  <div key={b.label} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                      <span style={{ color: '#999' }}>{b.label}</span>
                      <span style={{ fontFamily: 'monospace', color: '#bbb' }}>{b.value}%</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${b.value}%`, background: b.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transactions */}
            {walletDetail?.transactions?.length > 0 && (
              <div>
                <p style={{ fontSize: 9, color: '#666', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Transactions ({walletDetail.transactions.length})
                </p>
                <div style={{
                  display: 'grid', gridTemplateColumns: '32px 1fr 1fr 60px',
                  padding: '4px 8px', fontSize: 8, fontWeight: 600, color: '#555',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  background: 'rgba(255,255,255,0.02)', borderRadius: '4px 4px 0 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span>Dir</span><span>From</span><span>To</span><span style={{ textAlign: 'right' }}>Amt</span>
                </div>
                <div style={{ maxHeight: 240, overflow: 'auto' }}>
                  {walletDetail.transactions.slice(0, 20).map((tx, i) => {
                    const isSent = tx.from_address === selectedNode.id;
                    return (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '32px 1fr 1fr 60px',
                        padding: '5px 8px', alignItems: 'center',
                        borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 9,
                      }}>
                        <span style={{ color: isSent ? '#ef4444' : '#4ade80', fontWeight: 700, fontSize: 8 }}>
                          {isSent ? 'SENT' : 'RECV'}
                        </span>
                        <span style={{ fontFamily: 'monospace', color: isSent ? '#ef4444' : '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {truncateAddress(tx.from_address)}
                        </span>
                        <span style={{ fontFamily: 'monospace', color: !isSent ? '#4ade80' : '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {truncateAddress(tx.to_address)}
                        </span>
                        <span style={{ fontFamily: 'monospace', color: '#bbb', textAlign: 'right' }}>
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
