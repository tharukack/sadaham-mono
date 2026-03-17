import axios from 'axios';
import { clearStoredOtpState, clearStoredSession } from './session';

const defaultApiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const defaultApiUrl = `http://${defaultApiHost}:4000`;

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || defaultApiUrl,
  withCredentials: true,
});

// Clear local session on auth failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      const status = error?.response?.status;
      if (status === 401) {
        clearStoredSession();
        if (!['/', '/login', '/otp'].includes(window.location.pathname)) {
          clearStoredOtpState();
          window.location.assign('/login');
        }
      }
    }
    return Promise.reject(error);
  },
);
