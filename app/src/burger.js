// Draws the burger. Shared by the app window and the tests, so it has no imports.
;(function (root) {
  const MAX_BITES = 12

  // Bites in eating order: top right first, down the right side, across the
  // top bun, then down the left side. `n` is the direction into the burger.
  const BITES = [
    { x: 214, y: 58, n: [-0.7, 0.7] },
    { x: 226, y: 104, n: [-1, 0] },
    { x: 226, y: 146, n: [-1, 0] },
    { x: 180, y: 30, n: [-0.3, 1] },
    { x: 220, y: 182, n: [-0.7, -0.7] },
    { x: 140, y: 18, n: [0, 1] },
    { x: 100, y: 18, n: [0, 1] },
    { x: 60, y: 30, n: [0.3, 1] },
    { x: 26, y: 58, n: [0.7, 0.7] },
    { x: 14, y: 104, n: [1, 0] },
    { x: 14, y: 146, n: [1, 0] },
    { x: 20, y: 182, n: [0.7, -0.7] },
  ]

  function biteCount(pct) {
    if (!(pct > 0)) return 0
    return Math.min(MAX_BITES, Math.ceil((pct / 100) * MAX_BITES))
  }

  function bite(b, pct) {
    const depth = Math.min(1, pct / 100)
    const r = 17 + 5 * depth
    const cx = b.x + b.n[0] * 12 * depth
    const cy = b.y + b.n[1] * 12 * depth
    // Three overlapping circles make a bite with tooth marks.
    const px = -b.n[1] * r * 0.7
    const py = b.n[0] * r * 0.7
    return [
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="black"/>`,
      `<circle cx="${(cx + px).toFixed(1)}" cy="${(cy + py).toFixed(1)}" r="${(r * 0.8).toFixed(1)}" fill="black"/>`,
      `<circle cx="${(cx - px).toFixed(1)}" cy="${(cy - py).toFixed(1)}" r="${(r * 0.8).toFixed(1)}" fill="black"/>`,
    ].join('')
  }

  const SEEDS = [[80, 34], [104, 28], [128, 27], [152, 31], [92, 48], [140, 46], [170, 44], [66, 50]]

  // `mood` is idle, listening, thinking or talking. `mouthOpen` animates talking.
  function burgerSvg(pct, mood = 'idle', mouthOpen = false) {
    if (pct >= 100) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" role="img">
  <g fill="#D9A15B"><circle cx="70" cy="170" r="6"/><circle cx="96" cy="182" r="4"/><circle cx="130" cy="176" r="7"/><circle cx="160" cy="184" r="4"/><circle cx="182" cy="168" r="5"/></g>
  <g fill="#6BB34A"><circle cx="112" cy="166" r="4"/><circle cx="150" cy="160" r="3"/></g>
</svg>`
    }
    const bites = BITES.slice(0, biteCount(pct)).map(b => bite(b, pct)).join('')
    const eyeY = mood === 'listening' ? 60 : 64
    const eyes = mood === 'thinking'
      ? `<path d="M92 64 h16 M132 64 h16" stroke="#4A2A12" stroke-width="5" stroke-linecap="round"/>`
      : `<circle cx="100" cy="${eyeY}" r="7" fill="#4A2A12"/><circle cx="140" cy="${eyeY}" r="7" fill="#4A2A12"/>
  <circle cx="102" cy="${eyeY - 2}" r="2.2" fill="#fff"/><circle cx="142" cy="${eyeY - 2}" r="2.2" fill="#fff"/>`
    const mouth = mood === 'talking' && mouthOpen
      ? `<ellipse cx="120" cy="82" rx="10" ry="7" fill="#4A2A12"/>`
      : `<path d="M108 78 q12 10 24 0" stroke="#4A2A12" stroke-width="4" fill="none" stroke-linecap="round"/>`
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" role="img">
  <defs><mask id="bites"><rect width="240" height="200" fill="white"/>${bites}</mask></defs>
  <g mask="url(#bites)">
    <rect x="22" y="156" width="196" height="32" rx="14" fill="#E9A85C" stroke="#B5743A" stroke-width="3"/>
    <rect x="18" y="132" width="204" height="28" rx="13" fill="#7A4424"/>
    <path d="M20 124 h200 l-8 14 l-10 -6 l-12 14 l-14 -10 l-16 12 l-16 -12 l-14 14 l-14 -12 l-16 10 l-14 -12 l-14 12 l-12 -10 l-10 6 z" fill="#F6C843"/>
    <rect x="24" y="112" width="192" height="14" rx="6" fill="#E0483A"/>
    <path d="M14 112 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 v6 h-220 z" fill="#6BB34A"/>
    <path d="M18 104 C18 40 60 14 120 14 C180 14 222 40 222 104 Z" fill="#E9A85C" stroke="#B5743A" stroke-width="3"/>
    <g fill="#FFF4DC">${SEEDS.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.4" transform="rotate(-20 ${x} ${y})"/>`).join('')}</g>
    ${eyes}
    ${mouth}
  </g>
</svg>`
  }

  function until(iso, now) {
    if (!iso) return ''
    const ms = Date.parse(iso) - now
    if (!(ms > 0)) return ''
    const mins = Math.round(ms / 60000)
    const d = Math.floor(mins / 1440)
    const h = Math.floor((mins % 1440) / 60)
    const m = mins % 60
    return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  /** The window closest to running out, with how much is left. */
  function summary(reading, now) {
    const all = [
      reading && reading.five && { name: 'session', w: reading.five },
      reading && reading.week && { name: 'weekly', w: reading.week },
    ].filter(Boolean)
    if (all.length === 0) return null
    all.sort((a, b) => b.w.percentUsed - a.w.percentUsed)
    const top = all[0]
    return {
      name: top.name,
      percentUsed: top.w.percentUsed,
      left: Math.max(0, Math.round(100 - top.w.percentUsed)),
      resets: until(top.w.resetsAt, now),
    }
  }

  const api = { MAX_BITES, biteCount, burgerSvg, until, summary }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.Burger = api
})(typeof window !== 'undefined' ? window : globalThis)
