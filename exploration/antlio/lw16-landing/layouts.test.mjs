// no two tickets may pass through each other, from the first frame to the start of the roll
// the roll puts every ticket on five faces on purpose
import assert from 'node:assert/strict'
import { Quaternion, Vector3 } from '../shared/three/three.core.js'
import { COUNT, INTRO_SECONDS, TICKET, readRoll, stageAt } from './layouts.js'

const ROLL_START = 0.84

const HALF = [TICKET.width / 2, TICKET.height / 2, TICKET.thickness / 2]
const UNIT = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]

const boxes = Array.from({ length: COUNT }, () => ({
  position: new Vector3(),
  quaternion: new Quaternion(),
  scale: 1,
  axes: [new Vector3(), new Vector3(), new Vector3()],
  half: [0, 0, 0],
  radius: 0,
}))
const between = new Vector3()

// separating axis test for two oriented boxes
const overlaps = (a, b) => {
  between.subVectors(b.position, a.position)
  if (between.length() > a.radius + b.radius) return false
  const rotation = a.axes.map((axis) => b.axes.map((other) => axis.dot(other)))
  const absolute = rotation.map((row) => row.map((value) => Math.abs(value) + 1e-9))
  const offset = a.axes.map((axis) => between.dot(axis))
  for (let i = 0; i < 3; i++) {
    const reach = a.half[i] + b.half[0] * absolute[i][0] + b.half[1] * absolute[i][1] + b.half[2] * absolute[i][2]
    if (Math.abs(offset[i]) > reach) return false
  }
  for (let j = 0; j < 3; j++) {
    const reach = a.half[0] * absolute[0][j] + a.half[1] * absolute[1][j] + a.half[2] * absolute[2][j] + b.half[j]
    if (Math.abs(offset[0] * rotation[0][j] + offset[1] * rotation[1][j] + offset[2] * rotation[2][j]) > reach) return false
  }
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const i1 = (i + 1) % 3
      const i2 = (i + 2) % 3
      const j1 = (j + 1) % 3
      const j2 = (j + 2) % 3
      const reach =
        a.half[i1] * absolute[i2][j] + a.half[i2] * absolute[i1][j] +
        b.half[j1] * absolute[i][j2] + b.half[j2] * absolute[i][j1]
      if (Math.abs(offset[i2] * rotation[i1][j] - offset[i1] * rotation[i2][j]) > reach) return false
    }
  }
  return true
}

const collisionsAt = ({ progress, time, intro }) => {
  const context = { progress, time, intro, aspect: 1.6 }
  context.roll = readRoll({ progress, faces: 5, face: 0.38 })
  const place = stageAt(progress)
  const shown = []
  for (const [index, box] of boxes.entries()) {
    place(box, index, context)
    // a ticket this small is a point on screen, so it is treated as hidden
    if (box.scale < 0.02) continue
    for (let axis = 0; axis < 3; axis++) {
      box.axes[axis].copy(UNIT[axis]).applyQuaternion(box.quaternion)
      box.half[axis] = HALF[axis] * box.scale
    }
    box.radius = Math.hypot(...box.half)
    box.index = index
    shown.push(box)
  }
  const hits = []
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      if (overlaps(shown[i], shown[j])) hits.push([shown[i].index, shown[j].index])
    }
  }
  return hits
}

const failures = []
const check = (frame) => {
  const hits = collisionsAt(frame)
  if (hits.length > 0) failures.push({ ...frame, count: hits.length, first: hits[0] })
}

for (const time of [3, 11.7, 40.2]) {
  for (let progress = 0; progress <= ROLL_START; progress += 0.0025) {
    check({ progress: Number(progress.toFixed(4)), time, intro: 1 })
  }
}
for (let seconds = 0; seconds <= INTRO_SECONDS; seconds += 0.05) {
  check({ progress: 0, time: seconds, intro: seconds / INTRO_SECONDS })
}

if (failures.length > 0) {
  const stages = new Map()
  for (const failure of failures) {
    const key = failure.intro < 1 ? 'intro' : failure.progress.toFixed(2)
    stages.set(key, Math.max(stages.get(key) ?? 0, failure.count))
  }
  console.error('worst overlap count by progress:', Object.fromEntries(stages))
  console.error('first:', failures[0])
}
assert.equal(failures.length, 0, `${failures.length} frames have tickets that pass through each other`)
console.log('layouts ok')
