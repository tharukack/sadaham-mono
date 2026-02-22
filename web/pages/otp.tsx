import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/ui/use-toast';

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
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>OTP Verification</CardTitle>
          <CardDescription>Enter the OTP sent to your mobile number.</CardDescription>
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
              />
            </div>
            <Button className="w-full" type="submit">
              Verify
            </Button>
            {!otpToken && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Missing OTP token. Please return to login.
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
