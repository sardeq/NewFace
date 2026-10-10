/**
 * Field sketches — ink drawings used as stand-in photos for the seeded demo city
 * (and anywhere an issue has no photo). `fixed` draws the repaired state.
 */
import { useId, type ReactNode } from 'react'

export type SketchKind = 'pothole' | 'lamp' | 'pipe' | 'slabs' | 'sign' | 'drain' | 'swing'

const INK = '#1c2b4a'
const PAPER = '#dbe6ef'
const SIGNAL = '#c2255c'
const MOSS = '#3f9a52'
const SKY = '#2f6fb0'
const OCHRE = '#f2c230'

const BY_CATEGORY: Record<string, SketchKind> = {
  roads: 'pothole',
  lighting: 'lamp',
  water: 'pipe',
  sidewalks: 'slabs',
  signage: 'sign',
  drainage: 'drain',
  parks: 'swing',
}
// eslint-disable-next-line react-refresh/only-export-components
export const sketchForCategory = (c: string): SketchKind => BY_CATEGORY[c] ?? 'pothole'

// eslint-disable-next-line react-refresh/only-export-components
export function parseSketch(ref: string): { kind: SketchKind; fixed: boolean } {
  const [, kind = 'pothole', state] = ref.split(':')
  return { kind: kind as SketchKind, fixed: state === 'fixed' }
}

