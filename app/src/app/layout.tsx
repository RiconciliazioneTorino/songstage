import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SongStage',
  description: 'Proiezione e arrangiamento di canti di adorazione per chiese',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
