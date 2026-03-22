'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/visitas', label: 'Visitas', icon: Calendar },
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/enfermeras', label: 'Enfermeras', icon: Stethoscope },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

type Props = {
  userName: string
  userRole: string
  onSignOut: () => void
}

export function Sidebar({ userName, userRole, onSignOut }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'relative flex h-screen flex-col border-r transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-colors hover:opacity-80"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
          color: 'var(--muted-foreground)',
        }}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/* Logo */}
      <div
        className="flex h-14 items-center gap-3 border-b px-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          H
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Homelab
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'font-medium'
                  : 'hover:opacity-80'
              )}
              style={
                active
                  ? {
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-foreground)',
                    }
                  : {
                      color: 'var(--muted-foreground)',
                    }
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Usuario + logout */}
      <div
        className="border-t p-2"
        style={{ borderColor: 'var(--border)' }}
      >
        {!collapsed && (
          <div className="mb-1 px-3 py-2">
            <p className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {userName}
            </p>
            <p className="text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>
              {userRole}
            </p>
          </div>
        )}
        <button
          onClick={onSignOut}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:opacity-80"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}
