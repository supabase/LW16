import assert from 'node:assert/strict'
import { layoutWall, cardPoint, mod } from './layout.js'

for (const [width, height] of [[1280, 720], [1821, 1344], [390, 844]]) {
  const layout = layoutWall(width, height)
  const { radius, depth, middle } = layout.room
  const center = cardPoint(layout, middle, 0, .5, .5)
  assert.equal(center.x, 0)
  assert.equal(center.y, 0)
  assert.equal(center.z, -depth)
  for (const row of [-1, 0, 1]) {
    const origin = cardPoint(layout, middle, row, .5, 1)
    for (let longitude = -.9; longitude <= .9; longitude += .1) {
      const point = cardPoint(layout, middle + radius * longitude, row, .5, 1)
      assert.ok(Math.abs(point.y - origin.y) < 1e-8, 'Horizontal travel must not animate row height')
      assert.ok(point.z <= center.z + 1e-8, 'Outer cards must recede behind the center')
      const distance = Math.hypot(point.x, point.y, point.z + radius + depth)
      assert.ok(Math.abs(distance - radius) < 1e-7, 'Every vertex must lie on the same spherical surface')
    }
  }
  const left = cardPoint(layout, middle - radius * .7, 0, .5, .5)
  const right = cardPoint(layout, middle + radius * .7, 0, .5, .5)
  const top = cardPoint(layout, middle, 1, .5, .5)
  assert.ok(Math.abs(left.x + right.x) < 1e-8)
  assert.ok(Math.abs(left.z - right.z) < 1e-8)
  assert.ok(left.z < center.z && top.z < center.z, 'The dome must curve away in both axes')
  assert.equal(mod(-1, 24), 23)
}
console.log('Card globe: convex spherical surface, receding edges, fixed row heights, symmetry, and wrap verified')
