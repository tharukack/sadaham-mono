import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/ui/use-toast';

export default function LoginPage() {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', { mobile, password });
      toast({
        title: 'OTP sent',
        description: `Expires at ${res.data.expiresAt}`,
      });
      router.push({ pathname: '/otp', query: { mobile } });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: err?.response?.data?.message || 'Unable to send OTP.',
      });
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Enter your mobile number and password to receive an OTP.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+61400000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button className="w-full" type="submit">
              Send OTP
            </Button>
            <p className="text-sm text-muted-foreground">
              After receiving your OTP, continue to the{' '}
              <Link href="/otp" className="underline">
                verification page
              </Link>
              .
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
