import { useEffect, useMemo } from 'react'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { APP } from '../config'
import { STATUS_META, ticketRef } from '../lib/format'
import type { GeoPoint, Issue } from '../types'

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'

function pinIcon(issue: Pick<Issue, 'status' | 'ref' | 'severity'>, active = false) {
  const tone = STATUS_META[issue.status].tone
  return L.divIcon({
    className: '',
    html: `<div class="mpin tone-${tone} ${active ? 'is-active' : ''}"><span>${ticketRef(issue.ref).slice(3)}</span></div>`,
    iconSize: [46, 26],
    iconAnchor: [23, 30],
  })
}

const crossIcon = L.divIcon({
  className: '',
  html: '<div class="xpin"><i></i></div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

function FitTo({ points }: { points: GeoPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15)
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 15 })
  }, [map, points])
  return null
}

export function IssueMap({
  issues,
  activeId,
  onSelect,
  className = '',
  interactive = true,
}: {
  issues: Issue[]
  activeId?: string
  onSelect?: (id: string) => void
  className?: string
  interactive?: boolean
}) {
  const pts = useMemo(() => issues.map((i) => i.location), [issues])
  return (
    <MapContainer
      center={[APP.defaultCenter.lat, APP.defaultCenter.lng]}
      zoom={12}
      className={`map ${className}`}
      scrollWheelZoom={interactive}
      dragging={interactive}
      zoomControl={interactive}
      attributionControl
    >
      <TileLayer url={TILES} attribution={ATTR} />
      <FitTo points={pts} />
      {issues.map((i) => (
        <Marker
          key={i.id}
          position={[i.location.lat, i.location.lng]}
          icon={pinIcon(i, i.id === activeId)}
          eventHandlers={{ click: () => onSelect?.(i.id) }}
          zIndexOffset={i.id === activeId ? 1000 : i.severity * 10}
        />
      ))}
    </MapContainer>
  )
}

function ClickToMove({ onMove }: { onMove: (p: GeoPoint) => void }) {
  useMapEvents({ click: (e) => onMove({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

function Recenter({ point }: { point: GeoPoint }) {
  const map = useMap()
  useEffect(() => {
    map.setView([point.lat, point.lng], Math.max(map.getZoom(), 17), { animate: true })
  }, [map, point.lat, point.lng])
  return null
}

/** Draggable crosshair for confirming / correcting GPS. */
export function LocationPicker({ point, onChange }: { point: GeoPoint; onChange: (p: GeoPoint) => void }) {
  return (
    <MapContainer center={[point.lat, point.lng]} zoom={17} className="map map-picker" scrollWheelZoom>
      <TileLayer url={TILES} attribution={ATTR} />
      <Recenter point={point} />
      <ClickToMove onMove={(p) => onChange({ ...p, accuracy: undefined })} />
      {point.accuracy ? (
        <Circle
          center={[point.lat, point.lng]}
          radius={point.accuracy}
          pathOptions={{ color: '#1f8a7a', weight: 1.5, dashArray: '6 6', fillOpacity: 0.08 }}
        />
      ) : null}
      <Marker
        position={[point.lat, point.lng]}
        icon={crossIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const ll = (e.target as L.Marker).getLatLng()
            onChange({ lat: ll.lat, lng: ll.lng })
          },
        }}
      />
    </MapContainer>
  )
}

/** Small static locator used on cards and detail pages. */
export function MiniMap({ issue }: { issue: Issue }) {
  const one = useMemo(() => [issue], [issue])
  return <IssueMap issues={one} activeId={issue.id} interactive={false} className="map-mini" />
}
