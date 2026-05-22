import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

async function handleSignOut() {
  'use server'
  await signOut({ redirectTo: '/login' })
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      <Sidebar
        userName={session.user?.name ?? 'Usuario'}
        userRole={session.user?.role ?? 'usuario'}
        onSignOut={handleSignOut}
      />
      <main className="relative flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
