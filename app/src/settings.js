const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const DEFAULTS = {
  // "claude-code" runs Claude Code on this computer. "http" posts to agentUrl.
  agent: 'claude-code',
  // The folder Claude Code works in when you talk to it.
  agentFolder: os.homedir(),
  // Leave as "claude" to find it automatically.
  claudeCommand: 'claude',
  agentUrl: '',
  hotkey: 'Control+Alt+Space',
  speakReplies: true,
  position: null,
}

function load(dir) {
  const file = path.join(dir, 'settings.json')
  let saved = {}
  try {
    saved = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {}
  const settings = { ...DEFAULTS, ...saved }
  if (!fs.existsSync(file)) save(dir, settings)
  return settings
}

function save(dir, settings) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(settings, null, 2))
}

module.exports = { DEFAULTS, load, save }
