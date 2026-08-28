import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

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
    <html lang="es" data-density="medium" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <NextTopLoader color="#1F7AB8" showSpinner={false} height={2} />
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  )
}
