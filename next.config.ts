import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // Permite aislar el build/output de Next en un directorio separado del
  // `.next` por defecto — usado por la suite E2E (playwright.config.ts) para
  // no pisar/interferir con un `next dev` ya corriendo sobre este mismo
  // repo (Next 16 usa `.next/dev/*` para el server de dev; un `next build`
  // normal reescribe el resto de `.next/`, que preferimos no tocar mientras
  // otro proceso lo está usando).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default config
