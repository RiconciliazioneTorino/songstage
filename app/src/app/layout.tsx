import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NavigationProgress } from '@/components/navigation-progress';

export const metadata: Metadata = {
  title: 'SongStage',
  description: 'Proiezione e arrangiamento di canti di adorazione per chiese',
  appleWebApp: {
    capable: true,
    title: 'SongStage',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f0f10',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
