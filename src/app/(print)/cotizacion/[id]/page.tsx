import { notFound } from 'next/navigation'
import { getCotizacionVisita } from '@/lib/actions/precios'
import { formatDate, formatDateLong } from '@/lib/format'
import { formatRut } from '@/lib/rut'
import { PrintButton } from './print-button'
import type { ItemCotizacion } from '@/lib/actions/precios'

export default async function CotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getCotizacionVisita(Number(id))
  if (!data) notFound()

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  const numeroDoc = `COT-${String(data.id).padStart(5, '0')}`

  const PREVISION_LABELS: Record<string, string> = {
    fonasa: 'Fonasa',
    isapre: 'Isapre',
    particular: 'Particular',
  }

  const examenes = data.items.filter((i) => i.tipo === 'examen')
  const procedimientos = data.items.filter((i) => i.tipo === 'procedimiento')
  const visitaItem = data.items.find((i) => i.tipo === 'visita')

  const formatIdentificador = (tipo: string | null, valor: string | null) => {
    if (!valor) return null
    if (tipo === 'rut') return formatRut(valor)
    if (tipo === 'pasaporte') return `Pasaporte ${valor}`
    return valor
  }

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`Cotización ${numeroDoc}`}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            font-size: 13px;
            color: #1e2835;
            background: #f0f2f5;
            line-height: 1.5;
          }
          .page {
            max-width: 800px;
            margin: 32px auto;
            background: #ffffff;
            box-shadow: 0 4px 32px rgba(0,0,0,0.10);
          }
          /* Header */
          .doc-header {
            background: #1e2835;
            padding: 28px 40px;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
          }
          .doc-header-brand h1 {
            font-size: 20px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: 0.3px;
          }
          .doc-header-brand p {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 3px;
            letter-spacing: 0.5px;
          }
          .doc-header-meta {
            text-align: right;
          }
          .doc-header-meta .doc-num {
            font-size: 22px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: 0.5px;
          }
          .doc-header-meta .doc-label {
            font-size: 9px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            display: block;
            margin-bottom: 2px;
          }
          .doc-header-meta .doc-date {
            font-size: 11px;
            color: #cbd5e1;
            margin-top: 4px;
          }
          /* Body */
          .doc-body { padding: 36px 40px; }
          /* Info grid */
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 32px;
          }
          .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px 18px;
          }
          .info-box-title {
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #64748b;
            margin-bottom: 10px;
          }
          .info-field { margin-bottom: 6px; }
          .info-field:last-child { margin-bottom: 0; }
          .info-label {
            font-size: 10px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            display: block;
            margin-bottom: 1px;
          }
          .info-value {
            font-size: 13px;
            color: #1e2835;
            font-weight: 500;
          }
          /* Items table */
          .section-title {
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #64748b;
            margin-bottom: 8px;
          }
          table.items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0;
          }
          table.items thead tr {
            background: #f1f5f9;
          }
          table.items th {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #64748b;
            padding: 10px 14px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
          }
          table.items th.right { text-align: right; }
          table.items td {
            padding: 11px 14px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 13px;
            color: #1e2835;
          }
          table.items td.right { text-align: right; font-variant-numeric: tabular-nums; }
          table.items td.muted { color: #94a3b8; font-size: 12px; }
          table.items td.code { color: #94a3b8; font-size: 11px; font-family: 'Menlo', 'Courier New', monospace; }
          table.items tr.group-header td {
            background: #f8fafc;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #94a3b8;
            padding: 7px 14px;
            border-bottom: 1px solid #e2e8f0;
          }
          table.items tr.subtotal td {
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            border-bottom: none;
            font-size: 12px;
            color: #64748b;
            padding: 10px 14px;
          }
          table.items tr.subtotal td.right { font-weight: 600; color: #1e2835; }
          table.items tr.total td {
            background: #1e2835;
            color: #ffffff;
            padding: 14px;
            border-bottom: none;
          }
          table.items tr.total td.label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }
          table.items tr.total td.amount { font-size: 18px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
          /* Notes */
          .notes {
            margin-top: 32px;
            padding: 14px 18px;
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 8px;
            font-size: 11px;
            color: #92400e;
            line-height: 1.6;
          }
          .notes strong { font-weight: 600; }
          /* Footer */
          .doc-footer {
            margin-top: 32px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .doc-footer p { font-size: 10px; color: #94a3b8; }
          /* Print button bar */
          .print-bar {
            position: sticky;
            top: 0;
            z-index: 50;
            background: #1e2835;
            padding: 10px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }
          .print-bar p { font-size: 12px; color: #94a3b8; }
          /* Print styles */
          @media print {
            body { background: #ffffff; }
            .page { margin: 0; box-shadow: none; max-width: none; }
            .print-bar { display: none; }
            @page { margin: 1.5cm 2cm; }
          }
          @media (max-width: 640px) {
            .info-grid { grid-template-columns: 1fr; }
            .doc-header { flex-direction: column; }
            .doc-header-meta { text-align: left; }
          }
        `}</style>
      </head>
      <body>
        {/* Print toolbar */}
        <div className="print-bar">
          <p>Cotización {numeroDoc} · {data.paciente.nombreCompleto}</p>
          <PrintButton />
        </div>

        <div className="page">
          {/* Header */}
          <div className="doc-header">
            <div className="doc-header-brand">
              <h1>Homelab</h1>
              <p>Atención de Enfermería a Domicilio</p>
            </div>
            <div className="doc-header-meta">
              <span className="doc-label">Cotización</span>
              <div className="doc-num">{numeroDoc}</div>
              <div className="doc-date">Emitida el {formatDateLong(today)}</div>
            </div>
          </div>

          <div className="doc-body">
            {/* Info grid */}
            <div className="info-grid">
              {/* Paciente */}
              <div className="info-box">
                <p className="info-box-title">Paciente</p>
                <div className="info-field">
                  <span className="info-label">Nombre completo</span>
                  <span className="info-value">{data.paciente.nombreCompleto}</span>
                </div>
                {data.paciente.identificador && (
                  <div className="info-field">
                    <span className="info-label">{data.paciente.tipoIdentificador === 'rut' ? 'RUT' : data.paciente.tipoIdentificador === 'pasaporte' ? 'Pasaporte' : 'Identificador'}</span>
                    <span className="info-value">
                      {formatIdentificador(data.paciente.tipoIdentificador, data.paciente.identificador)}
                    </span>
                  </div>
                )}
                {data.paciente.fechaNacimiento && (
                  <div className="info-field">
                    <span className="info-label">Fecha de nacimiento</span>
                    <span className="info-value">{formatDate(data.paciente.fechaNacimiento)}</span>
                  </div>
                )}
                {data.paciente.prevision && (
                  <div className="info-field">
                    <span className="info-label">Previsión</span>
                    <span className="info-value">{data.paciente.prevision} <span style={{ fontSize: '11px', color: '#94a3b8' }}>({PREVISION_LABELS[data.tipoPrevision]})</span></span>
                  </div>
                )}
                {data.paciente.direccion && (
                  <div className="info-field">
                    <span className="info-label">Dirección</span>
                    <span className="info-value" style={{ fontSize: '12px' }}>{data.paciente.direccion}</span>
                  </div>
                )}
              </div>

              {/* Visita */}
              <div className="info-box">
                <p className="info-box-title">Datos de la visita</p>
                <div className="info-field">
                  <span className="info-label">Fecha</span>
                  <span className="info-value">{formatDateLong(data.fecha)}</span>
                </div>
                {data.hora && (
                  <div className="info-field">
                    <span className="info-label">Hora</span>
                    <span className="info-value">{data.hora.slice(0, 5)}</span>
                  </div>
                )}
                {data.enfermera && (
                  <div className="info-field">
                    <span className="info-label">Enfermera</span>
                    <span className="info-value">{data.enfermera}</span>
                  </div>
                )}
                {data.sucursal && (
                  <div className="info-field">
                    <span className="info-label">Laboratorio / Sucursal</span>
                    <span className="info-value" style={{ fontSize: '12px' }}>{data.sucursal}</span>
                  </div>
                )}
                <div className="info-field" style={{ marginTop: '8px' }}>
                  <span className="info-label">N° de referencia</span>
                  <span className="info-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    VIS-{String(data.id).padStart(5, '0')}
                  </span>
                </div>
              </div>
            </div>

            {/* Items */}
            <table className="items">
              <thead>
                <tr>
                  <th style={{ width: '44px' }}>#</th>
                  <th>Descripción</th>
                  <th style={{ width: '90px' }}>Código</th>
                  <th className="right" style={{ width: '120px' }}>Precio</th>
                </tr>
              </thead>
              <tbody>
                {examenes.length > 0 && (
                  <>
                    <tr className="group-header">
                      <td colSpan={4}>Exámenes de laboratorio</td>
                    </tr>
                    {examenes.map((item, i) => (
                      <ItemRow key={`ex-${i}`} index={i + 1} item={item} />
                    ))}
                  </>
                )}

                {procedimientos.length > 0 && (
                  <>
                    <tr className="group-header">
                      <td colSpan={4}>Procedimientos de enfermería</td>
                    </tr>
                    {procedimientos.map((item, i) => (
                      <ItemRow key={`pr-${i}`} index={examenes.length + i + 1} item={item} noPrice />
                    ))}
                  </>
                )}

                {visitaItem && (
                  <>
                    <tr className="group-header">
                      <td colSpan={4}>Traslado y atención</td>
                    </tr>
                    <ItemRow index={examenes.length + procedimientos.length + 1} item={visitaItem} />
                  </>
                )}

                {/* Subtotals */}
                {examenes.length > 0 && data.subtotalExamenes > 0 && (
                  <tr className="subtotal">
                    <td colSpan={3}>Subtotal exámenes</td>
                    <td className="right">${data.subtotalExamenes.toLocaleString('es-CL')}</td>
                  </tr>
                )}
                {data.costoVisitaEnfermeria > 0 && (
                  <tr className="subtotal">
                    <td colSpan={3}>Visita de enfermería</td>
                    <td className="right">${data.costoVisitaEnfermeria.toLocaleString('es-CL')}</td>
                  </tr>
                )}

                {/* Total */}
                <tr className="total">
                  <td colSpan={3} className="label">Total cotización</td>
                  <td className="amount">
                    {data.total > 0
                      ? `$${data.total.toLocaleString('es-CL')}`
                      : <span style={{ fontSize: '13px', fontWeight: 400, color: '#94a3b8' }}>Sin precios configurados</span>
                    }
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Notes */}
            <div className="notes">
              <strong>Nota:</strong> Esta cotización es referencial y tiene una validez de 30 días desde su emisión. Los precios pueden variar según disponibilidad. Para confirmar su visita, contáctenos al número indicado. Los procedimientos de enfermería están incluidos en el servicio de visita domiciliaria.
            </div>

            {/* Footer */}
            <div className="doc-footer">
              <p>Homelab · Atención de Enfermería a Domicilio</p>
              <p>Emitida el {formatDateLong(today)}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

function ItemRow({ index, item, noPrice }: { index: number; item: ItemCotizacion; noPrice?: boolean }) {
  return (
    <tr>
      <td className="muted" style={{ textAlign: 'right', paddingRight: '16px' }}>{index}</td>
      <td>{item.descripcion}</td>
      <td className="code">{item.codigo}</td>
      <td className="right">
        {noPrice ? (
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>incluido</span>
        ) : item.precio !== null ? (
          `$${item.precio.toLocaleString('es-CL')}`
        ) : (
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>—</span>
        )}
      </td>
    </tr>
  )
}
