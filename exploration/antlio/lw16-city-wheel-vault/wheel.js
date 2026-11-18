import { click, settle, unlock } from '../lw16-city-wheel/click.js?v=4'
import { createCrt } from '../lw16-city-wheel/crt.js?v=30'

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
// the words of the two inner rings: the days of a month, and the months
const DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'))
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// each ring of words turns on its own, like the dials of a lock. this combination fills
// the glass ball at the center. no text on the page tells it
const SECRET = { day: '11', month: 'Dec' }
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
// the words lie on rings, one after another as lines of text. this is the space between
// two words, as a part of the font size
const GAP = 1.1
// the rings make the globe. their center is on the right edge of the screen, so one half
// of them shows. this is the unit of the sizes below: a part of the screen height, and not
// more than a part of the width
const HUB = { y: 0.52, ofHeight: 0.4, ofWidth: 0.28 }
// in units of HUB: the radius of the outer ring, and the size of the words
const LABEL = { from: 1.52, size: 0.14 }
// the rings are the cities, a dial, the days, a dial, the months and a dial. lines is the
// space from each ring to the next, as parts of the font size. a ring near the rim of the
// ball turns away from the reader, so it is less high and nearer the next one, the way the
// lines of latitude of a globe are seen from a pole. flat is how high the ring at the very
// rim is
const RINGS = { lines: [2.6, 2.6, 1.6, 1.6, 1.4], flat: 0.3 }
// a dial has a tick at each step and a long tick at each 5 steps. it turns 5 steps for
// each word of the ring outside it. step is in radians on the first dial. the other dials
// keep the gap and the tick size of the first dial, so a smaller dial has fewer ticks
const DIAL = { step: Math.PI / 90, perWord: 5 }
// the active day is at this angle above the city, and the active month is level with the
// city. when all the rings are at rest, the ticks of the first dial light up from the city
// to the day, then the ticks of the second dial light up from the day down to the month,
// in this many seconds
const PATH = { angle: 0.85, seconds: 1.3 }
// the glass ball at the center: its radius as a part of the last dial, and its opacity
// fill is how high the fluid goes, as a part of the height of the ball
const GLASS = { size: 0.62, opacity: 0.45, fill: 0.62 }
// the colors of the fluid. they move through each other, so the fluid looks iridescent
const FLUID = ['62, 207, 142', '40, 180, 200', '175, 230, 110', '62, 207, 142']
// the light on the ball of rings comes from the top left, in front
const LIGHT = [-0.5, -0.55, 0.67].map((value, _, all) => value / Math.hypot(...all))
const INK = '232, 232, 230'
// the wheel goes one word for this number of pixels of the mouse wheel, and of a drag
const STEP_PX = { wheel: 80, drag: 56 }
const SANS = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif'
// the icon of the call to action is this much bigger when the pointer or the focus is on it
const OPEN_SCALE = 1.14
// the screen pass of the city wheel draws a big glass globe and bends the two ends of the
// wheel. at this size none of this shows. the glass ball here is its small globe
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
// a slot has no end, so after the last item comes the first one
const wrap = (items, slot) => items[((slot % items.length) + items.length) % items.length]

