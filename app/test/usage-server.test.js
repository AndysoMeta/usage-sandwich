const test = require('node:test')
const assert = require('node:assert/strict')
const { parseUsage, startUsageServer } = require('../src/usage-server')

test('only well-formed readings are taken', () => {
  assert.deepEqual(parseUsage('{"at":1,"five":{"percentUsed":20,"resetsAt":"2026-11-07T20:00:00Z"}}'), {
    at: 1,
    five: { percentUsed: 20, resetsAt: '2026-11-07T20:00:00Z' },
  })
  for (const bad of ['{}', '[]', 'null', '{"five":{"percentUsed":120}}', '{"week":{"percentUsed":"x"}}', '{"five":{"percentUsed":5,"resetsAt":"soon"}}']) {
    assert.throws(() => parseUsage(bad), bad)
  }
})

test('the mod can post usage, and web pages and junk are turned away', async () => {
  const got = []
  const server = await startUsageServer(r => got.push(r), 0)
  const url = `http://127.0.0.1:${server.address().port}/usage`
  try {
    const post = (body, headers = {}) =>
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body })
    assert.equal((await post('{"week":{"percentUsed":42}}')).status, 204)
    assert.equal((await post('{"week":{"percentUsed":42}}', { origin: 'https://evil.example' })).status, 404)
    assert.equal((await post('not json')).status, 400)
    assert.equal((await fetch(url)).status, 404)
    assert.equal(got.length, 1)
    assert.equal(got[0].week.percentUsed, 42)
  } finally {
    server.close()
  }
})
