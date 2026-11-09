#!/usr/bin/env node
// Stands in for `claude -p` in the tests: echoes what it was told on stdin.
let input = ''
process.stdin.on('data', d => (input += d))
process.stdin.on('end', () => {
  const args = process.argv.slice(2)
  const resumed = args.includes('--resume') ? args[args.indexOf('--resume') + 1] : null
  console.log(JSON.stringify({ type: 'result', result: `heard: ${input}`, session_id: resumed || 'new-1', is_error: false, args }))
})
