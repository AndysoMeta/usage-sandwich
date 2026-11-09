const test = require('node:test')
const assert = require('node:assert/strict')
const { biteCount, burgerSvg, summary, until } = require('../src/burger')

const NOW = Date.parse('2026-11-07T17:00:00Z')

test('more of the limit used means more bites, and a used-up limit leaves crumbs', () => {
  assert.equal(biteCount(0), 0)
  assert.equal(biteCount(10), 2)
  assert.equal(biteCount(50), 6)
  assert.equal(biteCount(100), 12)
  assert.equal(burgerSvg(30).match(/<circle[^>]*fill="black"/g).length, 4 * 3)
  assert.ok(!burgerSvg(100).includes('mask='))
})

test('the face changes with what the burger is doing', () => {
  assert.ok(burgerSvg(10, 'talking', true).includes('<ellipse cx="120" cy="82"'))
  assert.ok(burgerSvg(10, 'thinking').includes('h16'))
  assert.ok(!burgerSvg(10, 'idle').includes('h16'))
})

test('the label follows whichever limit is closest to running out', () => {
  const s = summary({ five: { percentUsed: 38, resetsAt: '2026-11-07T19:14:00Z' }, week: { percentUsed: 60 } }, NOW)
  assert.deepEqual(s, { name: 'weekly', percentUsed: 60, left: 40, resets: '' })
  assert.equal(summary(null, NOW), null)
  assert.equal(until('2026-11-07T19:14:00Z', NOW), '2h 14m')
  assert.equal(until('2026-11-10T21:00:00Z', NOW), '3d 4h')
})
