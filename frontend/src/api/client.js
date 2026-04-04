import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const fetchStats = () => api.get('/stats').then(r => r.data);
export const fetchNetwork = (minScore = 0, maxNodes = 500) =>
  api.get(`/network?min_score=${minScore}&max_nodes=${maxNodes}`).then(r => r.data);
export const fetchAlerts = (limit = 20) =>
  api.get(`/alerts?limit=${limit}`).then(r => r.data);
export const fetchCluster = (id) => api.get(`/cluster/${id}`).then(r => r.data);
export const fetchWallet = (address) => api.get(`/wallet/${address}`).then(r => r.data);
export const fetchTimeline = (clusterId) => api.get(`/timeline/${clusterId}`).then(r => r.data);
export const fetchCompare = () => api.get('/compare').then(r => r.data);
