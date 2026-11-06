import type { Range, Sample } from '../types'

export const MAX_BITES = 12

// Where each bite lands, in the order the sandwich gets eaten:
// the top-right corner first, down the right side, across the top,
// then down the left side.
const BITES: { x: number; y: number; edge: 'r' | 'l' | 't' | 'tr' | 'tl' }[] = [
  { x: 220, y: 28, edge: 'tr' },
  { x: 224, y: 66, edge: 'r' },
  { x: 224, y: 102, edge: 'r' },
  { x: 222, y: 138, edge: 'r' },
  { x: 178, y: 22, edge: 't' },
  { x: 136, y: 21, edge: 't' },
  { x: 94, y: 21, edge: 't' },
  { x: 54, y: 22, edge: 't' },
  { x: 20, y: 28, edge: 'tl' },
  { x: 16, y: 66, edge: 'l' },
  { x: 16, y: 102, edge: 'l' },
  { x: 18, y: 138, edge: 'l' },
]

/** How many bites show for a window that is `percentUsed` used. */
export function biteCount(percentUsed: number): number {
  if (!(percentUsed > 0)) return 0
  return Math.min(MAX_BITES, Math.ceil((percentUsed / 100) * MAX_BITES))
}

// One bite is three overlapping circles along the edge, which leaves the
// scalloped tooth line of a real bite. Bites get bigger and deeper as the
// limit runs down, so the last few leave only a small piece.
const NORMAL: Record<'r' | 'l' | 't' | 'tr' | 'tl', [number, number]> = {
  r: [-1, 0],
  l: [1, 0],
  t: [0, 1],
  tr: [-0.7, 0.7],
  tl: [0.7, 0.7],
}

function bite(b: (typeof BITES)[number], percentUsed: number): string {
  const depth = Math.min(1, Math.max(0, percentUsed / 100))
  const r = 17 + 5 * depth
  const [nx, ny] = NORMAL[b.edge]
  const cx = b.x + nx * 12 * depth
  const cy = b.y + ny * 12 * depth
  const offsets: Record<typeof b.edge, [number, number][]> = {
    r: [[0, -14], [-7, 0], [0, 14]],
    l: [[0, -14], [7, 0], [0, 14]],
    t: [[-14, 0], [0, 7], [14, 0]],
    tr: [[-13, -4], [-5, 5], [4, 13]],
    tl: [[13, -4], [5, 5], [-4, 13]],
  }
  return offsets[b.edge]
    .map(([dx, dy]) => `<circle cx="${(cx + dx).toFixed(1)}" cy="${(cy + dy).toFixed(1)}" r="${r.toFixed(1)}" fill="black"/>`)
    .join('')
}

/** The sandwich, bitten for a window that is `percentUsed` used. */
export function sandwichSvg(percentUsed: number): string {
  const n = biteCount(percentUsed)
  const isGone = percentUsed >= 100
  const bites = BITES.slice(0, n).map(b => bite(b, percentUsed)).join('')

  const sandwich = `
    <g mask="url(#bites)">
      <rect x="18" y="114" width="204" height="36" rx="8" fill="#F1D3A1" stroke="#B5743A" stroke-width="4"/>
      <path d="M16 100 Q40 94 64 100 Q88 106 112 100 Q136 94 160 100 Q184 106 208 100 Q226 96 224 108 Q222 118 208 116 L32 116 Q16 118 16 108 Z" fill="#E58F8B"/>
      <rect x="22" y="90" width="196" height="12" fill="#F6C843"/>
      <rect x="26" y="78" width="188" height="14" rx="7" fill="#E0483A"/>
      <circle cx="70" cy="85" r="2" fill="#F7D36B"/><circle cx="120" cy="85" r="2" fill="#F7D36B"/><circle cx="170" cy="85" r="2" fill="#F7D36B"/>
      <path d="M12 64 H228 V72 Q220 84 210 76 Q200 86 190 76 Q180 86 170 76 Q160 86 150 76 Q140 86 130 76 Q120 86 110 76 Q100 86 90 76 Q80 86 70 76 Q60 86 50 76 Q40 86 30 76 Q20 84 12 72 Z" fill="#6BB34A"/>
      <rect x="18" y="22" width="204" height="46" rx="10" fill="#F1D3A1" stroke="#B5743A" stroke-width="4"/>
    </g>`

  const crumbs = [
    [70, 150, 5], [92, 156, 3], [118, 152, 6], [140, 158, 3], [160, 150, 4], [182, 156, 3], [104, 160, 2],
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#E2B678" stroke="#B5743A" stroke-width="1.5"/>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 170" width="240" height="170">
  <defs>
    <mask id="bites" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="170">
      <rect x="0" y="0" width="240" height="170" fill="white"/>
      ${bites}
    </mask>
  </defs>
  ${isGone ? crumbs : sandwich}
</svg>`
}

export const SPAN: Record<Range, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
}

export const SESSION_COLOR = '#E07A2E'
export const WEEKLY_COLOR = '#3B82C4'

/** A step line of percent used over the range, ending at `now`. */
export function graphSvg(samples: Sample[], range: Range, now: number): string {
  const W = 300
  const H = 110
  const top = 6
  const span = SPAN[range]
  const start = now - span
  const x = (t: number) => ((Math.max(t, start) - start) / span) * W
  const y = (pct: number) => top + (1 - Math.min(100, Math.max(0, pct)) / 100) * (H - top)

  function line(pick: (s: Sample) => number | undefined, color: string): string {
    // Keep the last sample before the range so the line starts at its left edge.
    const before = samples.filter(s => s.t < start && pick(s) !== undefined).slice(-1)
    const points = [...before, ...samples.filter(s => s.t >= start && pick(s) !== undefined)]
    if (points.length === 0) return ''
    let d = ''
    points.forEach((s, i) => {
      const px = x(s.t).toFixed(1)
      const py = y(pick(s) as number).toFixed(1)
      d += i === 0 ? `M${px} ${py}` : ` H${px} V${py}`
    })
    d += ` H${W}`
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`
  }

  const grid = [0, 50, 100]
    .map(p => `<line x1="0" x2="${W}" y1="${y(p)}" y2="${y(p)}" stroke="#8a8a8a" stroke-opacity="0.35" stroke-dasharray="${p === 0 ? '' : '3 4'}"/>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + 2}" width="${W}" height="${H + 2}">
  ${grid}
  ${line(s => s.week, WEEKLY_COLOR)}
  ${line(s => s.five, SESSION_COLOR)}
</svg>`
}

/** "2h 14m", "3d 4h", "under a minute" until `iso`. */
export function until(iso: string | undefined, now: number): string | undefined {
  if (!iso) return undefined
  const ms = Date.parse(iso) - now
  if (!Number.isFinite(ms)) return undefined
  if (ms <= 60_000) return 'under a minute'
  const m = Math.floor(ms / 60_000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const mm = m % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${mm}m`
  return `${mm}m`
}

/** A text bar for the terminal, which draws no SVG. */
export function textBar(percentUsed: number, width = 12): string {
  const left = Math.max(0, Math.min(width, Math.round(((100 - percentUsed) / 100) * width)))
  return '█'.repeat(left) + '░'.repeat(width - left)
}
