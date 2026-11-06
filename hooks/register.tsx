import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionCost, SessionRateLimit } from 'claude-code'

import type { Range, Reading, Sample, Window } from '../types'
import {
  SESSION_COLOR,
  WEEKLY_COLOR,
  biteCount,
  graphSvg,
  sandwichSvg,
  textBar,
  until,
} from './drawing'

const PANE = 'usage-sandwich'
const TITLE = 'Usage sandwich'
const KEEP_MS = 8 * 24 * 60 * 60 * 1000
const MAX_SAMPLES = 3000
const QUIET_MS = 10 * 60 * 1000
const ALERT_LEVELS = [75, 90, 100]

const reading = atom({ plugin: 'usage-sandwich', key: 'reading' } as const, null as Reading | null, {
  shape: 'reading-1',
})
const history = atom({ plugin: 'usage-sandwich', key: 'history' } as const, [] as Sample[], {
  shape: 'history-1',
})
const range = atom({ plugin: 'usage-sandwich', key: 'range' } as const, 'day' as Range)

function windowOf(limits: SessionRateLimit[], kind: string): Window | undefined {
  const w = limits.find(l => l.kind === kind)
  return w ? { percentUsed: w.percentUsed, resetsAt: w.resetsAt } : undefined
}

/** The window closest to running out: the one that will stop you first. */
export function worst(r: Reading | null): { name: string; w: Window } | undefined {
  const all = [
    r?.five && { name: 'session', w: r.five },
    r?.week && { name: 'weekly', w: r.week },
  ].filter(Boolean) as { name: string; w: Window }[]
  return all.sort((a, b) => b.w.percentUsed - a.w.percentUsed)[0]
}

function statusText(r: Reading | null, now: number): string | undefined {
  const top = worst(r)
  if (!top) return undefined
  const left = Math.max(0, 100 - top.w.percentUsed)
  const resets = until(top.w.resetsAt, now)
  return `Sandwich ${Math.round(left)}% left (${top.name})${resets ? `, resets in ${resets}` : ''}`
}

async function alertIfNeeded($: EngineInterface, r: Reading) {
  const top = worst(r)
  if (!top) return
  const level = [...ALERT_LEVELS].reverse().find(l => top.w.percentUsed >= l)
  if (!level) return
  const key = `${top.name}:${top.w.resetsAt ?? 'none'}`
  const sent = ((await $.store.get('alerts')) ?? {}) as Record<string, number>
  if ((sent[key] ?? 0) >= level) return
  const keys = Object.keys(sent).slice(-20)
  const kept: Record<string, number> = {}
  for (const k of keys) kept[k] = sent[k] ?? 0
  kept[key] = level
  await $.store.set('alerts', kept)
  const resets = until(top.w.resetsAt, await $.clock.now())
  const text =
    level >= 100
      ? `The sandwich is gone: your ${top.name} limit is used up${resets ? `, back in ${resets}` : ''}.`
      : `Only ${Math.round(100 - top.w.percentUsed)}% of the sandwich left on your ${top.name} limit${resets ? `, resets in ${resets}` : ''}.`
  $.ui.toast(text, { timeoutMs: 8000 })
  void $.ui.notify(text, { title: TITLE })
}

