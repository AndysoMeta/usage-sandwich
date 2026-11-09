const test = require('node:test')
const assert = require('node:assert/strict')
const { parseClaudeOutput } = require('../src/agent')
const { encoded, LISTEN_PS } = require('../src/voice')

test("Claude Code's answer and conversation are read from its JSON output", () => {
  const out = 'some log line\n{"type":"result","result":" It is sunny. ","session_id":"abc-123","is_error":false}\n'
  assert.deepEqual(parseClaudeOutput(out), { text: 'It is sunny.', sessionId: 'abc-123', isError: false })
  assert.throws(() => parseClaudeOutput('nothing here'))
})

test('the listening script is handed to PowerShell in the encoding it expects', () => {
  assert.equal(Buffer.from(encoded(LISTEN_PS), 'base64').toString('utf16le'), LISTEN_PS)
})

const path = require('node:path')
const http = require('node:http')
const { ask } = require('../src/agent')

test('what you say reaches Claude Code on stdin, and the conversation carries on', { skip: process.platform === 'win32' }, async () => {
  // A runnable stand-in, made fresh because shared folders can drop the run bit.
  const fs = require('node:fs')
  const os = require('node:os')
  const bin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'burger-')), 'claude')
  fs.writeFileSync(bin, `#!/bin/sh\nexec "${process.execPath}" "${path.join(__dirname, 'fixtures', 'fake-claude.js')}" "$@"\n`, { mode: 0o755 })
  const settings = { agent: 'claude-code', claudeCommand: bin, agentFolder: __dirname }
  const first = await ask('what is left; rm -rf ~', settings)
  assert.equal(first.text, 'heard: what is left; rm -rf ~')
  assert.equal(first.sessionId, 'new-1')
  const second = await ask('and now?', settings, first.sessionId)
  assert.equal(second.sessionId, 'new-1')
})

test('any other agent can be reached at a web address', async () => {
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', d => (body += d))
    req.on('end', () => {
      const j = JSON.parse(body)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ reply: `Hermes heard ${j.text}`, conversation: j.conversation || 'c1' }))
    })
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  try {
    const settings = { agent: 'http', agentUrl: `http://127.0.0.1:${server.address().port}/talk` }
    const r = await ask('start the show', settings)
    assert.deepEqual(r, { text: 'Hermes heard start the show', sessionId: 'c1', isError: false })
    await assert.rejects(ask('hi', { agent: 'http', agentUrl: '' }))
  } finally {
    server.close()
  }
})
