import assert from 'node:assert/strict'
import { RADIUS, SHEET, normal, unroll } from './unroll.js'

const near = (a, b, slack = 1e-9) => Math.abs(a - b) < slack

for (let column = 0; column <= 12; column++) {
  for (let row = 0; row <= 6; row++) {
    const x = (column / 12 - 0.5) * SHEET.width
    const y = (row / 6 - 0.5) * SHEET.height

    // on the globe every point is one radius from the center
    assert.ok(near(Math.hypot(...unroll(x, y, 0)), RADIUS), `(${x}, ${y}) is off the globe`)
    // as a table every point is where the sheet has it
    assert.deepEqual(unroll(x, y, 1), [x, y, 0])

    // the way from one to the other has no jump, also at the last step to flat
    let before = unroll(x, y, 0)
    for (let step = 1; step <= 1000; step++) {
      const point = unroll(x, y, step / 1000)
      assert.ok(point.every(Number.isFinite))
      const moved = Math.hypot(point[0] - before[0], point[1] - before[1], point[2] - before[2])
      assert.ok(moved < 0.02, `(${x}, ${y}) jumps ${moved} at step ${step}`)
      before = point
    }
  }
}

// the middle of the sheet faces the reader, its two ends meet at the back, and flat faces all
assert.ok(near(normal(0, 0, 0)[2], 1))
assert.ok(near(normal(SHEET.width / 2, 0, 0)[2], -1))
assert.ok(near(normal(SHEET.width / 2, SHEET.height / 2, 1)[2], 1))

// on the globe the direction away from the sheet is the direction from the center
for (const [x, y] of [[0.4, 0.3], [-2.1, 1.1], [3, -0.9]]) {
  const point = unroll(x, y, 0)
  assert.ok(normal(x, y, 0).every((part, axis) => near(part, point[axis] / RADIUS)))
}

console.log('unroll ok')
