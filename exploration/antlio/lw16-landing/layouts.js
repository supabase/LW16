// three.core.js holds the math classes and loads in Node too, so the collision check can run there
import { Euler, Quaternion, Vector3 } from '../shared/three/three.core.js'

export const COUNT = 280
export const FOV = 30
// outer size of one ticket with its bevel, for the collision check
export const TICKET = { width: 1.008, height: 1.508, thickness: 0.022 }
export const INTRO_SECONDS = 2.2

const LANES = 3
const TAU = Math.PI * 2
const SPACING = 0.15
const LENGTH = COUNT * SPACING
// turns per second of the slow drift that every stage shares
const DRIFT = 0.22 / LENGTH
const RING = { inner: 2, gap: 0.62, scale: 0.24 }
const ARC = { inner: 5.2, gap: 1.15, scale: 0.62 }
const RING_AT = 0.24
// the five tickets stand on one line before the roll: the room between two of them, their
// scale, and the turn of the line
const PILE = { spacing: 0.32, scale: 0.42, yaw: -0.7 }
// scroll window of the roll that turns the pile into the prism of day cards
const ROLL = { from: 0.84, to: 0.9, turns: 2 }
// room between the cards of the prism, as a part of a card width. keep in step with style.css
const PRISM_GAP = 0.06

const euler = new Euler()
const axisX = new Vector3(1, 0, 0)
const tilt = new Quaternion()
const radial = new Vector3()
const spare = { position: new Vector3(), quaternion: new Quaternion(), scale: 1 }
// the pile stands on this line, and its tickets face along it
const PILE_AXIS = new Vector3(Math.sin(PILE.yaw), 0, Math.cos(PILE.yaw))
const shape = { inner: 0, gap: 0, scale: 0 }

export const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
export const smooth = (value) => value * value * (3 - 2 * value)
export const smoothstep = (from, to, value) => smooth(clamp01((value - from) / (to - from)))
const lerp = (from, to, amount) => from + (to - from) * amount

const pose = (out, order, x, y, z, rx, ry, rz, scale) => {
  out.position.set(x, y, z)
  out.quaternion.setFromEuler(euler.set(rx, ry, rz, order))
  out.scale = scale
}

const blend = (out, to, amount) => {
  out.position.lerp(to.position, amount)
  out.quaternion.slerp(to.quaternion, amount)
  out.scale = lerp(out.scale, to.scale, amount)
}

// where a ticket sits along the row or around the rings, from 0 to 1
const turnOf = (index, time) => {
  const turns = index / COUNT + time * DRIFT
  return turns - Math.floor(turns)
}

// a long row of tickets that fans open and shut in a slow wave, and drifts sideways
const spine = (out, index, { time, intro }, flat = 0) => {
  const x = (turnOf(index, time) - 0.5) * LENGTH
  // on load each ticket drops into its slot, in a wave from left to right
  const drop = 1 - smooth(clamp01((intro - clamp01((x + 7) / 14) * 0.6) / 0.4))
  const wave = (1 - flat) * (1 - drop) ** 2
  pose(
    out,
    'XYZ',
    x,
    0.35 + Math.sin(x * 0.4 + time * 0.2) * 0.14 * wave + drop * 6,
    0,
    Math.sin(x * 0.55 + time * 0.3) * 0.4 * wave,
    0.95 + 0.4 * Math.sin(x * 0.8 - time * 0.25) * wave,
    0,
    1.25
  )
}

const circle = (out, index, { time, progress }, { inner, gap, scale }) => {
  const lane = index % LANES
  // the lanes turn against each other only after the curl, when they are apart
  const spin = (lane === 1 ? -1 : 1) * Math.max(progress - RING_AT, 0) * 2.6
  const along = TAU * (turnOf(index, time) - 0.5) + spin
  const radius = inner + lane * gap
  // ZYX turns the ticket on its own axis first, then lays it along the circle
  pose(out, 'ZYX', Math.sin(along) * radius, Math.cos(along) * radius, 0, 0, 0.3, -along, scale)
}

