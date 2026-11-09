import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-11-07T17:00:00Z')

test('limits go to the burger on start and when they change, and a closed burger breaks nothing', async ($, on) => {
  mock.clock(on, { now: NOW })
  const sent: { url: string; body: unknown }[] = []
  let isUp = true
  on('http.fetch', (_, e) => {
    if (!isUp) throw new Error('connection refused')
    sent.push({ url: e.url, body: JSON.parse(String(e.init?.body)) })
    return { value: { status: 204, ok: true, headers: {}, text: '' } }
  })
  on('session.usage', () => ({
    value: {
      startedAt: NOW,
      context: { window: 200000 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 30, resetsAt: '2026-11-07T20:00:00Z' }],
    },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(sent.length).toBe(1)
  expect(sent[0]?.url).toBe('http://127.0.0.1:47823/usage')
  expect(sent[0]?.body).toEqual({ at: NOW, five: { percentUsed: 30, resetsAt: '2026-11-07T20:00:00Z' } })

  await $.session.measure({ context: { window: 200000 }, rateLimits: [{ kind: 'seven_day', percentUsed: 12 }], changed: ['rateLimits'] })
  expect(sent.length).toBe(2)

  await $.session.measure({ context: { window: 200000 }, rateLimits: [], cost: { usd: 1 }, changed: ['cost'] })
  expect(sent.length).toBe(2)

  isUp = false
  await $.session.measure({ context: { window: 200000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 40 }], changed: ['rateLimits'] })
  expect(sent.length).toBe(2)
})
