import assert from 'node:assert/strict'
import { weekOn } from './week.js'

const locks = (today) => weekOn(today, 5).map((day) => day.isLocked)
const live = (today) => weekOn(today, 5).findIndex((day) => day.isLive)

assert.deepEqual(weekOn('2026-11-16', 5).map((day) => day.date), [
  '2026-12-06',
  '2026-12-07',
  '2026-12-08',
  '2026-12-09',
  '2026-12-10',
])

// before the week every day is locked
assert.deepEqual(locks('2026-11-16'), [true, true, true, true, true])
assert.equal(live('2026-11-16'), -1)

// a day opens on its own date, and the days before it stay open
assert.deepEqual(locks('2026-12-06'), [false, true, true, true, true])
assert.deepEqual(locks('2026-12-08'), [false, false, false, true, true])
assert.equal(live('2026-12-08'), 2)

// after the week nothing is locked, and no day is the live one
assert.deepEqual(locks('2027-01-02'), [false, false, false, false, false])
assert.equal(live('2027-01-02'), -1)

console.log('week ok')
