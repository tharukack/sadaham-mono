import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/ui/use-toast';
import { ShieldCheck } from 'lucide-react';

export default function OtpPage() {
  const [code, setCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('otpToken');
    if (stored) setOtpToken(stored);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (!otpToken) {
        throw new Error('Missing OTP token. Please log in again.');
      }
      const res = await api.post('/auth/verify-otp', { otpToken, code });
      const { accessToken, redirect, user, mustChangePassword } = res.data;
      if (accessToken) {
        localStorage.setItem('token', accessToken);
      }
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }
      localStorage.removeItem('otpToken');
      localStorage.removeItem('otpMobile');
      if (mustChangePassword) {
        router.push('/change-password');
        return;
      }
      router.push(redirect || '/dashboard');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Verification failed',
        description: err?.response?.data?.message || 'Invalid OTP code.',
      });
    }
  };

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
              <ShieldCheck className="h-5 w-5 text-slate-700" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-semibold text-slate-900">
              OTP Verification
            </CardTitle>
            <CardDescription className="text-slate-600">
              Enter the OTP sent to your mobile number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp-code">OTP Code</Label>
                <Input
                  id="otp-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="bg-white/80"
                />
              </div>
              <Button
                className="w-full rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
                type="submit"
              >
                Verify
              </Button>
              {!otpToken && (
                <div className="rounded-md border border-slate-200/70 bg-white/80 p-3 text-xs text-slate-500">
                  Missing OTP token. Please return to login.
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
