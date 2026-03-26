'use client'

import { useEffect, useRef } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import type { VisitaAsignacion } from '@/lib/actions/asignacion'

const SANTIAGO = { lat: -33.45, lng: -70.65 }

export function AsignacionMap({ visitas }: { visitas: VisitaAsignacion[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])

  useEffect(() => {
    const container = mapRef.current
    if (!container) return

    setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '', v: 'weekly' })
    Promise.all([importLibrary('maps'), importLibrary('marker')]).then(([mapsLib, markerLib]) => {
      if (!container.isConnected) return

      const { Map } = mapsLib as google.maps.MapsLibrary
      const { AdvancedMarkerElement } = markerLib as google.maps.MarkerLibrary

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new Map(container, {
          center: SANTIAGO,
          zoom: 11,
          mapId: 'asignacion-map',
          disableDefaultUI: true,
          zoomControl: true,
        })
      }

      // Clear old markers
      markersRef.current.forEach((m) => { m.map = null })
      markersRef.current = []

      const valid = visitas.filter((v) => v.latitud && v.longitud)
      if (!valid.length) {
        mapInstanceRef.current.setCenter(SANTIAGO)
        mapInstanceRef.current.setZoom(11)
        return
      }

      const bounds = new google.maps.LatLngBounds()
      for (const v of valid) {
        const lat = parseFloat(v.latitud!)
        const lng = parseFloat(v.longitud!)
        if (isNaN(lat) || isNaN(lng)) continue
        const position = { lat, lng }
        const marker = new AdvancedMarkerElement({ map: mapInstanceRef.current, position })
        markersRef.current.push(marker)
        bounds.extend(position)
      }

      if (markersRef.current.length === 1) {
        mapInstanceRef.current.setCenter(bounds.getCenter())
        mapInstanceRef.current.setZoom(14)
      } else if (markersRef.current.length > 1) {
        mapInstanceRef.current.fitBounds(bounds)
      }
    })
  }, [visitas])

  return (
    <div
      ref={mapRef}
      className="h-full w-full overflow-hidden rounded-lg"
      style={{ minHeight: '300px', border: '1px solid var(--border)' }}
    />
  )
}
