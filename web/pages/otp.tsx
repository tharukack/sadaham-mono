import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/ui/use-toast';

export default function OtpPage() {
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [sessionId, setSessionId] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (router.query.mobile && typeof router.query.mobile === 'string') {
      setMobile(router.query.mobile);
    }
  }, [router.query.mobile]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/verify', { mobile, code });
      const { token: jwt, redirect, sessionId: newSessionId, user } = res.data;
      setToken(jwt);
      if (jwt) {
        localStorage.setItem('token', jwt);
      }
      if (newSessionId) {
        setSessionId(newSessionId);
        localStorage.setItem('sessionId', newSessionId);
      }
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }
      if (redirect) {
        router.push(redirect);
      } else {
        router.push('/dashboard');
      }
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
              <Label htmlFor="otp-mobile">Mobile</Label>
              <Input
                id="otp-mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+61400000000"
              />
            </div>
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
            {(token || sessionId) && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                {token && <div className="break-words">JWT: {token}</div>}
                {sessionId && <div className="break-words">Session: {sessionId}</div>}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
