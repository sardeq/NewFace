import type { SVGProps } from 'react'

/** Hand-tuned 24px stroke icons (no icon library — keeps the notebook look consistent). */
const P: Record<string, string> = {
  feed: 'M4 5.5h16M4 12h16M4 18.5h10',
  map: 'M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14',
  plus: 'M12 5v14M5 12h14',
  stories: 'M5 7.5 9.5 12 5 16.5M10.5 7.5 15 12l-4.5 4.5M16 7.5l3 4.5-3 4.5',
  bell: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14l1.5-2ZM10 20.5a2.2 2.2 0 0 0 4 0',
  user: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5',
  shield: 'M12 3.5 5 6v5.5c0 4.4 3 7.7 7 9 4-1.3 7-4.6 7-9V6l-7-2.5Zm-3 8.8 2.2 2.2 4.3-4.6',
  hardhat: 'M3.5 17.5h17M5 17.5v-3a7 7 0 0 1 14 0v3M10 8V5.5h4V8M8.5 9.3 9.5 14M15.5 9.3 14.5 14',
  up: 'M12 5 5 13h4.5v6h5v-6H19l-7-8Z',
  down: 'M12 19 5 11h4.5V5h5v6H19l-7 8Z',
  comment: 'M5 5.5h14v10H11l-4.5 3.5v-3.5H5v-10Z',
  share: 'M12 4v11M7.5 8.5 12 4l4.5 4.5M5 13v6.5h14V13',
  coin: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM14.5 9.2c-.4-.9-1.4-1.4-2.5-1.4-1.5 0-2.6.8-2.6 2s1.1 1.6 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.2 0-2.2-.5-2.6-1.4M12 6.3v1.5m0 8.4v1.5',
  camera: 'M4 8h3.5L9 5.5h6L16.5 8H20v11H4V8Zm8 8.5a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z',
  image: 'M4 5h16v14H4V5Zm0 10.5 4.5-4.5 4 4 2.5-2.5L20 17.5M15.5 9.5h.01',
  pin: 'M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  locate: 'M12 18.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm0-16v3m0 13v3M2.5 12h3m13 0h3M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  right: 'm9.5 5.5 6.5 6.5-6.5 6.5',
  left: 'M14.5 5.5 8 12l6.5 6.5',
  arrowRight: 'M4.5 12h15m-5.5-6 6 6-6 6',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  send: 'M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z',
  copy: 'M8.5 8.5h11v11h-11v-11ZM15.5 8.5v-4h-11v11h4',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.5V12l3 2',
  scan: 'M4 8.5v-4h4M16 4.5h4v4M20 15.5v4h-4M8 19.5H4v-4M7.5 12h9M9.5 9h5M9.5 15h5',
  wrench: 'M14.8 5.2a4.5 4.5 0 0 0-5.6 5.6L4 16l4 4 5.2-5.2a4.5 4.5 0 0 0 5.6-5.6l-2.7 2.7-2.8-.8-.8-2.8 2.7-2.7-.4-.4Z',
  logout: 'M14 4.5H5.5v15H14M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5',
  upload: 'M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 15v4.5h15V15',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
  external: 'M13.5 4.5h6v6M19.5 4.5 11 13M10 6H4.5v13.5H18V14',
  flag: 'M5.5 20.5v-16m0 1h11l-2 4 2 4h-11',
  alert: 'M12 4 2.8 19.5h18.4L12 4Zm0 6v4.5m0 2.6v.1',
  info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 11v5.5M12 7.8v.1',
  receipt: 'M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4v-17Zm3 5h6m-6 3.5h6m-6 3.5h3.5',
  layers: 'M12 4 3 8.5l9 4.5 9-4.5L12 4Zm-9 8 9 4.5 9-4.5M3 15.5 12 20l9-4.5',
  stitch: 'M3 16 8 8l4 8 4-8 5 8M6.5 10.5l3 1.5M14.5 12l3-1.5M10.5 14.5l3 0',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
  hammer: 'm14 6.5 3.5 3.5M5 19l8.2-8.2M12 4.5l2-1 6.5 6.5-1 2-2.5-.5-3.5-3.5-1.5-3.5Z',
  filter: 'M4 5.5h16l-6 7.5v5.5l-4 2V13L4 5.5Z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  trash: 'M5 7h14M10 4.5h4M7 7l1 12.5h8L17 7',
}

export type IconName = keyof typeof P

export function Icon({
  name,
  size = 18,
  stroke = 1.75,
  ...rest
}: { name: IconName; size?: number; stroke?: number } & Omit<SVGProps<SVGSVGElement>, 'name' | 'stroke'>) {
  const filled = name === 'up' || name === 'down'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={P[name]} fill={filled ? 'var(--icon-fill, none)' : 'none'} />
    </svg>
  )
}

/** The Mend mark: a crack, stitched shut. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="4" fill="var(--ink)" />
      <path d="M6 9.5 12 15l-3 3 7 5 3-4 7 3.5" fill="none" stroke="var(--paper-hi)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <g stroke="var(--signal)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M8.5 15.5 11 11" />
        <path d="M11.5 21.5 14.5 17.5" />
        <path d="M18.5 23 21 19" />
      </g>
    </svg>
  )
}
