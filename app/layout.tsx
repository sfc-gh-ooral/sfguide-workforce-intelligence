import type { Metadata } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import './globals.css';
import { Shell } from '@/components/Shell';
import { Providers } from './providers';

// next/font downloads these at build time and serves them from the app, so no CDN is used at runtime.
const display = Fraunces({ subsets: ['latin'], variable: '--font-display', axes: ['opsz'] });
const sans = Manrope({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Workforce Intelligence · governed HR analytics example',
  description: 'Governed, plain-English answers on headcount, attrition risk, and pay equity, on synthetic data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body><Providers><Shell>{children}</Shell></Providers></body>
    </html>
  );
}