// the words of a ring, one after another as a line of text. this gets the width of each
// word and the middle of each letter, as a part of the font size
const lineOf = (words) => {
  let start = 0
  const items = words.map((word) => {
    const edges = [...word].map((_, i) => ctx.measureText(word.slice(0, i + 1)).width / 100)
    const em = edges.at(-1)
    const letters = [...word].map((letter, i) => ({
      letter,
      at: ((edges[i - 1] ?? 0) + edges[i]) / 2,
    }))
    const item = { word, em, letters, middle: start + em / 2 }
    start += em + GAP
    return item
  })
  const lap = start
  const itemAt = (slot) => wrap(items, slot)
  // the middle of a word on the ring. a ring has no end
  const middleOf = (slot) => Math.floor(slot / items.length) * lap + itemAt(slot).middle
  // the place of the middle of the wheel on the ring, between two words
  const along = (at) => {
    const slot = Math.floor(at)
    return middleOf(slot) + (middleOf(slot + 1) - middleOf(slot)) * (at - slot)
  }
  return { itemAt, middleOf, along }
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
let previous = 0
let shown = null
let wheelSum = 0
let drag = null
let statusTimer = 0
// the city of the last status sound. the first city has no sound
let settledOn = CITIES[0]
// how far the lit ticks are from the city to the month, from 0 to 1
let trace = 0
// how full the glass ball is, from 0 to 1, and if the secret was told to a screen reader
let fluid = 0
let isToldOpen = false
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
  return RINGS.lines.reduce(
    (rings, line) => {
      const { radius, height } = rings.at(-1)
      const next = heightAt(radius - line * size * height)
      return [...rings, { radius: radius - (line * size * (height + next)) / 2, height: next }]
    },
    [{ radius: outer, height: 1 }]
  )
}

