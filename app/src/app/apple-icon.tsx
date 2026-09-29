import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0f0f10',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#4ade80',
          fontSize: 96,
          fontWeight: 700,
          fontFamily: 'system-ui',
        }}
      >
        ♪
      </div>
    ),
    size
  );
}
