import { click, settle, unlock } from '../lw16-city-wheel/click.js?v=4'
import { createCrt } from '../lw16-city-wheel/crt.js?v=29'

// the ten cities, from the first to start to the last. offset is the utc offset in
// december. the counts and the states are made up
const CITIES = [
  { name: 'Sydney', offset: 11, people: 180, status: 'open' },
  { name: 'Tokyo', offset: 9, people: 300, status: 'nearing' },
  { name: 'Singapore', offset: 8, people: 300, status: 'full' },
  { name: 'Bengaluru', offset: 5.5, people: 300, status: 'nearing' },
  { name: 'Berlin', offset: 1, people: 300, status: 'open' },
  { name: 'Lagos', offset: 1, people: 120, status: 'open' },
  { name: 'London', offset: 0, people: 240, status: 'nearing' },
  { name: 'Sao Paulo', offset: -3, people: 150, status: 'open' },
  { name: 'New York', offset: -5, people: 260, status: 'full' },
  { name: 'San Francisco', offset: -8, people: 280, status: 'nearing' },
]
// each state has its words and its own shape, so the state does not read by color only
// the shape is a ring that fills up: empty, half, full
const STATUS = {
  open: {
    label: 'Open',
    icon: '<circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  },
  nearing: {
    label: 'Nearing capacity',
    icon: '<circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 1.75a4.25 4.25 0 0 1 0 8.5z" fill="currentColor"/>',
  },
  full: { label: 'Waiting list', icon: '<circle cx="6" cy="6" r="5" fill="currentColor"/>' },
}
// each city has its session at this local time
const SESSION = '09:00–11:30'
// the names lie on rings, one after another as lines of text. this is the space between
// two names, as a part of the font size
const GAP = 1.1
// the rings make the globe. their center is on the right edge of the screen, so one half
// of them shows. this is the unit of the sizes below: a part of the screen height, and not
// more than a part of the width
const HUB = { y: 0.52, ofHeight: 0.4, ofWidth: 0.28 }
// in units of HUB: the radius of the outer ring, and the size of the names
const LABEL = { from: 1.52, size: 0.14 }
// the number of rings at most, the space from one ring to the next, and the hole at the
// center, as parts of the font size. a ring near the rim of the ball turns away from the
// reader, so it is less high and nearer the next one, the way the lines of latitude of a
// globe are seen from a pole. flat is how high the ring at the very rim is
const RINGS = { count: 4, line: 2.6, hole: 2, flat: 0.3 }
// each ring starts this many names after the one outside it, so the names do not line up
const STAGGER = 3.7
// the light on the ball of rings comes from the top left, in front
const LIGHT = [-0.5, -0.55, 0.67].map((value, _, all) => value / Math.hypot(...all))
const INK = '232, 232, 230'
// the wheel goes one city for this number of pixels of the mouse wheel, and of a drag
const STEP_PX = { wheel: 80, drag: 56 }
const SANS = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif'
// the icon of the call to action is this much bigger when the pointer or the focus is on it
const OPEN_SCALE = 1.14
// the screen pass of the city wheel draws two glass globes, and bends the two ends of the
// wheel. at this size none of them shows
const NOTHING = 1e-4

const canvas = document.querySelector('#wheel')
const cells = document.querySelector('#cells')
const cta = document.querySelector('#cta')
const pin = canvas.parentElement
const status = document.querySelector('#status')
// the rings draw on a 2D canvas, and the page shows it through the tube screen pass
// without WebGL the 2D picture goes on the page as it is
const crt = createCrt(canvas)
const picture = crt ? document.createElement('canvas') : canvas
const ctx = picture.getContext('2d')
const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const smooth = (value) => value * value * (3 - 2 * value)
const smoothstep = (from, to, value) => smooth(clamp01((value - from) / (to - from)))
// a slot has no end, so after the last city comes the first one
const cityAt = (slot) => CITIES[((slot % CITIES.length) + CITIES.length) % CITIES.length]
// the middle of a name on a ring, as a part of the font size. a ring has no end
const middleOf = (slot) => Math.floor(slot / CITIES.length) * LAP + cityAt(slot).middle
// the place of the middle of the wheel on a ring, between two names
const along = (at) => {
  const slot = Math.floor(at)
  return middleOf(slot) + (middleOf(slot + 1) - middleOf(slot)) * (at - slot)
}

// every city is a row of a table in the page, for a screen reader
for (const city of CITIES) {
  const size = Math.abs(city.offset)
  const zone =
    size === 0
      ? 'UTC'
      : `UTC${city.offset > 0 ? '+' : '−'}${size % 1 ? `${Math.floor(size)}:30` : size}`
  city.session = `${SESSION} ${zone}`
  city.count = `${city.people} people`
  const row = document.querySelector('#cities').insertRow()
  row.append(Object.assign(document.createElement('th'), { scope: 'row', textContent: city.name }))
  for (const text of [city.session, city.count, STATUS[city.status].label]) {
    row.insertCell().textContent = text
  }
}

const view = { width: 1, height: 1, ratio: 1, x: 0, y: 0, radius: 1 }
let position = 0
let previous = 0
let shown = null
// the city the wheel goes to, as a count of steps from the first city. it can be below 0
// and above the number of cities
let target = 0
let wheelSum = 0
let drag = null
let statusTimer = 0
// the name at the middle of the outer ring. the wheel clicks each time it changes
let clicked = 0
// the city of the last status sound. the first city has no sound
let settledOn = CITIES[0]
// the icon of the call to action: its place on the canvas, its radius at rest, and how
// far it is open, from 0 to 1
const lens = { x: 0, y: 0, radius: 0, open: 0 }
// the width of the cells as one row, and as one column
const cellsWidth = { row: 0, column: 0 }

// the words of the link can go on two lines, which moves the icon
const measureLens = () => {
  const frameBox = canvas.getBoundingClientRect()
  const box = document.querySelector('#lens').getBoundingClientRect()
  Object.assign(lens, {
    x: (box.left - frameBox.left + box.width / 2) * view.ratio,
    y: (box.top - frameBox.top + box.height / 2) * view.ratio,
    // the icon gets bigger when it opens, and it must stay in its box
    radius: (box.height / 2 / OPEN_SCALE) * view.ratio,
  })
}

const resize = () => {
  const { clientWidth: width, clientHeight: height } = canvas.parentElement
  const ratio = Math.min(devicePixelRatio, 2)
  canvas.width = picture.width = width * ratio
  canvas.height = picture.height = height * ratio
  Object.assign(view, {
    width: width * ratio,
    height: height * ratio,
    ratio,
    x: width * ratio,
    y: HUB.y * height * ratio,
    radius: Math.min(HUB.ofHeight * height, HUB.ofWidth * width) * ratio,
  })
  measureLens()
}

// how much light a point of the ball of rings gets, from 0 to 1, and how much it faces
// the reader. x and y are from the center of the rings
const lightAt = (x, y, ball) => {
  const nx = x / ball
  const ny = y / ball
  const nz = Math.sqrt(Math.max(1 - nx * nx - ny * ny, 0))
  return { lit: Math.max(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0), facing: nz }
}

// the radius and the height of each ring, from the outer ring to the center
const ringsOf = (size, outer, ball) => {
  const heightAt = (radius) => RINGS.flat + (1 - RINGS.flat) * lightAt(radius, 0, ball).facing
  const rings = [{ radius: outer, height: 1 }]
  for (;;) {
    const { radius, height } = rings.at(-1)
    const next = heightAt(radius - RINGS.line * size * height)
    const inner = radius - (RINGS.line * size * (height + next)) / 2
    if (rings.length === RINGS.count || inner < RINGS.hole * size) return rings
    rings.push({ radius: inner, height: next })
  }
}

// one ring of names. the outer ring is the one the reader turns, and every next ring
// turns the other way
const drawRing = ({ ring, radius, height, ball }, at, alpha) => {
  const size = LABEL.size * view.radius
  const turned = (ring % 2 ? -at : at) + ring * STAGGER
  const middle = along(turned)
  // half a turn of the ring is on the screen, and the rest is past the right edge
  const reach = Math.PI / 2 + 0.2
  for (let slot = Math.round(turned) - 8; slot <= Math.round(turned) + 8; slot++) {
    const city = cityAt(slot)
    const center = ((middle - middleOf(slot)) * size) / radius
    if (Math.abs(center) - (city.em * size) / radius / 2 > reach) continue
    const near = ring === 0 ? smooth(1 - clamp01(Math.abs(slot - at))) : 0
    for (const { letter, at: offset } of city.letters) {
      // the next cities are below the middle, and each name reads up its ring
      const angle = Math.PI + center + ((offset - city.em / 2) * size) / radius
      if (Math.abs(angle - Math.PI) > reach) continue
      const x = radius * Math.cos(angle)
      const y = radius * Math.sin(angle)
      const { lit } = lightAt(x, y, ball)
      // the outer ring stays easy to read, and the active name on it is not shaded
      const shade =
        ring === 0
          ? (0.42 + 0.58 * near) * (0.25 + 0.75 * lit + (0.75 - 0.75 * lit) * near)
          : 0.02 + 0.7 * lit * lit
      // the top of each letter points away from the center
      const turn = angle + Math.PI / 2
      const cos = Math.cos(turn)
      const sin = Math.sin(turn)
      ctx.setTransform(cos, sin, -sin * height, cos * height, view.x + x, view.y + y)
      ctx.fillStyle = `rgba(${INK}, ${shade * alpha})`
      ctx.fillText(letter, 0, 0)
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

// the icon of the call to action is a small copy of the rings, as lines of dashes
const drawIcon = () => {
  const radius = lens.radius * (1 + (OPEN_SCALE - 1) * lens.open)
  ctx.lineWidth = view.ratio
  for (let ring = 0; ring < 4; ring++) {
    ctx.setLineDash([2 * view.ratio, 1.6 * view.ratio])
    ctx.lineDashOffset = (ring % 2 ? -1 : 1) * position * 5 * view.ratio
    ctx.strokeStyle = `rgba(${INK}, ${0.9 - ring * 0.18})`
    ctx.beginPath()
    ctx.arc(lens.x, lens.y, radius * (0.94 - ring * 0.23), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

const frame = (now) => {
  requestAnimationFrame(frame)
  const time = now / 1000
  const dt = Math.min(time - previous, 0.1)
  previous = time
  const ease = isMotionReduced ? 1 : 1 - Math.exp(-dt * 9)

  // the wheel goes to its target in steps, one name at a time. the target has no end:
  // after the last city comes the first one
  position += (target - position) * ease
  const behind = target - position
  if (Math.round(position) !== clicked) {
    clicked = Math.round(position)
    click()
  }
  const city = cityAt(target)
  const settled = 1 - smoothstep(0.02, 0.35, Math.abs(behind))

  ctx.clearRect(0, 0, view.width, view.height)
  const size = LABEL.size * view.radius
  const outer = LABEL.from * view.radius
  const ball = outer + size * 0.6
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `500 ${size}px ${SANS}`
  ringsOf(size, outer, ball).forEach(({ radius, height }, ring) => {
    const shape = { ring, radius, height, ball }
    // a fast turn leaves a short smear behind each name
    for (let ghost = 3; ghost >= 1 && Math.abs(behind) > 0.25; ghost--) {
      drawRing(shape, position - behind * 0.07 * ghost, 0.22 / ghost)
    }
    drawRing(shape, position, 1)
  })

  // the cells of the active city are page text. they sit before the name of the city, and
  // they show when the wheel is at rest
  if (shown !== city) {
    shown = city
    cells.dataset.status = city.status
    for (const key of ['name', 'session', 'count']) {
      cells.querySelector(`[data-cell="${key}"]`).textContent = city[key]
    }
    cells.querySelector('[data-cell="status"]').textContent = STATUS[city.status].label
    cells.querySelector('svg').innerHTML = STATUS[city.status].icon
    // the link goes to the page of the city. this study has no such pages
    cta.href = `#${city.name.toLowerCase().replace(' ', '-')}`
    document.querySelector('#cta-action').textContent =
      city.status === 'full' ? `Join the waiting list in ${city.name}` : `Join in ${city.name}`
    measureLens()
    // a screen reader hears the city after the wheel comes to rest, not each city on the way
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => {
      status.textContent = `${city.name}, ${city.session}, ${city.count}, ${STATUS[city.status].label}`
    }, 600)
    cells.classList.remove('is-docked', 'is-stacked')
    cellsWidth.row = cells.offsetWidth
    cells.classList.add('is-stacked')
    cellsWidth.column = cells.offsetWidth
  }
  // the active name stands up on the left of the outer ring, so the cells go before its letters
  const end = (view.x - LABEL.from * view.radius - size * 1) / view.ratio
  // the cells are one row before the name. on a narrow screen they have room for one
  // column only, or no room, and then they go under the wordmark
  const isStacked = end - cellsWidth.row < 20
  const isDocked = end - cellsWidth.column < 20
  cells.classList.toggle('is-stacked', isStacked && !isDocked)
  cells.classList.toggle('is-docked', isDocked)
  cells.style.translate = isDocked ? '' : `${end}px ${view.y / view.ratio}px`
  cells.style.opacity = settled
  if (settled > 0.98 && settledOn !== city) {
    settledOn = city
    settle(city.status)
  }

  const isOpen = cta.matches(':hover, :focus-visible')
  lens.open += ((isOpen ? 1 : 0) - lens.open) * (isMotionReduced ? 1 : 1 - Math.exp(-dt * 10))
  drawIcon()

  crt?.draw({
    picture,
    hub: view,
    radius: NOTHING,
    small: { x: 0, y: 0, radius: NOTHING },
    ratio: view.ratio,
    yaw: 0,
    city: [0, 0],
    glow: 0,
  })
}

// the place of the name of the outer ring under a point of the screen, as a count of
// steps, or null
const slotAt = ({ clientX, clientY }) => {
  const box = canvas.getBoundingClientRect()
  const dx = (clientX - box.left) * view.ratio - view.x
  const dy = (clientY - box.top) * view.ratio - view.y
  const size = LABEL.size * view.radius
  const outer = LABEL.from * view.radius
  if (Math.abs(Math.hypot(dx, dy) - outer) > size * 0.7) return null
  // the angle from the middle of the wheel, up the ring
  const angle = Math.atan2(-dy, -dx)
  const spot = along(position) - (angle * outer) / size
  const first = Math.round(position) - 8
  for (let slot = first; slot <= first + 16; slot++) {
    if (Math.abs(spot - middleOf(slot)) < cityAt(slot).em / 2 + 0.3) return slot
  }
  return null
}

const handleWheel = (event) => {
  // a mouse wheel gives lines, and a trackpad gives pixels
  wheelSum += event.deltaY * (event.deltaMode === 1 ? 16 : 1)
  const steps = Math.trunc(wheelSum / STEP_PX.wheel)
  wheelSum -= steps * STEP_PX.wheel
  target += steps
}

const handlePointerDown = (event) => {
  if (event.target.closest('a')) return
  drag = { y: event.clientY, from: target, hasMoved: false }
}

const handlePointerMove = (event) => {
  if (!drag) {
    pin.style.cursor = slotAt(event) === null ? '' : 'pointer'
    return
  }
  const moved = event.clientY - drag.y
  if (Math.abs(moved) > 8) drag.hasMoved = true
  // a drag up brings the next cities up
  if (drag.hasMoved) target = drag.from - Math.round(moved / STEP_PX.drag)
}

const handlePointerUp = (event) => {
  if (!drag) return
  // a press with no move is a click, and a click on a name brings that city to the middle
  const slot = drag.hasMoved ? null : slotAt(event)
  drag = null
  if (slot !== null) target = slot
}

const handlePointerCancel = () => {
  drag = null
}

const handleKeyDown = (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
  const steps = {
    ArrowDown: 1,
    ArrowRight: 1,
    PageDown: 1,
    ArrowUp: -1,
    ArrowLeft: -1,
    PageUp: -1,
  }[event.key]
  if (!steps) return
  event.preventDefault()
  target += steps
}

// the width of each name and the middle of each letter, as a part of the font size. a
// ring puts the names one after another, and LAP is the length of the ten names
ctx.font = `500 100px ${SANS}`
ctx.letterSpacing = '-3px'
const LAP = CITIES.reduce((start, city) => {
  const edges = [...city.name].map((_, i) => ctx.measureText(city.name.slice(0, i + 1)).width / 100)
  city.em = edges.at(-1)
  city.letters = [...city.name].map((letter, i) => ({
    letter,
    at: ((edges[i - 1] ?? 0) + edges[i]) / 2,
  }))
  city.middle = start + city.em / 2
  return start + city.em + GAP
}, 0)
ctx.letterSpacing = '0px'

pin.addEventListener('wheel', handleWheel, { passive: true })
pin.addEventListener('pointerdown', handlePointerDown)
pin.addEventListener('pointermove', handlePointerMove)
pin.addEventListener('pointerup', handlePointerUp)
pin.addEventListener('pointercancel', handlePointerCancel)
addEventListener('keydown', handleKeyDown)
// browsers do not agree on which events can start audio, so each of these tries
for (const type of ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown']) {
  addEventListener(type, unlock, { capture: true })
}
new ResizeObserver(resize).observe(canvas.parentElement)
resize()
requestAnimationFrame(frame)