// one ring of words. anchor is the angle of the active word. found is how much the active
// word stands out, from 0 to 1
const drawRing = ({ radius, height, ball, line, anchor, isOuter }, at, alpha, found) => {
  const size = LABEL.size * view.radius
  const middle = line.along(at)
  // half a turn of the ring is on the screen, and the rest is past the right edge
  const reach = Math.PI / 2 + 0.2
  for (let slot = Math.round(at) - 8; slot <= Math.round(at) + 8; slot++) {
    const item = line.itemAt(slot)
    const center = anchor + ((middle - line.middleOf(slot)) * size) / radius
    if (Math.abs(center - Math.PI) - (item.em * size) / radius / 2 > reach) continue
    const near = smooth(1 - clamp01(Math.abs(slot - at))) * found
    for (const { letter, at: offset } of item.letters) {
      // the next words are below the active one, and each word reads up its ring
      const angle = center + ((offset - item.em / 2) * size) / radius
      if (Math.abs(angle - Math.PI) > reach) continue
      const x = radius * Math.cos(angle)
      const y = radius * Math.sin(angle)
      const { lit } = lightAt(x, y, ball)
      // the outer ring stays easy to read. the active word is not shaded
      const shade = isOuter
        ? (0.42 + 0.58 * near) * (0.25 + 0.75 * lit + (0.75 - 0.75 * lit) * near)
        : 0.04 + 0.6 * lit * lit + (0.96 - 0.6 * lit * lit) * near
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

// a ring of ticks. it turns the other way from the ring of words outside it. the ticks
// from the angle `from` to the angle `to` above the active city are white
const drawDial = ({ radius, ball, first }, at, from, to) => {
  const size = LABEL.size * view.radius
  const step = (first.radius * DIAL.step) / radius
  const turned = at * DIAL.perWord
  const span = (Math.PI / 2 + 0.2) / step
  for (let tick = Math.ceil(turned - span); tick <= turned + span; tick++) {
    const angle = Math.PI + (tick - turned) * step
    const isLong = tick % DIAL.perWord === 0
    const isLit = to > from && angle >= Math.PI + from - 0.01 && angle <= Math.PI + to + 0.01
    const length = size * first.height * (isLong ? 0.5 : isLit ? 0.4 : 0.22)
    ctx.lineWidth = (isLit ? 2 : 1) * view.ratio
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const light = lightAt(radius * cos, radius * sin, ball).lit
    ctx.strokeStyle = isLit
      ? `rgba(${INK}, 0.95)`
      : `rgba(${INK}, ${(isLong ? 0.2 : 0.08) + (isLong ? 0.5 : 0.3) * light})`
    ctx.beginPath()
    ctx.moveTo(view.x + (radius - length / 2) * cos, view.y + (radius - length / 2) * sin)
    ctx.lineTo(view.x + (radius + length / 2) * cos, view.y + (radius + length / 2) * sin)
    ctx.stroke()
  }
}

// the fluid goes under the glass ball, and the screen pass draws the glass over it
const drawFluid = (radius, amount, time) => {
  if (amount <= 0) return
  const surface = view.y + radius - 2 * radius * GLASS.fill * amount
  const turn = time * 0.6
  const fill = ctx.createLinearGradient(
    view.x + Math.cos(turn) * radius,
    view.y + Math.sin(turn) * radius,
    view.x - Math.cos(turn) * radius,
    view.y - Math.sin(turn) * radius
  )
  FLUID.forEach((color, index) => {
    fill.addColorStop(index / (FLUID.length - 1), `rgba(${color}, ${0.85 * amount})`)
  })
  ctx.save()
  ctx.beginPath()
  ctx.arc(view.x, view.y, radius, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(view.x - radius, view.y + radius)
  for (let part = 0; part <= 32; part++) {
    const x = radius * (part / 16 - 1)
    ctx.lineTo(view.x + x, surface + Math.sin((x / radius) * 4 + time * 2.4) * radius * 0.05)
  }
  ctx.lineTo(view.x + radius, view.y + radius)
  ctx.fill()
  ctx.restore()
}

// the icon of the call to action is a small copy of the rings, as lines of dashes
const drawIcon = (position) => {
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

  // each ring goes to its target in steps, one word at a time, and clicks at each word
  // the target has no end: after the last word comes the first one
  for (const wheel of WHEELS) {
    wheel.position += (wheel.target - wheel.position) * ease
    if (Math.round(wheel.position) !== wheel.clicked) {
      wheel.clicked = Math.round(wheel.position)
      click()
    }
  }
  const [cities, days, months] = WHEELS
  const behind = cities.target - cities.position
  const city = wrap(CITIES, cities.target)
  const settled = 1 - smoothstep(0.02, 0.35, Math.abs(behind))
  // the ticks light up when all the rings are at rest, and go out when one turns
  const isStill = WHEELS.every((wheel) => Math.abs(wheel.target - wheel.position) < 0.02)
  trace = !isStill ? 0 : isMotionReduced ? 1 : Math.min(trace + dt / PATH.seconds, 1)
  const isUnlocked =
    trace === 1 &&
    days.line.itemAt(days.target).word === SECRET.day &&
    months.line.itemAt(months.target).word === SECRET.month
  fluid += ((isUnlocked ? 1 : 0) - fluid) * (isMotionReduced ? 1 : 1 - Math.exp(-dt * 2))
  if (isUnlocked !== isToldOpen) {
    isToldOpen = isUnlocked
    if (isUnlocked) status.textContent = 'You found the combination'
  }

  ctx.clearRect(0, 0, view.width, view.height)
  const size = LABEL.size * view.radius
  const ball = LABEL.from * view.radius + size * 0.6
  const [outer, dial, dayRing, dial2, monthRing, core] = ringsOf(
    size,
    LABEL.from * view.radius,
    ball
  )
  Object.assign(cities, outer)
  Object.assign(days, dayRing)
  Object.assign(months, monthRing)
  const glass = core.radius * GLASS.size
  drawFluid(glass, fluid, time)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `500 ${size}px ${SANS}`
  const found = [1, smoothstep(0.42, 0.5, trace), smoothstep(0.92, 1, trace)]
  WHEELS.forEach((wheel, index) => {
    const shape = { ...wheel, ball }
    const late = wheel.target - wheel.position
    // a fast turn leaves a short smear behind each word
    for (let ghost = 3; ghost >= 1 && Math.abs(late) > 0.25; ghost--) {
      drawRing(shape, wheel.position - late * 0.07 * ghost, 0.22 / ghost, 0)
    }
    drawRing(shape, wheel.position, 1, found[index])
  })
  const up = smooth(clamp01(trace * 2))
  const down = smooth(clamp01(trace * 2 - 1))
  drawDial({ ...dial, ball, first: dial }, cities.position, 0, PATH.angle * up)
  drawDial(
    { ...dial2, ball, first: dial },
    days.position,
    PATH.angle * (1 - down),
    PATH.angle
  )
  drawDial({ ...core, ball, first: dial }, months.position, 0, 0)

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
  drawIcon(cities.position)

  crt?.draw({
    picture,
    hub: view,
    radius: NOTHING,
    small: { x: view.x, y: view.y, radius: glass, opacity: GLASS.opacity },
    ratio: view.ratio,
    yaw: 0,
    city: [0, 0],
    glow: 0,
  })
}

// the ring of words under a point of the screen, and the word under it as a count of
// steps. null where there is no ring, and slot null where there is no word
const hitAt = ({ clientX, clientY }) => {
  const box = canvas.getBoundingClientRect()
  const dx = (clientX - box.left) * view.ratio - view.x
  const dy = (clientY - box.top) * view.ratio - view.y
  const size = LABEL.size * view.radius
  const distance = Math.hypot(dx, dy)
  const wheel = WHEELS.find((each) => Math.abs(distance - each.radius) < size * 0.7)
  if (!wheel) return null
  // the angle from the active word, up the ring
  const angle = Math.atan2(-dy, -dx) - (wheel.anchor - Math.PI)
  const spot = wheel.line.along(wheel.position) - (angle * wheel.radius) / size
  const first = Math.round(wheel.position) - 8
  for (let slot = first; slot <= first + 16; slot++) {
    const isOn = Math.abs(spot - wheel.line.middleOf(slot)) < wheel.line.itemAt(slot).em / 2 + 0.3
    if (isOn) return { wheel, slot }
  }
  return { wheel, slot: null }
}

const handleWheel = (event) => {
  // the mouse wheel turns the ring under the pointer, or else the cities
  const wheel = hitAt(event)?.wheel ?? WHEELS[0]
  // a mouse wheel gives lines, and a trackpad gives pixels
  wheelSum += event.deltaY * (event.deltaMode === 1 ? 16 : 1)
  const steps = Math.trunc(wheelSum / STEP_PX.wheel)
  wheelSum -= steps * STEP_PX.wheel
  wheel.target += steps
}

const handlePointerDown = (event) => {
  if (event.target.closest('a')) return
  const wheel = hitAt(event)?.wheel ?? WHEELS[0]
  drag = { y: event.clientY, wheel, from: wheel.target, hasMoved: false }
}

const handlePointerMove = (event) => {
  if (!drag) {
    pin.style.cursor = (hitAt(event)?.slot ?? null) === null ? '' : 'pointer'
    return
  }
  const moved = event.clientY - drag.y
  if (Math.abs(moved) > 8) drag.hasMoved = true
  // a drag up brings the next words up
  if (drag.hasMoved) drag.wheel.target = drag.from - Math.round(moved / STEP_PX.drag)
}

const handlePointerUp = (event) => {
  if (!drag) return
  // a press with no move is a click, and a click on a word brings it to the middle
  const hit = drag.hasMoved ? null : hitAt(event)
  drag = null
  if ((hit?.slot ?? null) !== null) hit.wheel.target = hit.slot
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
  WHEELS[0].target += steps
}

// the words are measured at a size of 100 pixels
ctx.font = `500 100px ${SANS}`
ctx.letterSpacing = '-3px'
// the three rings of words. position and target are counts of steps from the first word
// and have no end. clicked is the word at the middle, for the click sound. radius and
// height come from the layout at each frame
const WHEELS = [
  { line: lineOf(CITIES.map((city) => city.name)), anchor: Math.PI, isOuter: true },
  { line: lineOf(DAYS), anchor: Math.PI + PATH.angle, isOuter: false },
  { line: lineOf(MONTHS), anchor: Math.PI, isOuter: false },
].map((wheel) => ({ ...wheel, position: 0, target: 0, clicked: 0, radius: 0, height: 1 }))
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
