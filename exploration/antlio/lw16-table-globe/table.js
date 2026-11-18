import { GLYPH_SIZE, fillGlyphPath } from '../lw16-ticket-globe/glyph-path.js'
import { RADIUS, SHEET, normal, unroll } from './unroll.js?v=2'

// the utc offset of each row. all times and places on this page are made up
const OFFSETS = [11, 9, 8, 5.5, 1, 1, 0, -3, -5, -8]
const YOUR_ROW = 4
// the timeline starts at this utc hour, and each place has its session at 09:00 local time
const START_HOUR = 21
const SESSION = { from: 9, hours: 2.5 }
// parts of the sheet, from 0 to 1: the header row, the timeline, and the column of start times
const HEADER = 0.075
const TIMELINE = { from: 0.03, width: 0.68 }
const INFO = { line: 0.735, text: 0.752 }
const ROW = (1 - HEADER) / OFFSETS.length
// distance of the camera from the center of the globe, in sheet units
const CAMERA = 7 * RADIUS
// a line is cut into steps this long, so it bends with the globe
const STEP = { u: 1 / 96, v: 1 / 24 }
const TURN_SECONDS = 50
// the view looks down on the globe by this angle, so its top comes toward the reader
const VIEW_TILT = 0.63
// the globe is big and cut by the screen: its radius and its center, as parts of the screen
const GLOBE = { radius: 0.5, x: 0.72, y: 0.69 }
// the path of each satellite: its distance from the center in globe radii, how far it leans
// from the equator, where it crosses the equator, and its speed and start in radians
const ORBITS = [
  { radius: 1.22, lean: 0.55, node: 0.6, speed: 0.16, start: 0.4 },
  { radius: 1.5, lean: -0.38, node: 2.4, speed: -0.1, start: 2.2 },
  { radius: 1.95, lean: 0.2, node: 4.2, speed: 0.06, start: -1.7 },
]
const ORBIT_STEPS = 220
const TRAIL = { length: 0.2, steps: 12 }
const GLYPH_TEXT = 'SUPABASE / LAUNCH WEEK 16 / '
// the angle between two letters of a table text while they are on the path of a satellite
const LETTER_TURN = 0.012
const PAPER = '#0c0d0d'
const INK = '232, 232, 230'
const GREEN = '62, 207, 142'
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace'

const canvas = document.querySelector('#table')
const ctx = canvas.getContext('2d')
const story = document.querySelector('#story')
const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
// the width of one letter as a part of the font size. the font has one width for all letters
ctx.font = `500 100px ${MONO}`
const LETTER_ADVANCE = ctx.measureText('0').width / 100

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const smoothstep = (from, to, value) => {
  const amount = clamp01((value - from) / (to - from))
  return amount * amount * (3 - 2 * amount)
}
const lerp = (from, to, amount) => from + (to - from) * amount
const hourU = (hour) => TIMELINE.from + (hour / 24) * TIMELINE.width
const clock = (hour) => {
  const whole = ((Math.floor(hour) % 24) + 24) % 24
  return `${String(whole).padStart(2, '0')}:${hour % 1 ? '30' : '00'}`
}

