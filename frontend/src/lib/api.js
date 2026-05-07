import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 60000 });

export const fetchStats = (hours = 168) =>
  api.get(`/stats`, { params: { hours } }).then((r) => r.data);
export const fetchPosts = (params = {}) =>
  api.get(`/posts`, { params: { hours: 168, limit: 50, ...params } }).then((r) => r.data);
export const fetchPost = (id) => api.get(`/posts/${id}`).then((r) => r.data);
export const fetchReport = (hours = 168) =>
  api.get(`/report`, { params: { hours } }).then((r) => r.data);
export const fetchAlerts = (hours = 168) =>
  api.get(`/alerts`, { params: { hours } }).then((r) => r.data);
export const fetchTrends = (hours = 168) =>
  api.get(`/trends`, { params: { hours } }).then((r) => r.data);
export const fetchHeatmap = (hours = 168) =>
  api.get(`/heatmap`, { params: { hours } }).then((r) => r.data);
export const fetchSafety = (hours = 168) =>
  api.get(`/safety/summary`, { params: { hours } }).then((r) => r.data);
export const refreshInsights = (hours = 168, top_n = 10) =>
  api.post(`/insights/refresh`, null, { params: { hours, top_n } }).then((r) => r.data);
export const analyzeText = (payload) =>
  api.post(`/analyze`, payload).then((r) => r.data);
export const seedDemo = () => api.post(`/seed`).then((r) => r.data);
