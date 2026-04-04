import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { fetchNetwork, fetchWallet } from '../api/client';
import { truncateAddress, formatCurrency, riskColor, riskLabel } from '../utils/formatters';
import AnimatedNumber from './AnimatedNumber';
import useWebSocket from '../hooks/useWebSocket';

const LOCATIONS = [
  { lat: 40.71, lng: -74.01 }, { lat: 34.05, lng: -118.24 }, { lat: 41.88, lng: -87.63 },
  { lat: 29.76, lng: -95.37 }, { lat: 33.75, lng: -84.39 }, { lat: 47.61, lng: -122.33 },
  { lat: 25.76, lng: -80.19 }, { lat: 37.77, lng: -122.42 }, { lat: 42.36, lng: -71.06 },
  { lat: 38.91, lng: -77.04 }, { lat: 39.95, lng: -75.17 }, { lat: 32.78, lng: -96.80 },
  { lat: 51.51, lng: -0.13 }, { lat: 48.86, lng: 2.35 }, { lat: 35.68, lng: 139.69 },
  { lat: 22.32, lng: 114.17 }, { lat: 1.35, lng: 103.82 }, { lat: 55.76, lng: 37.62 },
  { lat: -23.55, lng: -46.63 }, { lat: 19.43, lng: -99.13 }, { lat: 25.20, lng: 55.27 },
  { lat: 52.52, lng: 13.41 }, { lat: -33.87, lng: 151.21 }, { lat: 37.57, lng: 126.98 },
];

function assignLocation(id, index) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  const base = LOCATIONS[Math.abs(hash) % LOCATIONS.length];
  const jit = () => (Math.abs((hash * (index + 1) * 13) % 1000) / 1000 - 0.5) * 5;
  return { lat: base.lat + jit(), lng: base.lng + jit() };
}

const RISK_COLORS_MAP = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };

