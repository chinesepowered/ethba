'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';

const ErudaProvider = dynamic(
  () => import('@/providers/Eruda').then((c) => c.ErudaProvider),
  { ssr: false },
);

interface ClientProvidersProps {
  children: ReactNode;
  session: Session | null;
}

/**
 * ClientProvider wraps the app with essential context providers.
 *
 * - ErudaProvider: Development console for logging and debugging
 * - QueryClientProvider: React Query for data fetching and caching
 * - MiniKitProvider: Required for MiniKit functionality
 * - SessionProvider: Handles authentication session
 */
export default function ClientProviders({
  children,
  session,
}: ClientProvidersProps) {
  // Create QueryClient instance per component to avoid shared cache issues
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <ErudaProvider>
      <QueryClientProvider client={queryClient}>
        <MiniKitProvider>
          <SessionProvider session={session}>
            <div className="text-foreground bg-background min-h-screen overflow-x-hidden safe-paddings">
              {children}
            </div>
          </SessionProvider>
        </MiniKitProvider>
      </QueryClientProvider>
    </ErudaProvider>
  );
}
