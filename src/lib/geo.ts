import type { GeoPoint } from '../types'

export type GeoState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'ok'; point: GeoPoint }
  | { kind: 'error'; message: string }

export function getPosition(timeout = 12000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This device has no GPS / geolocation support.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: Math.round(p.coords.accuracy),
        }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Drag the pin to the right spot instead.'
            : err.code === err.TIMEOUT
              ? 'GPS timed out. Move near a window or drag the pin.'
              : 'Could not read your location.'
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    )
  })
}

export interface Place {
  address: string
  district: string
}

/** Reverse-geocode with OpenStreetMap Nominatim (free; swap for a paid geocoder in production). */
export async function reverseGeocode(p: GeoPoint, signal?: AbortSignal): Promise<Place> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}&zoom=18&addressdetails=1`
    const res = await fetch(url, { signal, headers: { 'Accept-Language': 'en' } })
    if (!res.ok) throw new Error(String(res.status))
    const j = (await res.json()) as {
      display_name?: string
      address?: Record<string, string>
    }
    const a = j.address ?? {}
    const street = [a.house_number, a.road ?? a.pedestrian ?? a.footway].filter(Boolean).join(' ')
    const district = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? a.city ?? 'Unknown district'
    return {
      address: street || j.display_name?.split(',').slice(0, 2).join(',') || 'Unnamed street',
      district,
    }
  } catch {
    return { address: 'Address unavailable', district: 'Unknown district' }
  }
}
