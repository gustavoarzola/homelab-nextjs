'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  ClipboardCheck,
  Users,
  Stethoscope,
  ClipboardList,
  Microscope,
  Shield,
  Building2,
  MapPin,
  AlertCircle,
  LogOut,
  Mail,
  Tag,
  FileText,
  BookOpen,
  Wallet,
  FileSpreadsheet,
  Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/visitas', label: 'Visitas', icon: Calendar },
  { href: '/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { href: '/asignacion', label: 'Asignación', icon: ClipboardCheck },
  { href: '/asignacion/envio-correos', label: 'Envío de correos', icon: Mail },
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/enfermeras', label: 'Enfermeras', icon: Stethoscope },
  { href: '/pagos-enfermeras', label: 'Pagos enfermeras', icon: Wallet },
]

const catalogItems = [
  { href: '/procedimientos', label: 'Procedimientos', icon: ClipboardList },
  { href: '/examenes', label: 'Exámenes', icon: Microscope },
  { href: '/talleres', label: 'Talleres', icon: BookOpen },
  { href: '/previsiones', label: 'Previsiones', icon: Shield },
  { href: '/residencias', label: 'Residencias', icon: Building2 },
  { href: '/comunas', label: 'Comunas', icon: MapPin },
  { href: '/tipos-recargos', label: 'Tipos de Recargos', icon: AlertCircle },
  { href: '/origenes-contacto', label: 'Orígenes de contacto', icon: Megaphone },
  { href: '/precios/visitas', label: 'Precios visitas', icon: Tag },
  { href: '/reportes', label: 'Reportes', icon: FileSpreadsheet },
]

const allItems = [...navItems, ...catalogItems]

function isActive(pathname: string, href: string) {
  if (pathname === href) return true
  if (!pathname.startsWith(href + '/')) return false
  // evita que "/asignacion" quede activo estando en "/asignacion/envio-correos"
  const moreSpecific = allItems.some(
    (other) => other.href !== href && other.href.startsWith(href + '/') && pathname.startsWith(other.href)
  )
  return !moreSpecific
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

type Props = {
  userName: string
  userRole: string
  onSignOut: () => void
}

export function Sidebar({ userName, userRole, onSignOut }: Props) {
  const pathname = usePathname()

  return (
    <aside className="app-side">
      <div className="app-side__logo">
        <Image src="/homelab-logo.png" alt="HomeLab" height={54} width={104} style={{ height: 54, width: 'auto' }} priority />
      </div>

      <nav className="app-side__nav">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn(isActive(pathname, href) && 'active')}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}

        <div className="app-side__group">Catálogos</div>
        {catalogItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn(isActive(pathname, href) && 'active')}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="app-side__user">
        <span className="hl-avatar">{initials(userName)}</span>
        <div className="min-w-0">
          <b className="truncate">{userName}</b>
          <span className="capitalize">{userRole}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="hl-btn hl-btn--ghost hl-btn--sm"
        style={{ margin: '0 8px 8px', width: 'calc(100% - 16px)', justifyContent: 'flex-start' }}
      >
        <LogOut />
        <span>Cerrar sesión</span>
      </button>
    </aside>
  )
}
