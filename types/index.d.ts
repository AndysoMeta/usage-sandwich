export type Window = { percentUsed: number; resetsAt?: string }

export type Reading = {
  at: number
  five?: Window
  week?: Window
  costUsd?: number
}

export type Sample = { t: number; five?: number; week?: number }

export type Range = 'day' | 'week'

declare module 'claude-code' {
  interface PluginState {
    'usage-sandwich': {
      reading: Shaped<Reading | null>
      history: Shaped<Sample[]>
      range: Range
    }
  }
}
