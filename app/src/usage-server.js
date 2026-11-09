// A tiny server on this computer only. The burger mod in Claude Code posts
// your plan usage here after each reply.
const http = require('node:http')

const PORT = 47823
const MAX_BODY = 4096

function windowOf(w) {
  if (w === undefined || w === null) return undefined
  if (typeof w !== 'object') throw new Error('bad window')
  const pct = w.percentUsed
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) throw new Error('bad percent')
  const out = { percentUsed: pct }
  if (w.resetsAt !== undefined) {
    if (typeof w.resetsAt !== 'string' || w.resetsAt.length > 40 || Number.isNaN(Date.parse(w.resetsAt))) throw new Error('bad reset time')
    out.resetsAt = w.resetsAt
  }
  return out
}

/** Checks a posted reading. Throws on anything that isn't one. */
function parseUsage(text) {
  const raw = JSON.parse(text)
  if (!raw || typeof raw !== 'object') throw new Error('not an object')
  const five = windowOf(raw.five)
  const week = windowOf(raw.week)
  if (!five && !week) throw new Error('no limits')
  const at = typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : Date.now()
  return { at, ...(five && { five }), ...(week && { week }) }
}

/** Starts the server. `onUsage` gets each good reading. Resolves with the server. */
function startUsageServer(onUsage, port = PORT) {
  const server = http.createServer((req, res) => {
    // Web pages send an Origin header; the mod doesn't. Turning those away
    // means no website you visit can feed the burger fake numbers.
    if (req.headers.origin || req.method !== 'POST' || req.url !== '/usage') {
      res.writeHead(404).end()
      return
    }
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
      res.writeHead(415).end()
      return
    }
    let body = ''
    let tooBig = false
    req.setEncoding('utf8')
    req.on('data', chunk => {
      body += chunk
      if (body.length > MAX_BODY) {
        tooBig = true
        req.destroy()
      }
    })
    req.on('end', () => {
      if (tooBig) return
      try {
        onUsage(parseUsage(body))
        res.writeHead(204).end()
      } catch {
        res.writeHead(400).end()
      }
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

module.exports = { PORT, parseUsage, startUsageServer }
