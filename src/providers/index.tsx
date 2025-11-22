'use client';
import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

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
 * - MiniKitProvider: Required for MiniKit functionality
 * - SessionProvider: Handles authentication session
 */
export default function ClientProviders({
  children,
  session,
}: ClientProvidersProps) {
  return (
    <ErudaProvider>
      <MiniKitProvider>
        <SessionProvider session={session}>
          <div className="text-foreground bg-background min-h-screen overflow-x-hidden safe-paddings">
            {children}
          </div>
        </SessionProvider>
      </MiniKitProvider>
    </ErudaProvider>
  );
}
