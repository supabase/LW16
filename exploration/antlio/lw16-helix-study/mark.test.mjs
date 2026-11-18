import assert from 'node:assert/strict'
import { FIN_COUNT, OUTER_RADIUS, TWIST, finPoint, markRadius } from './mark.js'

let smallest = Infinity
let largest = 0
for (let i = 0; i < 720; i++) {
  const radius = markRadius(i / 720 * Math.PI * 2)
  assert.ok(Number.isFinite(radius) && radius > 0, 'Every radial fin must meet the mark contour')
  smallest = Math.min(smallest, radius)
  largest = Math.max(largest, radius)
}
assert.ok(largest - smallest > 1, 'The center must trace the logo rather than remain circular')
for (let index = 0; index < FIN_COUNT; index++) for (const level of [0,.25,.5,.75,1]) for (const side of [-1,1]) {
  const a = finPoint(index,level,true,side,0)
  const b = finPoint(index,level,true,side,1)
  assert.deepEqual(a,b,'The outer helix must remain unchanged')
  assert.ok(Math.abs(Math.hypot(a[0],a[2])-OUTER_RADIUS)<1e-10)
  const inner = finPoint(index,level,false,side,1)
  const angle = index / FIN_COUNT * Math.PI * 2 + TWIST / 2
  assert.ok(Math.abs(Math.hypot(inner[0],inner[2])-markRadius(angle))<1e-10)
}
console.log('S center: contour intersections, preserved outer helix, and individual fin lengths verified')
