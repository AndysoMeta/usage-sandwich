import { expect, mock, test } from 'claude-code/testing'

import { biteCount, sandwichSvg } from '../hooks/drawing'

const NOW = Date.parse('2026-11-06T06:00:00Z')

const PANE = {
  plugin: 'usage-sandwich',
  component: 'Pane',
  requestId: 'usage-sandwich',
  props: {
    title: 'Usage sandwich',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

function limits(five: number, week: number) {
  return [
    { kind: 'five_hour', percentUsed: five, resetsAt: '2026-11-06T08:14:00Z' },
    { kind: 'seven_day', percentUsed: week, resetsAt: '2026-11-09T06:00:00Z' },
  ]
}

test('more of the limit used means more bites, and none at all leaves crumbs', () => {
  expect(biteCount(0)).toBe(0)
  expect(biteCount(10)).toBe(2)
  expect(biteCount(50)).toBe(6)
  expect(biteCount(100)).toBe(12)
  expect(sandwichSvg(30).match(/<circle[^>]*fill="black"/g)?.length).toBe(4 * 3)
  expect(sandwichSvg(100)).not.toContain('mask="url(#bites)"')
})

test('the pane shows what is left, and alerts once past 75 percent', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts: string[] = []
  on('command.register', () => ({ value: { command: 'sandwich' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_, e) => (toasts.push(e.text), { value: undefined }))
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-surface' } }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200000 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({ context: { window: 200000 }, rateLimits: limits(40, 20), cost: { usd: 0.42 }, changed: ['rateLimits', 'cost'] })
  await clock.advance(30 * 60 * 1000)
  await $.session.measure({ context: { window: 200000 }, rateLimits: limits(80, 22), changed: ['rateLimits'] })
  await $.session.measure({ context: { window: 200000 }, rateLimits: limits(81, 22), changed: ['rateLimits'] })

  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('20% of the sandwich left on your session limit')

  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await desk.find({ type: 'Text', text: /of the sandwich left/ }))?.text).toBe('19% of the sandwich left (session limit)')
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  expect((await desk.find({ type: 'Text', text: /^Weekly/ }))?.text).toBe('Weekly: 78% left, resets in 2d 23h')
  expect((await desk.find({ type: 'Text', text: /session: \$/ }))?.text).toBe('This Claude Code session: $0.42')
  await desk.press({ key: 'range-week' })
  await desk.unmount()

  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await term.find({ type: 'Text', text: /% left$/ }))?.text).toContain('19% left')
  await term.unmount()
})

test('before any reading the pane says when the sandwich shows up', async ($, on) => {
  mock.clock(on, { now: NOW })
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /shows up/ }))?.text).toContain("Claude's next reply")
    await ui.unmount()
  }
})

const BAND = {
  plugin: 'usage-sandwich',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('the strip above the prompt shows a small sandwich, and the pane no longer opens by itself', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const opened: string[] = []
  on('command.register', () => ({ value: { command: 'sandwich' } }))
  on('ui.open', (_, e) => (opened.push(e.id), { value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-surface' } }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200000 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(opened.length).toBe(0)
  await $.session.measure({ context: { window: 200000 }, rateLimits: limits(38, 20), changed: ['rateLimits'] })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  expect((await desk.find({ type: 'Text', text: /sandwich left/ }))?.text).toBe('62% of the sandwich left (session), resets in 2h 14m')
  await desk.press({ key: 'open-graph' })
  expect(opened).toEqual(['usage-sandwich'])
  await desk.unmount()

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Svg' })).toBeUndefined()
  expect((await term.find({ type: 'Text', text: /sandwich left/ }))?.text).toContain('62% of the sandwich left')
  await term.unmount()
})
