import assert from 'node:assert/strict'
import { dotLattice } from './lattice.js'

const SPACING = 0.05
const points = dotLattice(SPACING)
const count = points.length / 3

// every dot is on the globe
for (let dot = 0; dot < count; dot++) {
  const length = Math.hypot(points[dot * 3], points[dot * 3 + 1], points[dot * 3 + 2])
  assert.ok(Math.abs(length - 1) < 1e-6, `dot ${dot} is ${length} from the center`)
}

// the dots are even: their number is the area of the globe over the area of one cell
const even = (4 * Math.PI) / SPACING ** 2
assert.ok(Math.abs(count - even) / even < 0.02, `${count} dots, and an even globe has ${even}`)

// next to the equator, two dots of a row are one spacing apart
const middle = Math.floor(count / 2)
const gap = Math.hypot(
  points[middle * 3] - points[middle * 3 + 3],
  points[middle * 3 + 1] - points[middle * 3 + 4],
  points[middle * 3 + 2] - points[middle * 3 + 5]
)
assert.ok(Math.abs(gap - SPACING) / SPACING < 0.05, `the gap is ${gap}`)

console.log('lattice ok')