function getRiskLevel(score) {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

// Only show top N most interesting wallets
const MAX_NODES = 60;
const MAX_ARCS = 80;

export default function GlobeNetwork() {
  const [nodes, setNodes] = useState([]);
  const [arcs, setArcs] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [walletDetail, setWalletDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const globeRef = useRef();
  const containerRef = useRef();
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const { lastUpdate } = useWebSocket();
  const [refreshKey, setRefreshKey] = useState(0);
  const [newNodeIds, setNewNodeIds] = useState(new Set());

  useEffect(() => {
    if (lastUpdate && lastUpdate.type === 'transaction_injected') {
      const ids = [lastUpdate.sender?.address, lastUpdate.receiver?.address].filter(Boolean);
      setNewNodeIds(prev => new Set([...prev, ...ids]));
      setTimeout(() => {
        setNewNodeIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
      }, 30000);
      setRefreshKey(k => k + 1);
    }
  }, [lastUpdate]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        if (w > 0 && h > 0) setDims({ width: w, height: h });
      }
    };
    update();
    const t = setTimeout(update, 200);
    window.addEventListener('resize', update);
    return () => { clearTimeout(t); window.removeEventListener('resize', update); };
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchNetwork(0, 400).then((data) => {
      // Sort by score descending, take top N
      const sorted = [...data.nodes].sort((a, b) => b.score - a.score).slice(0, MAX_NODES);
      const idSet = new Set(sorted.map(n => n.id));

      const geoNodes = sorted.map((n, i) => {
        const loc = assignLocation(n.id, i);
        const level = getRiskLevel(n.score);
        return { ...n, lat: loc.lat, lng: loc.lng, riskLevel: level, color: RISK_COLORS_MAP[level] };
      });

      const nodeMap = {};
      geoNodes.forEach(n => { nodeMap[n.id] = n; });

      const geoArcs = data.edges
        .filter(e => nodeMap[e.source] && nodeMap[e.target])
        .slice(0, MAX_ARCS)
        .map(e => {
          const src = nodeMap[e.source];
          const tgt = nodeMap[e.target];
          const maxScore = Math.max(src.score || 0, tgt.score || 0);
          return {
            startLat: src.lat, startLng: src.lng,
            endLat: tgt.lat, endLng: tgt.lng,
            color: maxScore >= 70 ? ['rgba(239,68,68,0.6)', 'rgba(239,68,68,0.1)']
                 : maxScore >= 40 ? ['rgba(249,115,22,0.4)', 'rgba(249,115,22,0.1)']
                 : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)'],
            stroke: maxScore >= 40 ? 0.8 : 0.4,
            altitude: 0.06 + Math.random() * 0.12,
          };
        });

      setNodes(geoNodes);
      setArcs(geoArcs);
      setLoading(false);
    });
  }, [refreshKey]);

  useEffect(() => {
    if (!loading && globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.3;
      globeRef.current.pointOfView({ lat: 35, lng: -95, altitude: 2.2 }, 1000);
    }
  }, [loading]);

  const openWallet = useCallback((node) => {
    setSelectedNode(node);
    setWalletDetail(null);
    fetchWallet(node.id).then(setWalletDetail).catch(() => {});
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: node.lat, lng: node.lng, altitude: 0.8 }, 1000);
      globeRef.current.controls().autoRotate = false;
    }
  }, []);

  const ringsData = useMemo(() =>
    nodes.filter(n => newNodeIds.has(n.id)).map(n => ({
      lat: n.lat, lng: n.lng, maxR: 5, propagationSpeed: 2, repeatPeriod: 1200,
      color: () => 'rgba(239,68,68,0.6)',
    })),
    [nodes, newNodeIds]
  );

  // Use customThreeObject for proper clickable 3D spheres
  const customObj = useCallback((d) => {
    const isNew = newNodeIds.has(d.id);
    const r = isNew ? 1.8 : d.score >= 70 ? 1.2 : d.score >= 40 ? 0.9 : 0.6;
    const color = new THREE.Color(isNew ? '#ff2020' : d.color);

    const geo = new THREE.SphereGeometry(r, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Add glow sphere
    const glowGeo = new THREE.SphereGeometry(r * 2, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.15,
    });
    const group = new THREE.Group();
    group.add(mesh);
    group.add(new THREE.Mesh(glowGeo, glowMat));

    return group;
  }, [newNodeIds]);

  // Re-measure when sidebar opens/closes
  useEffect(() => {
    const t = setTimeout(() => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        if (w > 0 && h > 0) setDims({ width: w, height: h });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [selectedNode]);

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#e0e0e0' }}>Global Network</h2>
            <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>
              {nodes.length} wallets · Click any sphere to inspect
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {Object.entries(RISK_COLORS_MAP).map(([level, color]) => (
              <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#666' }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: color, boxShadow: `0 0 4px ${color}` }} />
                <span style={{ textTransform: 'capitalize' }}>{level}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Globe */}
        <div ref={containerRef} className="glass-card-static" style={{
          flex: 1, overflow: 'hidden', position: 'relative', background: '#080808',
          height: 'calc(100vh - 140px)',
        }}>
          {!loading && (
            <Globe
              ref={globeRef}
              width={dims.width}
              height={dims.height}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
              backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
              atmosphereColor="#444"
              atmosphereAltitude={0.15}
              // 3D sphere nodes — fully clickable via Three.js raycasting
              customLayerData={nodes}
              customThreeObject={customObj}
              customThreeObjectUpdate={(obj, d) => {
                Object.assign(obj.position, globeRef.current?.getCoords(d.lat, d.lng, d.score >= 70 ? 0.04 : d.score >= 40 ? 0.02 : 0.01));
              }}
              onCustomLayerClick={(d) => openWallet(d)}
              onCustomLayerHover={(d) => {
                if (containerRef.current) containerRef.current.style.cursor = d ? 'pointer' : 'grab';
              }}
              // Arcs
              arcsData={arcs}
              arcStartLat="startLat"
              arcStartLng="startLng"
              arcEndLat="endLat"
              arcEndLng="endLng"
              arcColor="color"
              arcStroke="stroke"
              arcAltitude="altitude"
              arcDashLength={0.5}
              arcDashGap={0.3}
              arcDashAnimateTime={() => 2000 + Math.random() * 2000}
              // Rings
              ringsData={ringsData}
              ringLat="lat"
              ringLng="lng"
              ringMaxRadius="maxR"
              ringPropagationSpeed="propagationSpeed"
              ringRepeatPeriod="repeatPeriod"
              ringColor="color"
              enablePointerInteraction={true}
            />
          )}
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: '#080808', zIndex: 10,
            }}>
              <div style={{ textAlign: 'center', color: '#666' }}>
                <div style={{
                  width: 32, height: 32, border: '2px solid #333', borderTopColor: 'transparent',
                  borderRadius: 16, animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
                }} />
                <p style={{ fontSize: 12 }}>Loading globe...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ SIDEBAR ═══ */}
      {selectedNode && (
        <div className="glass-card animate-slide-in-right" style={{
          width: 300, marginLeft: 16, overflow: 'auto',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.03) inset',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Wallet Details</p>
              <button onClick={() => {
                setSelectedNode(null); setWalletDetail(null);
                if (globeRef.current) { globeRef.current.controls().autoRotate = true; globeRef.current.pointOfView({ altitude: 2.2 }, 1000); }
              }} style={{ fontSize: 10, color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Address */}
            <div>
              <p style={{ fontSize: 9, color: '#666', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Address</p>
              <p style={{ fontSize: 10, fontFamily: 'monospace', color: selectedNode.color, margin: 0, wordBreak: 'break-all' }}>{selectedNode.id}</p>
            </div>

            {/* Score */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <p style={{ fontSize: 9, color: '#666', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Risk Score</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: riskColor(selectedNode.score), margin: 0 }}>
                  <AnimatedNumber value={selectedNode.score} />
                </p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: '#666', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Level</p>
                <span style={{
                  fontSize: 9, padding: '3px 8px', borderRadius: 4, fontWeight: 700,
                  background: `${riskColor(selectedNode.score)}15`, color: riskColor(selectedNode.score),
                  display: 'inline-block', marginTop: 4, textTransform: 'uppercase',
                }}>{riskLabel(selectedNode.score)}</span>
              </div>
            </div>

            {/* Location */}
            <div>
              <p style={{ fontSize: 9, color: '#666', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Location</p>
              <p style={{ fontSize: 11, color: '#bbb', margin: 0 }}>{selectedNode.lat.toFixed(2)}°, {selectedNode.lng.toFixed(2)}°</p>
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

            {/* Transactions with from/to */}
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
                        <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#bbb' }}>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes globePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
