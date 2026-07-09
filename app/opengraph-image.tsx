import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#060B13',
          fontFamily: 'sans-serif',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 256 256">
          <rect width="256" height="256" rx="18" fill="#378ADD" />
          <polyline
            points="40,128 92,128 112,88 132,172 152,128 216,128"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div
          style={{
            marginTop: 32,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#E8F0F8',
          }}
        >
          ROSTIRO
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 28,
            color: '#8FA9C0',
          }}
        >
          Run Every League.
        </div>
      </div>
    ),
    { ...size }
  )
}
