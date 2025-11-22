import { auth } from '@/auth';
import ClientProviders from '@/providers';
import '@worldcoin/mini-apps-ui-kit-react/styles.css';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ADS Platform - Decentralized Advertising',
  description: 'Bid, click, and earn with World ID verified advertising',
  keywords: ['advertising', 'World ID', 'decentralized', 'web3', 'crypto'],
  authors: [{ name: 'ADS Platform' }],
  openGraph: {
    title: 'ADS Platform - Decentralized Advertising',
    description: 'Bid, click, and earn with World ID verified advertising',
    type: 'website',
    siteName: 'ADS Platform',
  },
  twitter: {
    card: 'summary',
    title: 'ADS Platform - Decentralized Advertising',
    description: 'Bid, click, and earn with World ID verified advertising',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="app-container">
          <ClientProviders session={session}>{children}</ClientProviders>
        </div>
      </body>
    </html>
  );
}
