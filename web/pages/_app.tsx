import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '../components/theme-provider';
import { Toaster } from '../components/ui/toaster';
import { TooltipProvider } from '../components/ui/tooltip';
import { useRouter } from 'next/router';

export default function MyApp({ Component, pageProps }: AppProps) {
  const [client] = useState(() => new QueryClient());
  const router = useRouter();
  const publicRoutes = useMemo(
    () => new Set(['/', '/login', '/otp', '/change-password']),
    [],
  );
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const isPublic = publicRoutes.has(router.pathname);
      if (!token && !isPublic) {
        if (router.pathname !== '/login') {
          router.replace('/login');
        }
        setAuthChecked(true);
        return;
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, [publicRoutes, router]);

  if (typeof window !== 'undefined' && !authChecked && !publicRoutes.has(router.pathname)) {
    return null;
  }
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <QueryClientProvider client={client}>
          <div className="min-h-screen bg-background text-foreground">
            <Component {...pageProps} />
          </div>
          <Toaster />
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