// everything on the sheet, built once: lines and text, in sheet parts from 0 to 1
const buildSheet = () => {
  const lines = []
  const texts = []

  for (let row = 0; row <= OFFSETS.length; row++) {
    lines.push({ points: [[0, HEADER + row * ROW], [1, HEADER + row * ROW]], alpha: 0.16 })
  }
  lines.push({ points: [[0, 0], [1, 0]], alpha: 0.16 })
  for (let hour = 0; hour <= 24; hour++) {
    const isMarked = hour % 3 === 0
    lines.push({ points: [[hourU(hour), isMarked ? 0 : HEADER], [hourU(hour), 1]], alpha: isMarked ? 0.16 : 0.06 })
    if (!isMarked || hour === 24) continue
    const utc = (START_HOUR + hour) % 24
    texts.push({ u: hourU(hour), v: HEADER / 2, text: utc === 0 ? 'DEC 07' : clock(utc), size: 8, alpha: 0.5, align: 'center' })
  }
  lines.push({ points: [[INFO.line, 0], [INFO.line, 1]], alpha: 0.3 })

  // on the globe the marked columns go on to the two poles, and the part without columns
  // gets some. these lines are not part of the table, so they go away as it unrolls
  const pole = (Math.PI / 2) * (RADIUS / SHEET.height)
  for (let hour = 0; hour <= 24; hour += 3) {
    lines.push({ points: [[hourU(hour), 0.5 - pole], [hourU(hour), 0]], alpha: 0.16, isGlobeOnly: true })
    lines.push({ points: [[hourU(hour), 1], [hourU(hour), 0.5 + pole]], alpha: 0.16, isGlobeOnly: true })
  }
  for (const u of [0.82, 0.91, 1]) {
    lines.push({ points: [[u, 0.5 - pole], [u, 0.5 + pole]], alpha: 0.16, isGlobeOnly: true })
  }

  for (const [row, offset] of OFFSETS.entries()) {
    const top = HEADER + row * ROW
    // hours from the start of the timeline to the session of this place
    const wait = (((SESSION.from - offset - START_HOUR) % 24) + 24) % 24
    const zone = offset === 0 ? 'UTC' : `UTC${offset > 0 ? '+' : '−'}${Math.abs(offset) % 1 ? `${Math.floor(Math.abs(offset))}:30` : Math.abs(offset)}`

    texts.push({ u: hourU(wait), v: top + ROW * 0.4, text: `${clock(SESSION.from)}–${clock(SESSION.from + SESSION.hours)} ${zone}`, size: 9, alpha: 0.9 })
    if (row === YOUR_ROW) {
      texts.push({ u: hourU(wait), v: top + ROW * 0.66, text: 'YOURS', size: 7, alpha: 1, color: GREEN })
    }

    texts.push({ u: INFO.text, v: top + ROW * 0.28, text: 'STARTS IN', size: 7, alpha: 0.5 })
    texts.push({ u: INFO.text, v: top + ROW * 0.5, text: `${Math.floor(wait)} h${wait % 1 ? ' 30 min' : ''}`, size: 10, alpha: 1, weight: 600 })
    texts.push({ u: INFO.text, v: top + ROW * 0.72, text: 'Entries open then', size: 8, alpha: 0.5 })
  }
  return { lines, texts }
}

const sheet = buildSheet()
const view = { width: 1, height: 1, ratio: 1 }
// the state of one frame: how flat the sheet is, how far it is turned, and where it sits on screen
const pose = { flat: 0, shift: 0, scale: 1, tableScale: 1, x: 0, y: 0, tiltCos: 1, tiltSin: 0 }
let progress = 0
let spin = 0
let previous = 0

// a point of the sheet on the screen, as [x, y, size, facing]. lift is its height over the sheet
const project = (u, v, lift = 0) => {
  const x = (u - 0.5) * SHEET.width + pose.shift
  const y = (0.5 - v) * SHEET.height
  const away = normal(x, y, pose.flat)
  // a satellite comes down to the table as the globe unrolls
  const height = lift * (1 - pose.flat)
  const point = unroll(x, y, pose.flat).map((part, axis) => part + away[axis] * height)
  const up = point[1] * pose.tiltCos - point[2] * pose.tiltSin
  const near = point[1] * pose.tiltSin + point[2] * pose.tiltCos
  const size = (pose.scale * CAMERA) / (CAMERA - near)
  return [
    pose.x + point[0] * size,
    pose.y - up * size,
    size,
    away[1] * pose.tiltSin + away[2] * pose.tiltCos,
  ]
}

// a point of the path of a satellite on the sheet, at a longitude in radians
// on the flat table this path is the wave that a satellite draws on a map
const orbitPoint = ({ lean, node }, turn) => {
  const latitude = Math.atan(Math.tan(lean) * Math.sin(turn - node))
  return [turn / (Math.PI * 2) + 0.5, 0.5 - (latitude * RADIUS) / SHEET.height]
}