export function Sketch({ kind, fixed = false, className }: { kind: SketchKind; fixed?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="0 0 400 300"
      className={className}
      role="img"
      aria-label={`${fixed ? 'Repaired' : 'Damaged'} ${kind} — field sketch`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id={`g${id}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke={INK} strokeOpacity=".07" strokeWidth="1" />
        </pattern>
        <pattern id={`h${id}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <path d="M0 0V7" stroke={INK} strokeWidth="1.3" strokeOpacity=".55" />
        </pattern>
        <pattern id={`hs${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
          <path d="M0 0V6" stroke={SIGNAL} strokeWidth="1.6" />
        </pattern>
        <pattern id={`hm${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
          <path d="M0 0V6" stroke={MOSS} strokeWidth="1.4" strokeOpacity=".8" />
        </pattern>
        <pattern id={`n${id}`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
          <path d="M0 0V9" stroke={INK} strokeWidth="2.6" strokeOpacity=".8" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill={PAPER} />
      <rect width="400" height="300" fill={`url(#g${id})`} />
      <g fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {DRAW[kind](fixed, id)}
      </g>
    </svg>
  )
}

const cone = (x: number, y: number) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M-14 0h28l-9-40h-10Z" fill={SIGNAL} />
    <path d="M-10.5 -16h21M-8 -27h16" stroke="#f1f6fa" strokeWidth="3.5" />
    <path d="M-20 0h40" strokeWidth="3" />
  </g>
)

const stitchMark = (d: string) => <path d={d} stroke={MOSS} strokeWidth="2.4" strokeDasharray="7 6" />

const DRAW: Record<SketchKind, (fixed: boolean, id: string) => ReactNode> = {
  pothole: (fixed, id) => (
    <>
      <path d="M0 300 158 92h84l158 208" fill="#c9d6e2" />
      <path d="M0 92h400" strokeOpacity=".4" />
      <path d="M200 100v18M200 134v24M200 180v32M200 236v50" stroke="#f1f6fa" strokeWidth="5" />
      <path d="M60 300 170 112M340 300 230 112" strokeOpacity=".35" strokeDasharray="3 7" />
      {fixed ? (
        <>
          <path d="M128 182l120-8 14 50-128 10Z" fill={`url(#hm${id})`} />
          {stitchMark('M128 182l120-8 14 50-128 10Z')}
          <path d="M150 196h86M146 212h96" strokeOpacity=".25" />
        </>
      ) : (
        <>
          <path d="M120 206c6-18 40-26 78-26 44 0 70 10 74 24 3 13-22 26-70 28-48 2-86-8-82-26Z" fill="#2a3954" />
          <path d="M138 206c10-10 34-14 62-14 30 0 52 6 54 14 2 8-22 15-56 15s-64-6-60-15Z" fill={SKY} fillOpacity=".55" stroke="none" />
          <path d="M118 208 92 214M270 202l30-6M168 232l-12 22M236 230l14 18M200 180l4-16" strokeWidth="1.6" />
          <path d="M92 214l-14 4M300 196l12 2" strokeWidth="1.2" />
          {cone(318, 262)}
        </>
      )}
    </>
  ),

  lamp: (fixed, id) => (
    <>
      {!fixed && <rect width="400" height="300" fill={`url(#h${id})`} opacity=".55" />}
      <path d="M0 252h400" />
      <path d="M40 252l40-30h60l40-30h60l40-30h60l40-30h20" strokeOpacity=".7" />
      <path d="M80 222v30M180 192v60M280 162v90" strokeOpacity=".25" />
      <path d="M240 252V70c0-20 14-30 34-30h18" strokeWidth="4" />
      <path d="M232 252h16" strokeWidth="5" />
      <path d="M282 40h34l-6 16h-22Z" fill={INK} />
      {fixed ? (
        <>
          <path d="M290 56h18l46 196H244Z" fill={OCHRE} fillOpacity=".4" stroke="none" />
          <path d="M289 57h20" stroke={OCHRE} strokeWidth="5" />
          <path d="M260 28l-6-10M299 22v-12M336 28l7-9M350 46h12" stroke={OCHRE} strokeWidth="2.6" />
        </>
      ) : (
        <>
          <path d="M290 58l4 8-6 4 8 6M306 58l-3 10 6 3" stroke={SIGNAL} strokeWidth="2" />
          <path d="M294 82l-3 6M304 88l4 5M298 96v4" stroke={INK} strokeWidth="1.8" />
          <circle cx="120" cy="60" r="2" fill={INK} />
          <circle cx="60" cy="110" r="1.6" fill={INK} />
          <circle cx="170" cy="30" r="1.6" fill={INK} />
          <path d="M70 40a16 16 0 1 0 14 22 13 13 0 1 1-14-22Z" fill="#f1f6fa" />
        </>
      )}
    </>
  ),

  pipe: (fixed, id) => (
    <>
      <path d="M0 140h400" />
      <path d="M0 300 60 140M100 300 130 140M200 300V140M300 300 270 140M400 300 340 140" strokeOpacity=".5" />
      <path d="M0 180h400M0 230h400" strokeOpacity=".5" />
      <path d="M0 140h400V0H0Z" fill={`url(#g${id})`} stroke="none" />
      <path d="M40 140V60h100v80M150 140V40h120v100M280 140V80h90v60" strokeOpacity=".45" />
      {fixed ? (
        <>
          <path d="M150 196h80l6 44h-92Z" fill={`url(#hm${id})`} />
          {stitchMark('M150 196h80l6 44h-92Z')}
          <rect x="250" y="246" width="34" height="22" rx="3" />
          <path d="M256 257h22" />
        </>
      ) : (
        <>
          <path d="M60 268c40-16 120-22 200-14 50 5 90 18 100 30H40c-6-6 6-12 20-16Z" fill={SKY} fillOpacity=".4" stroke={SKY} strokeWidth="1.6" />
          <path d="M150 218l26-10 14 18 22-14 20 12" strokeWidth="2.6" />
          <path d="M196 214c-10-40-30-70-62-92M200 214c2-50 10-86 24-110M204 214c18-36 44-60 80-72" stroke={SKY} strokeWidth="2.4" strokeDasharray="1 8" />
          <path d="M196 214c-8-32-24-54-48-72M204 214c14-28 34-46 62-56" stroke={SKY} strokeWidth="1.6" />
          <path d="M120 120l4 6M226 94l-2 7M290 136l6 3" stroke={SKY} strokeWidth="2.4" />
        </>
      )}
    </>
  ),

  slabs: (fixed, id) => (
    <>
      <path d="M0 120h400" strokeOpacity=".5" />
      <path d="M300 120c-4-40-2-80 6-110M330 120c4-40 4-80-2-110" strokeWidth="2.6" />
      <path d="M262 20c20-30 90-30 100 0 20 2 30 30 10 44-6 20-44 22-60 10-30 10-60-12-50-54Z" fill={MOSS} fillOpacity=".25" />
      <path d="M0 160h400M0 210h400M0 270h400" />
      <path d="M60 160 40 300M150 160l-6 140M240 160l8 140M330 160l24 140" />
      {fixed ? (
        <>
          <path d="M150 210h90v60h-96Z" fill={`url(#hm${id})`} stroke="none" />
          {stitchMark('M268 128h96')}
          <path d="M150 210h90v60h-96Z" />
        </>
      ) : (
        <>
          <path d="M150 210l92-30 6 30-96 30Z" fill="#b9c8d6" />
          <path d="M152 240l-2 30h96l-4-60" fill={`url(#n${id})`} stroke="none" />
          <path d="M242 160l92-24 18 34-104 14Z" fill="#c6d4e0" />
          <path d="M290 150c10 14 30 20 50 18M260 176c14 6 30 4 40-4" stroke={MOSS} strokeWidth="2.4" />
          <path d="M64 230l20 10 6-14 14 8" strokeWidth="1.6" />
          <path d="M120 284c6-10 12-12 20-8" stroke={SIGNAL} strokeWidth="2.6" />
          <path d="M100 290l26-8" stroke={SIGNAL} strokeWidth="2.6" />
        </>
      )}
    </>
  ),

  sign: (fixed) => {
    const oct = 'M-26 -63h52l37 37v52l-37 37h-52l-37-37v-52Z'
    return (
      <>
        <path d="M0 236h400" />
        <path d="M0 236 110 120h180l110 116" strokeOpacity=".3" />
        <path d="M150 300l40-64M250 300l-40-64" strokeOpacity=".3" strokeDasharray="10 10" />
        {fixed ? (
          <g transform="translate(200 92) scale(.9)">
            <path d="M0 160V64" strokeWidth="5" />
            <path d="M-12 160h24" strokeWidth="5" />
            <path d={oct} transform="scale(.9)" fill={SIGNAL} />
            <path d={oct} transform="scale(.76)" stroke="#f1f6fa" strokeWidth="3" />
            <text x="0" y="9" textAnchor="middle" fill="#f1f6fa" stroke="none" fontFamily="Public Sans, sans-serif" fontWeight="700" fontSize="26">STOP</text>
            {stitchMark('M-54 166h108')}
          </g>
        ) : (
          <>
            <path d="M120 236c20-8 60-22 120-60" strokeWidth="5" />
            <path d="M108 236h24" strokeWidth="5" />
            <g transform="translate(270 200) rotate(-62) scale(.62 .9)">
              <path d={oct} fill={SIGNAL} />
              <path d={oct} transform="scale(.85)" stroke="#f1f6fa" strokeWidth="3" />
            </g>
            <path d="M80 250c10-14 20-18 30-10s20 4 26-6M300 246c10-10 22-8 30 0" stroke={MOSS} strokeWidth="2.4" />
            <path d="M40 120h60M60 104l40 16-40 16" strokeOpacity=".5" />
          </>
        )}
      </>
    )
  },

  drain: (fixed, id) => (
    <>
      <path d="M0 110h400" />
      <path d="M0 110 40 150h360" strokeOpacity=".7" />
      <path d="M40 150v150" strokeOpacity=".5" />
      <rect x="130" y="170" width="160" height="80" rx="4" fill="#2a3954" />
      {fixed ? (
        <>
          <path d="M150 170v80M170 170v80M190 170v80M210 170v80M230 170v80M250 170v80M270 170v80" stroke="#b9c8d6" strokeWidth="5" />
          <rect x="130" y="170" width="160" height="80" rx="4" />
          {stitchMark('M118 160h184v100H118Z')}
        </>
      ) : (
        <>
          <path d="M150 170v80M190 170v80M230 170v80M270 170v80" stroke="#b9c8d6" strokeWidth="5" />
          <path d="M136 214c10-20 30-26 46-14 12-14 34-10 40 4 16-10 40-4 46 12 10 0 20 12 18 34H134c-6-12-4-26 2-36Z" fill="#8d9cb2" />
          <path d="M150 212l10 8M200 206l-6 10M244 214l8 6M176 236h10" strokeWidth="2.6" />
          <path d="M210 196l44-16 6 12-44 16Z" fill="#f1f6fa" />
          <path d="M254 180l10-4 4 10-8 4" fill={SIGNAL} />
          <path d="M60 262c40-14 100-12 140 0s100 18 170 4" stroke={SKY} strokeWidth="2.2" />
          <path d="M40 286c60-10 140-6 220 2s120 2 140-4" stroke={SKY} strokeWidth="1.6" strokeDasharray="2 8" />
          <rect x="128" y="168" width="164" height="84" fill={`url(#hs${id})`} stroke="none" opacity=".18" />
        </>
      )}
    </>
  ),

  swing: (fixed) => (
    <>
      <path d="M0 262h400" />
      <path d="M60 262 110 60M160 262 110 60M240 262 290 60M340 262 290 60" strokeWidth="4" />
      <path d="M100 66h200" strokeWidth="5" />
      <path d="M150 66v128M178 66v128M222 66v128M250 66v128" strokeWidth="1.8" strokeDasharray="3 3" />
      <path d="M140 194h48M212 194h48" strokeWidth="6" />
      {fixed ? (
        stitchMark('M60 274h280')
      ) : (
        <>
          <rect x="140" y="56" width="128" height="160" fill={PAPER} stroke="none" />
          <path d="M100 66h200" strokeWidth="5" />
          <path d="M150 66v128M178 66v40" strokeWidth="1.8" strokeDasharray="3 3" />
          <path d="M178 106l3 6-4 4" stroke={SIGNAL} strokeWidth="2.4" />
          <path d="M140 194l40 30" strokeWidth="6" />
          <path d="M222 66v128M250 66v128" strokeWidth="1.8" strokeDasharray="3 3" />
          <path d="M212 194h48" strokeWidth="6" />
          <path d="M226 120l4 3M246 140l-4 3M232 168l3-4" stroke="#8a5a2a" strokeWidth="3" />
          <path d="M80 250c4-8 10-8 14 0M300 250c4-8 10-8 14 0" stroke={MOSS} strokeWidth="2" />
        </>
      )}
    </>
  ),
}
