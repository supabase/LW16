import assert from 'node:assert/strict'
import { GROUPS, STATES, next } from './flow.js'

const walk = (state, events) => events.reduce(next, state)

assert.equal(walk('idle', ['CLAIM', 'SUBMIT', 'DONE']), 'ready')
assert.equal(walk('ready', ['STAMP', 'DONE', 'STAMP', 'DONE']), 'ready')
assert.equal(walk('ready', ['MIRROR', 'GRANTED', 'STOP']), 'ready')
assert.equal(walk('ready', ['MIRROR', 'DENIED', 'RETRY', 'GRANTED']), 'mirror-live')

// an event a state does not list must not move it
assert.equal(next('idle', 'DONE'), 'idle')
assert.equal(next('engrave', 'CANCEL'), 'engrave')
assert.equal(next('missing', 'CLAIM'), 'missing')

// every transition must end in a state the switcher lists
const listed = GROUPS.flatMap((group) => group.states)
assert.deepEqual([...listed].sort(), Object.keys(STATES).sort())
for (const { on } of Object.values(STATES)) {
  for (const target of Object.values(on)) assert.ok(STATES[target], `unknown target ${target}`)
}

console.log('flow ok')
