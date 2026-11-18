import { click, settle, unlock } from './click.js?v=4'
import { MIRROR, createCrt } from './crt.js?v=29'

// the ten cities, from the first to start to the last. lat and lon are in degrees, and
// offset is the utc offset in december. the counts and the states are made up
const CITIES = [
  { name: 'Sydney', lat: -33.87, lon: 151.21, offset: 11, people: 180, status: 'open' },
  { name: 'Tokyo', lat: 35.68, lon: 139.69, offset: 9, people: 300, status: 'nearing' },
  { name: 'Singapore', lat: 1.35, lon: 103.82, offset: 8, people: 300, status: 'full' },
  { name: 'Bengaluru', lat: 12.97, lon: 77.59, offset: 5.5, people: 300, status: 'nearing' },
  { name: 'Berlin', lat: 52.52, lon: 13.4, offset: 1, people: 300, status: 'open' },
  { name: 'Lagos', lat: 6.52, lon: 3.38, offset: 1, people: 120, status: 'open' },
  { name: 'London', lat: 51.51, lon: -0.13, offset: 0, people: 240, status: 'nearing' },
  { name: 'Sao Paulo', lat: -23.55, lon: -46.63, offset: -3, people: 150, status: 'open' },
  { name: 'New York', lat: 40.71, lon: -74.01, offset: -5, people: 260, status: 'full' },
  { name: 'San Francisco', lat: 37.77, lon: -122.42, offset: -8, people: 280, status: 'nearing' },
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
// the angle between two city names on the wheel. ten names go around in less than one turn,
// so a name comes back only at the two ends of the wheel, where it is a smear
const STEP = (10 * Math.PI) / 180
// the globe is the hub of the wheel, and the names go out to its left. its center is on the
// right edge of the screen, so one half of it shows. it is big: the two ends of the wheel go
// off the top and the bottom of the screen. its radius is a part of the screen height, and
// not more than a part of the width, so the names have room
const HUB = { y: 0.52, ofHeight: 0.4, ofWidth: 0.28 }
// the names, in globe radii: where a name starts, how far the active name moves out, and its size
const LABEL = { from: 1.52, push: 0.3, size: 0.14 }
// a name starts to go away at the first angle from the middle of the wheel, and is gone at
// the second, in radians. the tube screen pass smears the names before they get there
const NAME_FADE = [1.2, 1.65]
// the globe comes to rest with the longitude of the active city this far from its middle,
// on the side of the names
const FACE = -0.6
const INK = '232, 232, 230'
// the map of the land: its size in pixels, the radius of one point of land on it, and how
// soft its edges are. the size must be powers of two
const LAND = { w: 512, h: 256, dot: 1.3, blur: 2.5 }
// the wheel goes one city for this number of pixels of the mouse wheel, and of a drag
const STEP_PX = { wheel: 80, drag: 56 }
const SANS = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif'

const canvas = document.querySelector('#wheel')
const cells = document.querySelector('#cells')
const cta = document.querySelector('#cta')
const pin = canvas.parentElement
const status = document.querySelector('#status')
// the wheel draws on a 2D canvas, and the page shows it through the tube screen pass
// without WebGL the 2D picture goes on the page as it is
const crt = createCrt(canvas)
const picture = crt ? document.createElement('canvas') : canvas
const ctx = picture.getContext('2d')
const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const smooth = (value) => value * value * (3 - 2 * value)
const smoothstep = (from, to, value) => smooth(clamp01((value - from) / (to - from)))
const radians = (degrees) => (degrees * Math.PI) / 180
// a slot has no end, so after the last city comes the first one
const cityAt = (slot) => CITIES[((slot % CITIES.length) + CITIES.length) % CITIES.length]

// every city is a row of a table in the page, for a screen reader
for (const city of CITIES) {
  const size = Math.abs(city.offset)
  const zone = size === 0 ? 'UTC' : `UTC${city.offset > 0 ? '+' : '−'}${size % 1 ? `${Math.floor(size)}:30` : size}`
  city.session = `${SESSION} ${zone}`
  city.count = `${city.people} people`
  const row = document.querySelector('#cities').insertRow()
  row.append(Object.assign(document.createElement('th'), { scope: 'row', textContent: city.name }))
  for (const text of [city.session, city.count, STATUS[city.status].label]) {
    row.insertCell().textContent = text
  }
}

const view = { width: 1, height: 1, ratio: 1, x: 0, y: 0, radius: 1 }
const turn = { yaw: 0 }
let position = 0
let previous = 0
let shown = null
// the city the wheel goes to, as a count of steps from the first city. it can be below 0
// and above the number of cities
let target = 0
let wheelSum = 0
let drag = null
let statusTimer = 0
// the name at the middle of the wheel. the wheel clicks each time it changes
let clicked = 0
// the city of the last status sound. the first city has no sound
let settledOn = CITIES[0]
// the small globe of the call to action: its place on the canvas, its radius at rest, and
// how far it is open, from 0 to 1
const lens = { x: 0, y: 0, radius: 0, open: 0 }
// a text drawn this far off the canvas leaves only its soft shadow on it
const OFF_CANVAS = 20000
// the small globe is this much bigger when the pointer or the focus is on the link
const OPEN_SCALE = 1.14
// the width of the cells as one row, and as one column
const cellsWidth = { row: 0, column: 0 }

// the land of the earth as a soft map, with longitude across and latitude down. the points
// are directions from the center of the earth, spread evenly over the land
const drawLand = (points) => {
  const map = document.createElement('canvas')
  map.width = LAND.w
  map.height = LAND.h
  const pen = map.getContext('2d')
  pen.fillRect(0, 0, LAND.w, LAND.h)
  pen.filter = `blur(${LAND.blur}px)`
  pen.fillStyle = '#fff'
  pen.beginPath()
  for (const [x, y, z] of points) {
    const latitude = Math.asin(y)
    const across = (Math.atan2(x, z) / (Math.PI * 2) + 0.5) * LAND.w
    const down = (0.5 - latitude / Math.PI) * LAND.h
    // a degree of longitude is shorter near the poles, so a point is wider on the map there
    const wide = Math.min(LAND.dot / Math.cos(latitude), 12)
    // a point near one side of the map draws at the other side too, so the two sides join
    const copies = across < 16 ? [across, across + LAND.w] : across > LAND.w - 16 ? [across, across - LAND.w] : [across]
    for (const at of copies) {
      pen.moveTo(at + wide, down)
      pen.ellipse(at, down, wide, LAND.dot, 0, 0, Math.PI * 2)
    }
  }
  pen.fill()
  return map
}

// the words of the link can go on two lines, which moves the small globe
const measureLens = () => {
  const frameBox = canvas.getBoundingClientRect()
  const box = document.querySelector('#lens').getBoundingClientRect()
  Object.assign(lens, {
    x: (box.left - frameBox.left + box.width / 2) * view.ratio,
    y: (box.top - frameBox.top + box.height / 2) * view.ratio,
    // the globe gets bigger when it opens, and it must stay in its box
    radius: (box.height / 2 / OPEN_SCALE) * view.ratio,
  })
  pin.style.setProperty('--small-x', `${lens.x / view.ratio}px`)
  pin.style.setProperty('--small-y', `${lens.y / view.ratio}px`)
  pin.style.setProperty('--small-radius', `${box.height / 2}px`)
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
  // the lines of the tube screen in style.css leave the two globes out
  pin.style.setProperty('--globe-radius', `${view.radius / ratio}px`)
  pin.style.setProperty('--globe-y', `${view.y / ratio}px`)
  measureLens()
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

  // the globe turns the short way, until the active city faces the names
  const city = cityAt(target)
  const rest = FACE - radians(city.lon)
  const away = Math.atan2(Math.sin(rest - turn.yaw), Math.cos(rest - turn.yaw))
  turn.yaw += away * (isMotionReduced ? 1 : 1 - Math.exp(-dt * 5))

  ctx.clearRect(0, 0, view.width, view.height)

  // the names are the spokes of the wheel. the name that points to the left is the active one
  const size = LABEL.size * view.radius
  const reach = LABEL.from * view.radius
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.font = `500 ${size}px ${SANS}`
  ctx.letterSpacing = `${-0.03 * size}px`
  const drawName = (slot, at, alpha) => {
    // the next cities are below the active one
    const angle = (at - slot) * STEP
    const near = 1 - clamp01(Math.abs(slot - at))
    const fade = 1 - smoothstep(...NAME_FADE, Math.abs(angle))
    if (fade <= 0) return
    const { name } = cityAt(slot)
    ctx.save()
    ctx.translate(view.x, view.y)
    ctx.rotate(angle)
    ctx.fillStyle = `rgba(${INK}, ${(0.42 + 0.58 * smooth(near)) * fade * alpha})`
    ctx.fillText(name, -reach - LABEL.push * view.radius * smooth(near), 0)
    ctx.restore()
  }
  const first = Math.floor(position) - 14
  for (let slot = first; slot <= first + 28; slot++) {
    // a fast turn leaves a short smear behind each name
    for (let ghost = 3; ghost >= 1 && Math.abs(behind) > 0.25; ghost--) {
      drawName(slot, position - behind * 0.07 * ghost, 0.22 / ghost)
    }
    drawName(slot, position, 1)
  }

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
  const nameStart = view.x - reach - LABEL.push * view.radius - city.em * size
  const end = (nameStart - size * 0.6) / view.ratio
  // the cells are one row before the name. a long name leaves room for one column only,
  // and on a narrow screen the cells have no room there, so they go under the wordmark
  const isStacked = end - cellsWidth.row < 20
  const isDocked = end - cellsWidth.column < 20
  cells.classList.toggle('is-stacked', isStacked && !isDocked)
  cells.classList.toggle('is-docked', isDocked)
  cells.style.translate = isDocked ? '' : `${end}px ${view.y / view.ratio}px`
  const settled = 1 - smoothstep(0.02, 0.35, Math.abs(behind))
  cells.style.opacity = settled
  if (settled > 0.98 && settledOn !== city) {
    settledOn = city
    settle(city.status)
  }

  // the glass shows the start of each name at its rim. the tube screen pass reads it from
  // this small copy of the names, which the globe hides. each name of the copy starts at
  // the same distance from the center of the globe
  if (crt) {
    const small = MIRROR.size * view.radius
    ctx.font = `500 ${small}px ${SANS}`
    ctx.letterSpacing = `${-0.03 * small}px`
    ctx.textAlign = 'left'
    ctx.shadowOffsetX = OFF_CANVAS
    for (let slot = first; slot <= first + 28; slot++) {
      const angle = (position - slot) * STEP
      // the glass shows an eighth of a turn of the copy on each side
      if (Math.abs(angle) > 1) continue
      const near = 1 - clamp01(Math.abs(slot - position))
      const { name } = cityAt(slot)
      ctx.save()
      // the text is off the canvas, and its shadow is at the place of the name
      ctx.translate(view.x - OFF_CANVAS, view.y)
      ctx.rotate(angle)
      ctx.shadowColor = `rgba(${INK}, ${0.42 + 0.58 * smooth(near)})`
      // the shadow is two times as wide as the blur of a filter
      for (const soft of [MIRROR.blur, MIRROR.glow]) {
        ctx.shadowBlur = soft * view.radius * 2
        ctx.fillText(name, -MIRROR.start * view.radius, 0)
      }
      ctx.restore()
    }
    ctx.shadowOffsetX = 0
    ctx.shadowColor = 'transparent'
  }

  // the light of the city goes out while the wheel turns, and comes back at the new city
  // at rest it gets slowly stronger and weaker, about once in 5 seconds
  const pulse = isMotionReduced ? 1 : 0.72 + 0.28 * Math.sin(time * 1.25)
  // the small globe gets bigger when the pointer or the focus is on the link
  const isOpen = cta.matches(':hover, :focus-visible')
  lens.open += ((isOpen ? 1 : 0) - lens.open) * (isMotionReduced ? 1 : 1 - Math.exp(-dt * 10))
  crt?.draw({
    picture,
    hub: view,
    radius: view.radius,
    small: { x: lens.x, y: lens.y, radius: lens.radius * (1 + (OPEN_SCALE - 1) * lens.open) },
    ratio: view.ratio,
    yaw: turn.yaw,
    city: [radians(city.lat), radians(city.lon)],
    glow: settled * pulse,
  })
}

// the points of land come from the ticket globe study. without them the globe is glass only
fetch('../lw16-ticket-globe/land-particles.json')
  .then((response) => response.json())
  .then((points) => crt?.setLand(drawLand(points)))
  .catch((error) => console.warn('The map of the land did not load', error))

// the place of the name under a point of the screen, as a count of steps, or null
const slotAt = ({ clientX, clientY }) => {
  const box = canvas.getBoundingClientRect()
  const dx = (clientX - box.left) * view.ratio - view.x
  const dy = (clientY - box.top) * view.ratio - view.y
  const far = Math.hypot(dx, dy)
  // a name goes out from the globe to the left, at this angle from the active name
  const angle = Math.atan2(-dy, -dx)
  const slot = Math.round(position - angle / STEP)
  const size = LABEL.size * view.radius
  const near = 1 - clamp01(Math.abs(slot - position))
  const from = (LABEL.from + LABEL.push * smooth(near)) * view.radius
  const name = cityAt(slot)
  const isOnLine = Math.abs(position - angle / STEP - slot) * STEP * far < size * 0.7
  const isOnName = far > from - size * 0.3 && far < from + name.em * size + size * 0.3
  return isOnLine && isOnName && Math.abs(angle) < NAME_FADE[1] ? slot : null
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
  const steps = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 }[event.key]
  if (!steps) return
  event.preventDefault()
  target += steps
}

// the width of each name as a part of its font size, for the place of the cells and for clicks
ctx.font = `500 100px ${SANS}`
ctx.letterSpacing = '-3px'
for (const city of CITIES) city.em = ctx.measureText(city.name).width / 100

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
