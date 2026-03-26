import { notFound } from 'next/navigation'
import { getPaciente } from '@/lib/actions/pacientes'
import { searchEnfermeras } from '@/lib/actions/enfermeras'
import { searchSucursales } from '@/lib/actions/laboratorios'
import { searchProcedimientos, searchExamenes, searchPrevisiones, searchResidencias } from '@/lib/actions/catalogos'
import { searchOrigenesContacto, createVisita } from '@/lib/actions/visitas'
import { VisitaForm } from '@/components/visita-form'

type Props = {
  searchParams: Promise<{ pacienteId?: string }>
}

export default async function NuevaVisitaPage({ searchParams }: Props) {
  const { pacienteId } = await searchParams
  if (!pacienteId) notFound()

  const id = Number(pacienteId)
  if (!id) notFound()

  const [
    detalle,
    { rows: enfermeras },
    { rows: sucursales },
    { rows: procedimientos },
    { rows: examenes },
    origenesContacto,
    { rows: previsiones },
    { rows: residencias },
  ] = await Promise.all([
    getPaciente(id),
    searchEnfermeras({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchSucursales({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchProcedimientos({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchExamenes({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchOrigenesContacto(),
    searchPrevisiones({ filters: { mostrarInactivos: false }, sort: null, page: 1, pageSize: 1000 }),
    searchResidencias({ filters: { mostrarInactivos: false }, sort: null, page: 1, pageSize: 1000 }),
  ])

  if (!detalle) notFound()

  const paciente = {
    id: detalle.id,
    nombres: detalle.nombres,
    apellidoPaterno: detalle.apellidoPaterno,
    apellidoMaterno: detalle.apellidoMaterno,
    identificador: detalle.identificador,
    tipoIdentificador: detalle.tipoIdentificador,
    fechaNacimiento: detalle.fechaNacimiento,
    telefonos: detalle.telefonos.map((t) => ({ telefono: t.telefono, descripcion: t.descripcion })),
    prevision: previsiones.find((p) => p.id === detalle.idCompaniaSeguro)?.nombre ?? null,
    residencia: residencias.find((r) => r.id === detalle.idResidenciaAdulto)?.nombre ?? null,
    direccionFormateada: detalle.direccionFormateada,
    direccion: detalle.direccion,
    latitud: detalle.latitud,
    longitud: detalle.longitud,
    contactoNombre: detalle.contactoNombre,
    contactoTelefono: detalle.contactoTelefono,
  }

  return (
    <VisitaForm
      paciente={paciente}
      enfermeras={enfermeras}
      sucursales={sucursales}
      procedimientos={procedimientos}
      examenes={examenes}
      origenesContacto={origenesContacto}
      onSubmit={createVisita}
    />
  )
}
