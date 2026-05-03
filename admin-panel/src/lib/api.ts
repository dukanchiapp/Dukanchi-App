import axios from 'axios';

// With the Vite proxy, all /api calls go through localhost:5173 → localhost:3000.
// Using an empty baseURL makes requests same-origin, so SameSite=Lax cookies are sent correctly.
export const API_URL = '';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const getAdminHeaders = () => {
  return {};
};

// For image URLs — use same origin in production, localhost:3000 in dev
export const imgUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = import.meta.env.PROD ? '' : 'http://localhost:3000';
  return `${base}${path}`;
};

export default api;