// the row shrinks and splits into three rows. the rows bend down into rings that are much
// bigger than the screen, so the two ends of each row meet far below it and no gap shows
// then the closed rings get small and come into view
const curl = (out, index, context, amount) => {
  const shrink = smoothstep(0, 0.35, amount)
  const rows = smoothstep(0.2, 0.4, amount)
  const close = smoothstep(0.4, 0.7, amount)
  const gather = smoothstep(0.7, 1, amount)
  spine(out, index, context, shrink)

  const lane = index % LANES
  const along = turnOf(index, context.time) - 0.5
  const radius = RING.inner + lane * RING.gap
  const sweep = Math.max(close, 1e-4) * TAU
  // an open ring keeps the length of the row, so at the moment it closes it is very big
  const open = (LENGTH + TAU * lane * RING.gap * close) / sweep
  const reach = lerp(open, radius, gather)
  const center = lerp(out.position.y + lane * RING.gap * rows - open, 0, gather)
  out.position.set(reach * Math.sin(along * sweep), center + reach * Math.cos(along * sweep), 0)
  pose(spare, 'ZYX', 0, 0, 0, 0, 0.3, -along * sweep, 0)
  out.quaternion.slerp(spare.quaternion, close)

  // tickets wrap from one end of the row to the other, so the ends shrink to hide the jump
  const isOpen = smoothstep(0, 0.2, amount) * (1 - smoothstep(0.85, 1, close))
  const taper = 1 - isOpen * (1 - smoothstep(0.5, 0.46, Math.abs(along)))
  out.scale = lerp(1.25, RING.scale, shrink) * taper

  // the closed rings lie back a little as they come in, then stand up to face the reader
  tilt.setFromAxisAngle(axisX, -0.6 * Math.sin(Math.PI * gather))
  out.position.applyQuaternion(tilt)
  out.quaternion.premultiply(tilt)
}

const ring = (out, index, context) => circle(out, index, context, RING)

const grow = (out, index, context, amount) => {
  const eased = smooth(amount)
  shape.inner = lerp(RING.inner, ARC.inner, eased)
  shape.gap = lerp(RING.gap, ARC.gap, eased)
  shape.scale = lerp(RING.scale, ARC.scale, eased)
  circle(out, index, context, shape)
}

const arc = (out, index, context) => circle(out, index, context, ARC)

const hero = (out, { time, aspect }) => {
  const isWide = aspect > 1
  pose(
    out,
    'XYZ',
    isWide ? 1.15 : 0,
    isWide ? 0 : 0.3,
    0,
    Math.sin(time * 0.5) * 0.06,
    -0.35 + Math.sin(time * 0.4) * 0.12,
    0,
    isWide ? 1.3 : 0.95
  )
}

// the tickets other than the hero move out and back, to frame the corners of the view
const recede = (out, index, context, amount) => {
  arc(out, index, context)
  out.position.multiplyScalar(1 + 0.3 * amount)
  out.position.z -= 9 * amount
  out.scale = lerp(ARC.scale, 0.3, amount)
}

const pick = (out, index, context, amount) => {
  const leave = smoothstep(0.3, 1, amount)
  if (index !== 0) return recede(out, index, context, leave)
  // the hero first slides out of its lane in its own plane, so it cuts through no neighbor
  arc(out, index, context)
  radial.copy(out.position).normalize()
  out.position.addScaledVector(radial, -1.3 * smoothstep(0, 0.3, amount))
  hero(spare, context)
  blend(out, spare, leave)
}

const single = (out, index, context) => {
  if (index !== 0) return recede(out, index, context, 1)
  hero(out, context)
}

