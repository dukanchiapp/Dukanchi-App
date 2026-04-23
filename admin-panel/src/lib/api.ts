import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
});

// Helper to get headers with admin token
export const getAdminHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return {
    Authorization: `Bearer ${token}`,
  };
};

// Prefix relative /uploads/... paths with the backend origin
export const imgUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
};

export default api;