// the far side of the globe shows through, dimmer. the globe is small on screen,
// so its lines are stronger than the lines of the flat table
const shade = (facingAmount) =>
  (0.14 + 0.86 * smoothstep(-0.15, 0.35, facingAmount)) * lerp(1.9, 1, pose.flat)

const drawLine = ({ points, alpha, isGlobeOnly }) => {
  if (isGlobeOnly) alpha *= 1 - pose.flat
  if (alpha < 0.01) return
  ctx.lineWidth = view.ratio
  for (let index = 1; index < points.length; index++) {
    const [u0, v0] = points[index - 1]
    const [u1, v1] = points[index]
    const steps = Math.max(Math.ceil(Math.abs(u1 - u0) / STEP.u), Math.ceil(Math.abs(v1 - v0) / STEP.v), 1)
    let from = project(u0, v0)
    ctx.beginPath()
    ctx.moveTo(from[0], from[1])
    for (let step = 1; step <= steps; step++) {
      const to = project(lerp(u0, u1, step / steps), lerp(v0, v1, step / steps))
      ctx.lineTo(to[0], to[1])
      // each step takes its own shade, so a line gets dim as it goes around the globe
      ctx.strokeStyle = `rgba(${INK}, ${alpha * shade((from[3] + to[3]) / 2)})`
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(to[0], to[1])
      from = to
    }
  }
}

// the paths and the satellites go away as the globe unrolls, and the table text takes their letters
const orbitFade = () => 1 - smoothstep(0.45, 0.85, pose.flat)

// the path of a satellite, as a line of very small letters. it draws in two parts,
// the far side before the grid and the near side after it
const drawOrbit = (orbit, index, isNear) => {
  const lift = (orbit.radius - 1) * RADIUS
  const color = `rgba(${INK}, ${(isNear ? 0.9 : 0.35) * orbitFade()})`
  let run = []
  const flush = () => {
    if (run.length > 1) {
      fillGlyphPath({ ctx, points: run, text: GLYPH_TEXT, offset: index * 1009, surface: PAPER, color, size: GLYPH_SIZE * 1.5 * view.ratio })
    }
    run = []
  }
  for (let step = 0; step <= ORBIT_STEPS; step++) {
    const [x, y, , facing] = project(...orbitPoint(orbit, (step / ORBIT_STEPS - 0.5) * Math.PI * 2), lift)
    // the globe is cut by the screen, so a large part of each path is off it
    const isOnScreen = x > -40 && x < view.width + 40 && y > -40 && y < view.height + 40
    if (facing >= 0 === isNear && isOnScreen) run.push({ x, y })
    else flush()
  }
  flush()
}

// a satellite is a bright point with a short tail
const drawSatellite = (orbit, seconds) => {
  const lift = (orbit.radius - 1) * RADIUS
  const turn = orbit.start + seconds * orbit.speed
  // the point stays on the sheet, from one end of it to the other
  const head = turn - Math.floor(turn / (Math.PI * 2) + 0.5) * Math.PI * 2
  const tail = -Math.sign(orbit.speed) * TRAIL.length
  let from = project(...orbitPoint(orbit, head + tail), lift)
  const light = (0.3 + 0.7 * smoothstep(-0.1, 0.3, from[3])) * orbitFade()
  ctx.lineWidth = 1.4 * view.ratio
  for (let step = 1; step <= TRAIL.steps; step++) {
    const to = project(...orbitPoint(orbit, head + tail * (1 - step / TRAIL.steps)), lift)
    ctx.strokeStyle = `rgba(${INK}, ${(step / TRAIL.steps) * light})`
    ctx.beginPath()
    ctx.moveTo(from[0], from[1])
    ctx.lineTo(to[0], to[1])
    ctx.stroke()
    from = to
  }
  for (const [radius, alpha] of [[6, 0.14], [2.2, 1]]) {
    ctx.fillStyle = `rgba(${INK}, ${alpha * light})`
    ctx.beginPath()
    ctx.arc(from[0], from[1], radius * view.ratio, 0, Math.PI * 2)
    ctx.fill()
  }
}

