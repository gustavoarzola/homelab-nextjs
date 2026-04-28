import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import NextTopLoader from 'nextjs-toploader'
import { Toaster } from 'sonner'
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
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextTopLoader color="#18181b" showSpinner={false} height={2} />
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
