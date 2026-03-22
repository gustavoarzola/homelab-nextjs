import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Homelab - Gestión de Visitas de Enfermería',
  description: 'Sistema de gestión de visitas de enfermería a domicilio',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