// the five tickets of the pile roll on their upright axis and open into a prism, one ticket
// on each face. before the roll starts this is the pile. the other tickets stay away
const roll = (out, index, { roll: { amount, behind, scale, radius, faces } }) => {
  // the prism opens from the first step of the roll, so the five tickets never close up
  const open = smoothstep(0, 0.55, amount)
  const yaw = (((index % faces) * TAU) / faces) * open - behind
  const size = index < faces ? 1 : 0
  const reach = lerp(((faces - 1) / 2 - index) * PILE.spacing, radius, open)
  pose(
    out,
    'XYZ',
    Math.sin(yaw) * reach,
    0,
    Math.cos(yaw) * reach,
    0,
    yaw,
    0,
    lerp(PILE.scale, scale, open) * size
  )
}

// the far tickets leave into the fog. four of them come back along the line of the pile, in
// the order of the pile, so no ticket passes through another. the hero turns into the front of
// the pile, and the other tickets stay in the fog
const gather = (out, index, context, amount) => {
  roll(spare, index, context)
  if (index === 0) {
    hero(out, context)
    return blend(out, spare, smoothstep(0, 0.6, amount))
  }
  if (amount < 0.5 || index >= context.roll.faces) {
    recede(out, index, context, 1)
    out.position.z -= 40 * smoothstep(0, 0.5, amount)
    return
  }
  blend(out, spare, 1)
  out.position.addScaledVector(PILE_AXIS, -60 * (1 - smoothstep(0.5, 1, amount)))
}

// the state of the roll at a scroll progress. faces is the number of day cards, and face is
// the width of a day card on the page as a part of the screen height
export const readRoll = ({ progress, faces, face }) => {
  const amount = smoothstep(ROLL.from, ROLL.to, progress)
  // from the axis of the prism to a face, for a card of width 1
  const reach = 0.5 / Math.tan(Math.PI / faces) + PRISM_GAP
  // the front ticket of the prism must be as wide on screen as the page card that takes its place
  const spread = 2 * Math.tan((FOV * Math.PI) / 360) * face
  const scale = (spread * KEYS.at(-1).eye[2]) / (1 + spread * reach)
  return {
    amount,
    faces,
    scale,
    radius: scale * reach,
    // the angle the pile has still to turn before the prism is at rest
    behind: (TAU * ROLL.turns - PILE.yaw) * (1 - amount),
  }
}

const STAGES = [
  { until: 0.07, place: spine },
  { until: 0.24, place: curl },
  { until: 0.36, place: ring },
  { until: 0.48, place: grow },
  { until: 0.6, place: arc },
  { until: 0.66, place: pick },
  { until: 0.72, place: single },
  { until: 0.84, place: gather },
  { until: Infinity, place: roll },
]

// camera positions along the scroll, at the same marks as the stages
export const KEYS = [
  { at: 0, eye: [0, 0, 8], target: [0, 0, 0] },
  { at: 0.07, eye: [0, 0, 8], target: [0, 0, 0] },
  { at: 0.24, eye: [0, 0, 15], target: [0, 0, 0], isWide: true },
  { at: 0.36, eye: [0, 0, 15], target: [0, 0, 0], isWide: true },
  { at: 0.48, eye: [0, 5.4, 5.4], target: [0, 6.3, 0] },
  { at: 0.6, eye: [0, 5.4, 5.4], target: [0, 6.3, 0] },
  { at: 0.66, eye: [0, 0, 6], target: [0, 0, 0] },
  { at: 0.72, eye: [0, 0, 6], target: [0, 0, 0] },
  { at: 1, eye: [0, 0, 6], target: [0, 0, 0] },
]

// the layout that places every ticket at this scroll progress
export const stageAt = (progress) => {
  const index = STAGES.findIndex((stage) => progress < stage.until)
  const from = index === 0 ? 0 : STAGES[index - 1].until
  const { until, place } = STAGES[index]
  const amount = until === Infinity ? 0 : (progress - from) / (until - from)
  return (out, ticket, context) => place(out, ticket, context, amount)
}
