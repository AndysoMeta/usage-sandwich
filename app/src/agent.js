// Passes what you said to your AI agent and returns its answer.
const { spawn, execFile } = require('node:child_process')

const SPOKEN =
  'The person is talking to you by voice through a floating burger on their screen, and your answer is read aloud. ' +
  'Answer in one to three short spoken sentences, with no markdown, lists or code unless they ask for it.'
const TIMEOUT_MS = 3 * 60 * 1000

/** Reads `claude -p --output-format json` output. */
function parseClaudeOutput(stdout) {
  const lines = String(stdout).trim().split(/\r?\n/).reverse()
  for (const line of lines) {
    try {
      const j = JSON.parse(line)
      if (j && typeof j === 'object' && 'result' in j) {
        return { text: String(j.result ?? '').trim(), sessionId: typeof j.session_id === 'string' ? j.session_id : undefined, isError: j.is_error === true }
      }
    } catch {}
  }
  throw new Error('Claude Code gave no answer')
}

/** Finds the Claude Code command on this computer. */
function findClaude(command) {
  if (command && command !== 'claude') return Promise.resolve(command)
  if (process.platform !== 'win32') return Promise.resolve('claude')
  return new Promise(resolve => {
    execFile('where', ['claude'], (err, out) => {
      const found = String(out || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      resolve(found.find(p => p.toLowerCase().endsWith('.exe')) || found[0] || 'claude')
    })
  })
}

/**
 * Asks Claude Code on this computer, carrying on the same conversation when
 * there is one. What you said goes in on stdin, never on a command line.
 */
async function askClaudeCode(text, settings, sessionId) {
  const command = await findClaude(settings.claudeCommand)
  const args = ['-p', '--output-format', 'json', '--append-system-prompt', SPOKEN]
  if (sessionId) args.push('--resume', sessionId)
  // A .cmd shim only starts through the shell; the arguments above are fixed text.
  const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: settings.agentFolder || undefined, shell, windowsHide: true })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Claude Code took too long to answer'))
    }, TIMEOUT_MS)
    child.stdout.on('data', d => (out += d))
    child.stderr.on('data', d => (err += d))
    child.on('error', e => {
      clearTimeout(timer)
      reject(new Error(`Couldn't start Claude Code (${e.message})`))
    })
    child.on('close', () => {
      clearTimeout(timer)
      try {
        resolve(parseClaudeOutput(out))
      } catch (e) {
        reject(new Error(err.trim().split(/\r?\n/).pop() || e.message))
      }
    })
    child.stdin.end(text)
  })
}

/**
 * Any other agent with a web address on this computer or your network
 * (Hermes, a bot, your own server): POSTs { text, conversation } and reads
 * back { reply, conversation }.
 */
async function askHttpAgent(text, settings, conversation) {
  const res = await fetch(settings.agentUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, conversation }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Your agent answered ${res.status}`)
  const j = await res.json()
  return { text: String(j.reply ?? '').trim(), sessionId: j.conversation, isError: false }
}

function ask(text, settings, sessionId) {
  if (settings.agent === 'http') {
    if (!settings.agentUrl) return Promise.reject(new Error('Set agentUrl in the settings file first'))
    return askHttpAgent(text, settings, sessionId)
  }
  return askClaudeCode(text, settings, sessionId)
}

module.exports = { SPOKEN, ask, parseClaudeOutput }
