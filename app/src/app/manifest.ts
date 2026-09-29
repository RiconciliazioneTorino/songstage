import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SongStage',
    short_name: 'SongStage',
    description: 'Proiezione e arrangiamento di canti di adorazione per chiese',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0f0f10',
    theme_color: '#0f0f10',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
