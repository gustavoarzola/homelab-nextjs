import { auth } from '@/auth'

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Bienvenido, {session?.user?.name}
        </p>
      </div>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Visitas hoy', 'Pacientes activos', 'Enfermeras', 'Visitas este mes'].map(
          (label) => (
            <div
              key={label}
              className="rounded-xl border p-6"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {label}
              </p>
              <p
                className="mt-2 text-3xl font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                —
              </p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
