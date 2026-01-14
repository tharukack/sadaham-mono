import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ThemeProvider } from '../components/theme-provider';
import { Toaster } from '../components/ui/toaster';

export default function MyApp({ Component, pageProps }: AppProps) {
  const [client] = useState(() => new QueryClient());
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={client}>
        <div className="min-h-screen bg-background text-foreground">
          <Component {...pageProps} />
        </div>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
