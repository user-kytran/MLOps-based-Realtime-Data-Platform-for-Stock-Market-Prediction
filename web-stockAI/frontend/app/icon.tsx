import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
          color: 'white',
          fontWeight: 'bold',
          borderRadius: '50%',
        }}
      >
        S
      </div>
    ),
    {
      ...size,
    }
  )
}

