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

export function getPostLoginRoute() {
  const user = getStoredUser();
  return user?.mustChangePassword ? '/change-password' : '/dashboard';
}
