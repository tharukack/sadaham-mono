import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/ui/use-toast';
import { KeyRound } from 'lucide-react';
import { getStoredUser, setStoredUser, clearStoredSession } from '../lib/session';

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkSession = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.user) {
          setStoredUser({
            ...res.data.user,
            mustChangePassword: Boolean(res.data.mustChangePassword),
          });
          if (!res.data.mustChangePassword) {
            router.replace('/dashboard');
            return;
          }
          setCheckedSession(true);
          return;
        }
      } catch {
        clearStoredSession();
      }
      router.replace('/login');
    };
    void checkSession();
  }, [router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Passwords do not match',
        description: 'Please enter the same new password in both fields.',
      });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { newPassword });
      const currentUser = getStoredUser();
      if (currentUser) {
        setStoredUser({ ...currentUser, mustChangePassword: false });
      }
      toast({ title: 'Password updated' });
      router.push('/dashboard');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err?.response?.data?.message || 'Unable to update password.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!checkedSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center text-sm uppercase tracking-[0.35em] text-slate-300">
          Redirecting
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-900">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/buddha.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200/70 via-white/50 to-white/70" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md border-white/60 bg-white/70 shadow-[0_24px_60px_rgba(15,23,42,0.25)] backdrop-blur">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow">
              <KeyRound className="h-5 w-5 text-slate-700" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-semibold text-slate-900">
              Change Password
            </CardTitle>
            <CardDescription className="text-slate-600">
              You must set a new password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  className="bg-white/80"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  className="bg-white/80"
                />
              </div>
              <Button
                className="w-full rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
