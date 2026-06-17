import { notFound, redirect } from 'next/navigation'
import { getPaciente } from '@/lib/actions/pacientes'
import { searchEnfermeras } from '@/lib/actions/enfermeras'
import { searchProcedimientos, searchExamenes, searchPrevisiones, searchResidencias, getTiposRecargosForSelect, getTalleres, getIsaprePrevisiones } from '@/lib/actions/catalogos'
import { searchOrigenesContacto, createVisita, getVisitaFormPricingContext } from '@/lib/actions/visitas'
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
    { rows: procedimientos },
    { rows: examenes },
    talleres,
    origenesContacto,
    { rows: previsiones },
    { rows: residencias },
    tiposRecargos,
  ] = await Promise.all([
    getPaciente(id),
    searchEnfermeras({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchProcedimientos({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchExamenes({ filters: {}, sort: null, page: 1, pageSize: 5000 }),
    getTalleres(),
    searchOrigenesContacto(),
    searchPrevisiones({ filters: { mostrarInactivos: false }, sort: null, page: 1, pageSize: 1000 }),
    searchResidencias({ filters: { mostrarInactivos: false }, sort: null, page: 1, pageSize: 1000 }),
    getTiposRecargosForSelect(),
  ])

  if (!detalle) notFound()

  const [pricingContext, isaprePrevisiones] = await Promise.all([
    getVisitaFormPricingContext(id, examenes.map((e) => e.id)),
    getIsaprePrevisiones(),
  ])

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
  }

  async function handleSubmit(fd: FormData) {
    'use server'
    const result = await createVisita(fd)
    if (result.success) {
      redirect(`/visitas/${result.data.id}`)
    }
    return result
  }

  return (
    <VisitaForm
      paciente={paciente}
      enfermeras={enfermeras}
      procedimientos={procedimientos}
      examenes={examenes}
      talleres={talleres}
      origenesContacto={origenesContacto}
      pricingContext={pricingContext}
      isaprePrevisiones={isaprePrevisiones}
      tiposRecargos={tiposRecargos}
      onSubmit={handleSubmit}
    />
  )
}
