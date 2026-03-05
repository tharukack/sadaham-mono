import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { LogIn } from 'lucide-react';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-900">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/buddha.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200/70 via-white/50 to-white/70" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        <Card className="w-full max-w-lg border-white/60 bg-white/70 shadow-[0_24px_60px_rgba(15,23,42,0.25)] backdrop-blur">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow">
              <LogIn className="h-5 w-5 text-slate-700" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-semibold text-slate-900">
              Sadaham Sewana Order Management System
            </CardTitle>
            <CardDescription className="text-slate-600">
              Secure access for authorized teams.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button
              asChild
              className="rounded-full bg-slate-900 px-8 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
            >
              <Link href="/login">Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
