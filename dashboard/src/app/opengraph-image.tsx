import { ImageResponse } from 'next/og'

export const alt = 'A2Z Agent — Autonomous Web3 Scavenger Dashboard'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: '#13111C',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Purple accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '-15%',
            right: '-10%',
            width: '50%',
            height: '50%',
            borderRadius: '50%',
            background: '#42344B',
            filter: 'blur(100px)',
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-20%',
            left: '-5%',
            width: '40%',
            height: '40%',
            borderRadius: '50%',
            background: '#42344B',
            filter: 'blur(80px)',
            opacity: 0.3,
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            A2Z Agent
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: '#a8a0b8',
              letterSpacing: '0.05em',
              marginTop: 8,
            }}
          >
            Autonomous Web3 Scavenger Dashboard
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              fontSize: 20,
              color: '#6b5f7b',
              letterSpacing: '0.04em',
            }}
          >
            Powered by AMD Instinct MI300X + AIM-tuned Qwen 2.5 72B
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