async function record($: EngineInterface, limits: SessionRateLimit[], cost: SessionCost | undefined) {
  const now = await $.clock.now()
  const before = await read($, reading)
  const r: Reading = {
    at: now,
    five: windowOf(limits, 'five_hour') ?? before?.five,
    week: windowOf(limits, 'seven_day') ?? before?.week,
    costUsd: cost?.usd ?? before?.costUsd,
  }
  if (!r.five && !r.week && r.costUsd === undefined) return
  await update($, reading, () => r)

  if (limits.length > 0 && (r.five || r.week)) {
    const sample: Sample = { t: now, five: r.five?.percentUsed, week: r.week?.percentUsed }
    const next = await update($, history, list => {
      const last = list[list.length - 1]
      const same = last && last.five === sample.five && last.week === sample.week
      if (same && now - last.t < QUIET_MS) return list
      return [...list.filter(s => now - s.t < KEEP_MS), sample].slice(-MAX_SAMPLES)
    })
    await $.store.set('history', next)
    await alertIfNeeded($, r)
  }
  $.ui.status(statusText(r, now))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await $.command.register({
      name: 'sandwich',
      description: 'Show your Claude usage as a sandwich, with a usage graph',
    })
    const stored = await $.store.get('history')
    if (Array.isArray(stored)) {
      const now = await $.clock.now()
      const kept = (stored as Sample[]).filter(s => typeof s?.t === 'number' && now - s.t < KEEP_MS)
      await update($, history, () => kept.slice(-MAX_SAMPLES))
    }
    const usage = await $.session.usage()
    await record($, usage.rateLimits, usage.cost)
    void $.ui.open({ id: PANE, title: TITLE })

    return ran
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') || e.changed.includes('cost')) {
      await record($, e.rateLimits, e.cost)
    }

    return next(e)
  })

  on('command.run', { command: 'sandwich' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Usage sandwich opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const r = await read($, reading)
    const samples = await read($, history)
    const span = await read($, range)
    const now = await $.clock.now()
    const top = worst(r)

    if (!top) {
      return (
        <Box flexDirection="column">
          <Text>The sandwich shows up after Claude's next reply in a Claude Code session.</Text>
          <Text dimColor>It only appears on a Pro or Max plan, where Claude reports your usage limits.</Text>
        </Box>
      )
    }

    const left = Math.max(0, Math.round(100 - top.w.percentUsed))
    const bites = biteCount(top.w.percentUsed)
    const line = (name: string, w: Window | undefined) => {
      if (!w) return null
      const resets = until(w.resetsAt, now)
      return (
        <Text>
          {name}: {Math.round(100 - w.percentUsed)}% left{resets ? `, resets in ${resets}` : ''}
        </Text>
      )
    }
    const alt =
      top.w.percentUsed >= 100
        ? `Only crumbs left: your ${top.name} limit is used up.`
        : `A sandwich with ${bites} of 12 bites taken: ${left}% of your ${top.name} limit left.`

    const rangeButtons = (
      <Box flexDirection="row" gap={1}>
        <Button key="range-day" variant={span === 'day' ? 'primary' : 'secondary'} onPress={() => update($, range, () => 'day')}>
          Day
        </Button>
        <Button key="range-week" variant={span === 'week' ? 'primary' : 'secondary'} onPress={() => update($, range, () => 'week')}>
          Week
        </Button>
      </Box>
    )

    const cost = r?.costUsd !== undefined ? <Text dimColor>This Claude Code session: ${r.costUsd.toFixed(2)}</Text> : null
    const footnote = (
      <Text dimColor>Chats, projects, Claude Code and Claude Duet all eat from this same sandwich.</Text>
    )

    const Svg = e.surface !== 'terminal' && 'Svg' in els ? els.Svg : undefined
    if (!Svg) {
      return (
        <Box flexDirection="column">
          <Text bold>
            {textBar(top.w.percentUsed)} {left}% left
          </Text>
          {line('Session (5 hours)', r?.five)}
          {line('Weekly', r?.week)}
          {cost}
          {footnote}
        </Box>
      )
    }

    const enough = samples.length >= 2
    return (
      <Box flexDirection="column" gap={1}>
        <Svg source={sandwichSvg(top.w.percentUsed)} alt={alt} width={240} height={170} />
        <Box flexDirection="column">
          <Text bold>
            {left}% of the sandwich left ({top.name} limit)
          </Text>
          {line('Session (5 hours)', r?.five)}
          {line('Weekly', r?.week)}
          {cost}
        </Box>
        {rangeButtons}
        {enough ? (
          <Svg
            source={graphSvg(samples, span, now)}
            alt={`Percent of your limits used over the last ${span}: session in orange, weekly in blue.`}
            width={300}
            height={112}
          />
        ) : (
          <Text dimColor>The graph fills in as you keep using Claude.</Text>
        )}
        {enough ? (
          <Box flexDirection="row" gap={2}>
            <Text color={SESSION_COLOR}>━ Session used</Text>
            <Text color={WEEKLY_COLOR}>━ Weekly used</Text>
          </Box>
        ) : null}
        {footnote}
      </Box>
    )
  })
}
