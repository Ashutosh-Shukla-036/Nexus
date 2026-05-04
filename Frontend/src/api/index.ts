import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getWSUrl = (path: string) => `${WS_BASE_URL}${path}`;

export const apiService = {
  // Metrics
  getMetrics: () => api.get('/metrics/').then(res => res.data),
  collectMetrics: () => api.post('/metrics/collect').then(res => res.data),

  // Services
  getServices: () => api.get('/services/').then(res => res.data),
  addService: (data: { name: string; enabled: boolean }) => api.post('/services/add', data).then(res => res.data),
  startService: (name: string) => api.post(`/services/${name}/start`).then(res => res.data),
  stopService: (name: string) => api.post(`/services/${name}/stop`).then(res => res.data),
  restartService: (name: string) => api.post(`/services/${name}/restart`).then(res => res.data),
  enableService: (name: string) => api.post(`/services/${name}/enable`).then(res => res.data),
  disableService: (name: string) => api.post(`/services/${name}/disable`).then(res => res.data),
  deleteService: (name: string) => api.delete(`/services/${name}`).then(res => res.data),

  // Apps
  getApps: () => api.get('/apps/').then(res => res.data),
  getApp: (name: string) => api.get(`/apps/${name}`).then(res => res.data),
  scanRepo: (repo_url: string) => api.post('/apps/scan', { repo_url }).then(res => res.data),
  deployApp: (data: any) => api.post('/apps/deploy', data).then(res => res.data),
  deleteApp: (name: string) => api.delete(`/apps/${name}`).then(res => res.data),

  // Health
  getHealth: () => api.get('/health').then(res => res.data),
};