// each text of the table starts as a piece of the path of a satellite. its letters leave
// the path and go to their places in the table as the globe unrolls
const drawText = ({ u, v, text, size, alpha, align = 'left', weight = 500, color = INK }, index) => {
  // each text leaves at its own moment
  const delay = (index * 0.618) % 1
  const travel = smoothstep(0.3 + 0.25 * delay, 0.74 + 0.25 * delay, pose.flat)
  if (travel <= 0) return
  const orbit = ORBITS[index % ORBITS.length]
  const lift = (orbit.radius - 1) * RADIUS
  const [x, y, zoom] = project(u, v)
  // text keeps its size against the table, so it gets small with a small table and never overlaps
  const px = size * (zoom / pose.tableScale) * pose.unit * view.ratio
  const advance = px * LETTER_ADVANCE
  const left = x - (align === 'center' ? (text.length * advance) / 2 : 0)
  const start = (delay - 0.5) * Math.PI * 2
  ctx.font = `${weight} ${lerp(GLYPH_SIZE * 1.5 * view.ratio, px, travel)}px ${MONO}`
  ctx.fillStyle = `rgba(${color}, ${lerp(0.9, alpha, travel)})`
  for (const [at, letter] of [...text].entries()) {
    if (letter === ' ') continue
    const from = project(...orbitPoint(orbit, start + at * LETTER_TURN), lift)
    ctx.fillText(letter, lerp(from[0], left + at * advance, travel), lerp(from[1], y, travel))
  }
}

const resize = () => {
  const { clientWidth: width, clientHeight: height } = canvas.parentElement
  const ratio = Math.min(devicePixelRatio, 2)
  canvas.width = width * ratio
  canvas.height = height * ratio
  Object.assign(view, { width: width * ratio, height: height * ratio, ratio })
}

const frame = (now) => {
  requestAnimationFrame(frame)
  const time = now / 1000
  const dt = Math.min(time - previous, 0.1)
  previous = time
  const { top, height } = story.getBoundingClientRect()
  const target = clamp01(-top / (height - innerHeight))
  progress = isMotionReduced ? target : progress + (target - progress) * (1 - Math.exp(-dt * 7))
  const flat = smoothstep(0.06, 0.82, progress)

  // the globe turns. as it unrolls, the turn slows and the sheet goes to the nearest whole turn,
  // so the table always opens with its seam at the two ends
  const hold = smoothstep(0, 0.45, flat)
  if (!isMotionReduced) {
    spin += ((dt * Math.PI * 2) / TURN_SECONDS) * (1 - hold)
    const rest = Math.round(spin / (Math.PI * 2)) * Math.PI * 2
    spin += (rest - spin) * (1 - Math.exp(-dt * 9 * hold))
  }

  const globeScale = (GLOBE.radius * Math.min(view.width, view.height)) / RADIUS
  const tilt = VIEW_TILT * (1 - smoothstep(0, 0.75, flat))
  pose.tiltCos = Math.cos(tilt)
  pose.tiltSin = Math.sin(tilt)
  pose.tableScale = Math.min((0.92 * view.width) / SHEET.width, (0.7 * view.height) / SHEET.height)
  pose.unit = (pose.tableScale * SHEET.width) / view.ratio / 1300
  pose.flat = flat
  pose.shift = spin * RADIUS
  pose.scale = lerp(globeScale, pose.tableScale, flat)
  pose.x = view.width * lerp(GLOBE.x, 0.5, flat)
  pose.y = view.height * lerp(GLOBE.y, 0.545, flat)

  ctx.clearRect(0, 0, view.width, view.height)
  for (const [index, orbit] of ORBITS.entries()) drawOrbit(orbit, index, false)
  for (const line of sheet.lines) drawLine(line)
  for (const [index, orbit] of ORBITS.entries()) drawOrbit(orbit, index, true)
  for (const orbit of ORBITS) drawSatellite(orbit, isMotionReduced ? 0 : time)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (const [index, text] of sheet.texts.entries()) drawText(text, index)
}

new ResizeObserver(resize).observe(canvas.parentElement)
resize()
requestAnimationFrame(frame)
