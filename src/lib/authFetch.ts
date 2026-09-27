import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';

export const API_BASE_URL = import.meta.env.DEV
  ? ''
  : 'https://datavisualizer-signalling-server.onrender.com';

const LAST_REFRESH_KEY = 'auth-last-refresh';
const REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // refresh at most every 6 hours

let sessionExpiredNotified = false;

/**
 * The server rejected our token, so the stored session is dead. Clearing it keeps the UI honest:
 * without this the app still looks signed in while every request fails with "Invalid token".
 */
export const handleSessionExpired = () => {
  const { token, logout, openLoginModal } = useAuthStore.getState();
  if (!token) return; // already cleared by an earlier failure
  logout();
  localStorage.removeItem(LAST_REFRESH_KEY);
  if (!sessionExpiredNotified) {
    sessionExpiredNotified = true;
    useStore.getState().setNotification({
      message: 'Your session expired. Please sign in again.',
      type: 'error',
    });
    setTimeout(() => { sessionExpiredNotified = false; }, 5000);
  }
  openLoginModal();
};

/** fetch() with the stored token attached, turning a 401 into a real sign-out instead of a stale session. */
export const authFetch = async (path: string, init: RequestInit = {}) => {
  const { token } = useAuthStore.getState();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (res.status === 401) {
    handleSessionExpired();
    throw new Error('Your session expired. Please sign in again.');
  }
  return res;
};

/**
 * Trade a still-valid token for a fresh one. Tokens expire server-side, so without this a user who
 * keeps the app open (or returns after a few days) silently loses the session.
 */
export const refreshAuthToken = async (force = false): Promise<boolean> => {
  const { token, user } = useAuthStore.getState();
  if (!token || !user) return false;

  const last = Number(localStorage.getItem(LAST_REFRESH_KEY) || 0);
  if (!force && Date.now() - last < REFRESH_INTERVAL) return true;

  try {
    const res = await authFetch('/api/auth/refresh', { method: 'POST' });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.token) return false;
    useAuthStore.getState().setToken(data.token);
    if (data.user) useAuthStore.getState().updateUser(data.user);
    localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
    return true;
  } catch {
    return false; // network failure, or authFetch already signed us out
  }
};
