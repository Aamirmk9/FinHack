import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_API_URL || '';
const api = axios.create({ baseURL: `${BACKEND_URL}/api` });

export const fetchStats = () => api.get('/stats').then(r => r.data);
export const fetchNetwork = (minScore = 0, maxNodes = 500) =>
  api.get(`/network?min_score=${minScore}&max_nodes=${maxNodes}`).then(r => r.data);
export const fetchAlerts = (limit = 20) =>
  api.get(`/alerts?limit=${limit}`).then(r => r.data);
export const fetchCluster = (id) => api.get(`/cluster/${id}`).then(r => r.data);
export const fetchWallet = (address) => api.get(`/wallet/${address}`).then(r => r.data);
export const fetchTimeline = (clusterId) => api.get(`/timeline/${clusterId}`).then(r => r.data);
export const fetchCompare = () => api.get('/compare').then(r => r.data);
export const fetchChartData = () => api.get('/chart-data').then(r => r.data);
export const generateSAR = (clusterId) => api.post(`/sar/${clusterId}`).then(r => r.data);
