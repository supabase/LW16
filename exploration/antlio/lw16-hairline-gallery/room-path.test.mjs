import assert from 'node:assert/strict'
import { makeRoom, sampleRoom } from './room-path.js'

const room = makeRoom({ flatWidth: 500, radius: 240, depth: 1100, front: 900 })
const epsilon = 1e-5
const boundaries = [room.side, room.side + room.corner, room.side + room.corner + room.flatWidth, room.side + 2 * room.corner + room.flatWidth]

// a sheet crossing a join must not develop a crease or a gap
for (const boundary of boundaries) {
  const before = sampleRoom(room, boundary - epsilon)
  const after = sampleRoom(room, boundary + epsilon)
  assert.ok(Math.hypot(before.x - after.x, before.z - after.z) < epsilon * 2.01)
  assert.ok(Math.hypot(before.tx - after.tx, before.tz - after.tz) < epsilon)
}

// the centered sheet must have a level top edge and no perspective yaw
for (let offset = -240; offset <= 240; offset += 20) {
  const point = sampleRoom(room, room.middle + offset)
  assert.equal(point.z, -room.depth)
  assert.equal(point.tx, 1)
  assert.equal(point.tz, 0)
  assert.ok(Math.abs(point.x - offset) < epsilon)
}

// opposite walls stay parallel, and the two corners are mirror images
for (let distance = 0; distance <= room.length; distance += 17) {
  const left = sampleRoom(room, distance)
  const right = sampleRoom(room, room.length - distance)
  assert.ok(Math.abs(left.x + right.x) < epsilon)
  assert.ok(Math.abs(left.z - right.z) < epsilon)
  assert.ok(Math.abs(Math.hypot(left.tx, left.tz) - 1) < epsilon)
}
const a = sampleRoom(room, room.side + room.corner * .2)
const b = sampleRoom(room, room.side + room.corner * .8)
assert.ok(Math.hypot(a.tx - b.tx, a.tz - b.tz) > .5, 'A sheet spanning a corner must bend, rather than rotate as one plane')
console.log('Room path: flat center, curved corners, parallel sides, and smooth joins verified')
