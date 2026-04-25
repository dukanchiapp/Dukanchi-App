import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Helper to get headers (no longer needs token, kept for backward compatibility if any callers expect it)
export const getAdminHeaders = () => {
  return {};
};

// Prefix relative /uploads/... paths with the backend origin
export const imgUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
};

export default api;
