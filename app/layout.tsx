import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://clearpath-access.chatgpt.site'),
  title: 'ClearPath — Human + agent accessibility planning',
  description: 'A WebMCP-native spatial accessibility studio where people and agents audit, compare, and improve shared floor plans.',
  openGraph: {
    title: 'ClearPath — Human + agent accessibility planning',
    description: 'Audit, compare, and improve shared floor plans through a reviewable WebMCP workflow.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ClearPath accessible route planner' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClearPath — Human + agent accessibility planning',
    description: 'Audit, compare, and improve shared floor plans through a reviewable WebMCP workflow.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
