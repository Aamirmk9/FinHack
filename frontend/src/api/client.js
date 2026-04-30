import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_API_URL || '';
const api = axios.create({ baseURL: `${BACKEND_URL}/api`, timeout: 4000 });

const SNAP = '/snapshot';
const snap = (path) => fetch(`${SNAP}${path}`).then(r => {
  if (!r.ok) throw new Error(`snapshot ${path} ${r.status}`);
  return r.json();
});
const withFallback = (live, fallback) => live().catch(fallback);

export const fetchStats = () =>
  withFallback(() => api.get('/stats').then(r => r.data), () => snap('/stats.json'));

export const fetchNetwork = (minScore = 0, maxNodes = 500) =>
  withFallback(
    () => api.get(`/network?min_score=${minScore}&max_nodes=${maxNodes}`).then(r => r.data),
    () => snap('/network.json').then(d => ({
      ...d,
      nodes: (d.nodes || []).filter(n => (n.score ?? n.risk_score ?? 0) >= minScore).slice(0, maxNodes),
    })),
  );

export const fetchAlerts = (limit = 20) =>
  withFallback(
    () => api.get(`/alerts?limit=${limit}`).then(r => r.data),
    () => snap('/alerts.json').then(d => Array.isArray(d) ? d.slice(0, limit) : d),
  );

export const fetchCluster = (id) =>
  withFallback(() => api.get(`/cluster/${id}`).then(r => r.data), () => snap(`/clusters/${id}.json`));

export const fetchWallet = (address) =>
  withFallback(() => api.get(`/wallet/${address}`).then(r => r.data), () => snap(`/wallets/${address}.json`));

export const fetchTimeline = (clusterId) =>
  withFallback(() => api.get(`/timeline/${clusterId}`).then(r => r.data), () => snap(`/timelines/${clusterId}.json`));

export const fetchCompare = () =>
  withFallback(() => api.get('/compare').then(r => r.data), () => snap('/compare.json'));

export const fetchChartData = () =>
  withFallback(() => api.get('/chart-data').then(r => r.data), () => snap('/chart-data.json'));

export const generateSAR = (clusterId) =>
  withFallback(
    () => api.post(`/sar/${clusterId}`).then(r => r.data),
    () => snap(`/sar/${clusterId}.json`),
  );
