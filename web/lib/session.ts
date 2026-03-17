export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user');
}

export function clearStoredOtpState() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('otpToken');
  localStorage.removeItem('otpMobile');
}

export function getPostLoginRoute() {
  const user = getStoredUser();
  return user?.mustChangePassword ? '/change-password' : '/dashboard';
}
