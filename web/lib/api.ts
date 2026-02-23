import axios from 'axios';

const defaultApiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const defaultApiUrl = `http://${defaultApiHost}:4000`;

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || defaultApiUrl,
});

// Attach bearer token from localStorage on browser requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return config;
});

// Clear local session on auth failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      const status = error?.response?.status;
      const token = localStorage.getItem('token');
      if (status === 401 && token) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('otpToken');
        localStorage.removeItem('otpMobile');
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      }
    }
    return Promise.reject(error);
  },
);
