import { notFound } from 'next/navigation'
import { getVisita, updateVisita, searchOrigenesContacto, getVisitaFormPricingContext } from '@/lib/actions/visitas'
import { getPaciente } from '@/lib/actions/pacientes'
import { searchEnfermeras } from '@/lib/actions/enfermeras'
import { searchLaboratorios } from '@/lib/actions/laboratorios'
import { searchProcedimientos, searchExamenes, searchPrevisiones, searchResidencias, getTiposRecargosForSelect, getTalleres } from '@/lib/actions/catalogos'
import { VisitaForm } from '@/components/visita-form'
import { getSignedUrl } from '@/lib/r2'

export default async function EditarVisitaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const visita = await getVisita(Number(id))
  if (!visita || !visita.idPaciente) notFound()

  const [
    detalle,
    { rows: enfermeras },
    { rows: laboratorios },
    { rows: procedimientos },
    { rows: examenes },
    talleres,
    origenesContacto,
    { rows: previsiones },
    { rows: residencias },
    tiposRecargos,
  ] = await Promise.all([
    getPaciente(visita.idPaciente),
    searchEnfermeras({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchLaboratorios({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchProcedimientos({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchExamenes({ filters: {}, sort: null, page: 1, pageSize: 5000 }),
    getTalleres(),
    searchOrigenesContacto(),
    searchPrevisiones({ filters: { mostrarInactivos: false }, sort: null, page: 1, pageSize: 1000 }),
    searchResidencias({ filters: { mostrarInactivos: false }, sort: null, page: 1, pageSize: 1000 }),
    getTiposRecargosForSelect(),
  ])

  if (!detalle) notFound()

  const [pricingContext, signedUrlOrdenMedica] = await Promise.all([
    getVisitaFormPricingContext(visita.idPaciente, examenes.map((e) => e.id)),
    visita.keyOrdenMedica ? getSignedUrl(visita.keyOrdenMedica) : Promise.resolve(null),
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

  return (
    <VisitaForm
      paciente={paciente}
      visita={visita}
      enfermeras={enfermeras}
      laboratorios={laboratorios}
      procedimientos={procedimientos}
      examenes={examenes}
      talleres={talleres}
      origenesContacto={origenesContacto}
      pricingContext={pricingContext}
      tiposRecargos={tiposRecargos}
      signedUrlOrdenMedica={signedUrlOrdenMedica}
      onSubmit={updateVisita}
    />
  )
}
