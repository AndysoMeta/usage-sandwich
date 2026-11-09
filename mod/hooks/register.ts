import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

/** Where the burger app listens. Only this computer can reach it. */
export const BURGER_URL = 'http://127.0.0.1:47823/usage'

type Window = { percentUsed: number; resetsAt?: string }

function windowOf(limits: readonly SessionRateLimit[], kind: string): Window | undefined {
  const w = limits.find(l => l.kind === kind)
  return w ? { percentUsed: w.percentUsed, resetsAt: w.resetsAt } : undefined
}

/** Hands the latest limits to the burger. If the burger isn't running, nothing happens. */
async function feed($: EngineInterface, limits: readonly SessionRateLimit[]) {
  const five = windowOf(limits, 'five_hour')
  const week = windowOf(limits, 'seven_day')
  if (!five && !week) return
  const body = JSON.stringify({ at: await $.clock.now(), five, week })
  try {
    await $.http.fetch(BURGER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
  } catch {
    // The burger app is closed. The next reply tries again.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    const usage = await $.session.usage()
    await feed($, usage.rateLimits)
    return ran
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await feed($, e.rateLimits)
    return next(e)
  })
}
