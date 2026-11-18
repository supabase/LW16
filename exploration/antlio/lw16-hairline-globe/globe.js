import { fillGlyphPath, GLYPH_SIZE } from '../lw16-ticket-globe/glyph-path.js'

const figure = document.getElementById('figure')
const canvas = document.getElementById('drawing')
const ctx = canvas.getContext('2d')
const status = document.getElementById('status')
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const TAU = Math.PI * 2
const CX = 200, CY = 160, R = 91
const TEXT = 'SUPABASE / LAUNCH WEEK 16 / PROTOTYPE TO PETABYTE / BUILD SOMETHING BIG / '
const specs = [
  { radius: 1.23, inclination: .15, speed: .09, phase: .4 },
  { radius: 1.39, inclination: -.35, speed: -.055, phase: 2.1 },
  { radius: 1.55, inclination: .55, speed: .04, phase: 4.6 },
]
const state = {
  base: .6, time: 0, playing: !reduced.matches, over: null, dragging: false,
  focused: false, selected: 0, visible: true,
}
let width = 0, height = 0, ratio = 1, fit = 1, left = 0, top = 0
let palette = {}, lastDraw = '', frame = 0, lastTime = null, lastPaint = -Infinity
function spring(value) { return { x: value, v: 0, target: value } }
const yaw = spring(.6), tilt = spring(.32)
function step(s, dt) {
  if (reduced.matches) { s.x = s.target; s.v = 0; return false }
  const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps
  for (let i = 0; i < steps; i++) {
    s.v += (-100 * (s.x - s.target) - 18 * s.v) * h
    s.x += s.v * h
  }
  if (Math.abs(s.x - s.target) < .0001 && Math.abs(s.v) < .001) { s.x = s.target; s.v = 0; return false }
  return true
}
function project(point, y = yaw.x, t = tilt.x, radius = R) {
  const x = point[0] * Math.cos(y) - point[2] * Math.sin(y)
  const z = point[0] * Math.sin(y) + point[2] * Math.cos(y)
  return [CX + x * radius, CY - (point[1] * Math.cos(t) - z * Math.sin(t)) * radius, point[1] * Math.sin(t) + z * Math.cos(t)]
}
// split at the horizon so a far meridian never crosses the near surface
function split(points) {
  const front = [], back = []
  function segment(list, a, b) {
    const run = list.at(-1)
    const end = run?.at(-1)
    if (end && Math.hypot(end[0] - a[0], end[1] - a[1]) < .001) run.push(b)
    else list.push([a, b])
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    if ((a[2] >= 0) === (b[2] >= 0)) segment(b[2] >= 0 ? front : back, a, b)
    else {
      const t = a[2] / (a[2] - b[2]), cut = a.map((n, j) => n + (b[j] - n) * t)
      segment(a[2] >= 0 ? front : back, a, cut)
      segment(b[2] >= 0 ? front : back, cut, b)
    }
  }
  return { front, back }
}
const grids = []
for (const latitude of [-45, 0, 45]) {
  const p = latitude * Math.PI / 180
  grids.push(Array.from({ length: 129 }, (_, i) => {
    const a = i / 128 * TAU
    return [Math.cos(p) * Math.sin(a), Math.sin(p), Math.cos(p) * Math.cos(a)]
  }))
}
for (let i = 0; i < 4; i++) {
  const longitude = i / 4 * Math.PI
  grids.push(Array.from({ length: 129 }, (_, j) => {
    const a = j / 128 * TAU
    return [Math.cos(a) * Math.sin(longitude), Math.sin(a), Math.cos(a) * Math.cos(longitude)]
  }))
}

// a uniform abstract surface, with no geographic data or continent mask
const surfacePoints = []
for (let latitude = -84; latitude <= 84; latitude += 2.4) {
  const phi = latitude * Math.PI / 180
  const spacing = 2.4 / Math.max(.18, Math.cos(phi))
  for (let longitude = -180; longitude < 180; longitude += spacing) {
    const theta = longitude * Math.PI / 180
    surfacePoints.push([Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta)])
  }
}

function ringPoints(spec, y = yaw.x, t = tilt.x) {
  return Array.from({ length: 193 }, (_, i) => {
    const a = i / 192 * TAU
    return project([Math.cos(a), Math.sin(a) * Math.sin(spec.inclination), Math.sin(a) * Math.cos(spec.inclination)], y, t, R * spec.radius)
  })
}
function screen(point) { return { x: left + point[0] * fit, y: top + point[1] * fit } }
function circle(x, y, radius) {
  return Array.from({ length: 129 }, (_, i) => [x + Math.cos(i / 128 * TAU) * radius, y + Math.sin(i / 128 * TAU) * radius])
}
function draw() {
  if (!ctx || !width) return
  const key = [yaw.x, tilt.x, state.time].map(n => n.toFixed(4)).join(',') + state.selected
  if (key === lastDraw) return
  lastDraw = key
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  let offset = 0
  const glyph = (points, color, pulse = null, isClosed = false) => {
    fillGlyphPath({
      ctx, points: points.map(screen), isClosed, text: TEXT, offset,
      surface: palette.surface, color, size: GLYPH_SIZE, pulse,
    })
    offset += 1009
  }
  const orbits = specs.map(spec => split(ringPoints(spec)))
  orbits.forEach(orbit => orbit.back.forEach(run => glyph(run, palette.lo)))
  const center = screen([CX, CY])
  const radius = R * fit
  const shade = ctx.createRadialGradient(center.x - radius * .35, center.y - radius * .45, radius * .1, center.x, center.y, radius)
  shade.addColorStop(0, palette.sphereLight)
  shade.addColorStop(.72, palette.sphereMid)
  shade.addColorStop(1, palette.sphereDark)
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, TAU)
  ctx.fillStyle = shade
  ctx.fill()
  const line = (points, color, closed = false) => {
    ctx.beginPath()
    points.map(screen).forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
    if (closed) ctx.closePath()
    ctx.strokeStyle = color
    ctx.lineWidth = .9
    ctx.stroke()
  }
  grids.forEach(grid => split(grid.map(point => project(point))).front.forEach(run => line(run, palette.lineMid)))
  for (const point of surfacePoints) {
    const p = project(point)
    if (p[2] <= .02) continue
    const pixel = screen(p)
    ctx.beginPath()
    ctx.arc(pixel.x, pixel.y, Math.max(.7, radius / 330), 0, TAU)
    ctx.fillStyle = `rgba(200,200,210,${.12 + .38 * p[2]})`
    ctx.fill()
  }
  line(circle(CX, CY, R), palette.lineEdge, true)
  orbits.forEach((orbit, i) => orbit.front.forEach(run => glyph(run, palette.edge,
    i === state.selected ? { distance: state.time * 380, color: palette.hi } : null)))
  specs.forEach((spec, i) => {
    const a = state.time * spec.speed + spec.phase
    const point = project([Math.cos(a), Math.sin(a) * Math.sin(spec.inclination), Math.sin(a) * Math.cos(spec.inclination)], yaw.x, tilt.x, R * spec.radius)
    if (point[2] < 0) return
    const position = screen(point)
    ctx.beginPath()
    ctx.arc(position.x, position.y, i === state.selected ? 2.6 : 1.8, 0, TAU)
    ctx.fillStyle = i === state.selected ? palette.hi : palette.edge
    ctx.fill()
  })
}
function pick(point) {
  let best = 0, distance = Infinity
  specs.forEach((spec, i) => {
    for (const p of ringPoints(spec, state.base, .32)) {
      if (p[2] < 0) continue
      const d = Math.hypot(p[0] - point[0], p[1] - point[1])
      if (d < distance) { distance = d; best = i }
    }
  })
  return best
}
function retarget() {
  const reach = .525
  yaw.target = state.base + (state.over && !state.dragging ? Math.tanh((state.over[0] - CX) / 100) * reach : 0)
  tilt.target = .32 + (state.over && !state.dragging ? Math.tanh((state.over[1] - CY) / 90) * reach * .5 : 0)
  const selected = state.over ? pick(state.over) : 0
  if (selected !== state.selected) { state.selected = selected; lastDraw = '' }
}
function tick(now) {
  const dt = lastTime === null ? 1 / 60 : Math.min((now - lastTime) / 1000, .05)
  lastTime = now
  const touring = state.playing && !reduced.matches && !state.over && !state.focused
  if (touring) { state.time += dt; state.base += .096 * dt }
  retarget()
  const movingYaw = step(yaw, dt), movingTilt = step(tilt, dt)
  // keep the spring clock at display rate and the glyph painting at 30 fps
  if (now - lastPaint >= 1000 / 30 || (!touring && !movingYaw && !movingTilt)) {
    draw()
    lastPaint = now
  }
  frame = (touring || movingYaw || movingTilt) && state.visible && !document.hidden ? requestAnimationFrame(tick) : 0
}
function wake() { if (!frame && state.visible && !document.hidden) { lastTime = null; frame = requestAnimationFrame(tick) } }
function resize() {
  const box = figure.getBoundingClientRect()
  width = box.width; height = box.height
  ratio = Math.min(devicePixelRatio * (visualViewport?.scale ?? 1), Math.sqrt(16_000_000 / (width * height)))
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
  const radius = width < 768 ? width * .73 : Math.min(width * .52, 520)
  const centerY = width < 768 ? Math.max(height * .73, height - radius * .45) : Math.max(height * .88, height - radius * .55)
  fit = radius / R
  left = width / 2 - CX * fit; top = centerY - CY * fit
  const style = getComputedStyle(figure)
  palette = Object.fromEntries(['surface', 'hi', 'edge', 'lo'].map(key => [key, style.getPropertyValue(key === 'surface' ? '--hairline-plate' : key === 'hi' ? '--hairline-hi' : `--glyph-${key}`).trim()]))
  for (const [key, variable] of Object.entries({ lineMid: '--hairline-mid', lineEdge: '--hairline-edge', sphereLight: '--sphere-light', sphereMid: '--sphere-mid', sphereDark: '--sphere-dark' })) palette[key] = style.getPropertyValue(variable).trim()
  lastDraw = ''; draw()
}
function pointer(event) { const rect = figure.getBoundingClientRect(); return [(event.clientX - rect.left - left) / fit, (event.clientY - rect.top - top) / fit] }
let previous = null
figure.addEventListener('pointerdown', event => {
  if (event.button !== 0) return
  state.dragging = true; previous = [event.clientX, event.clientY]
  figure.setPointerCapture(event.pointerId); wake()
})
figure.addEventListener('pointermove', event => {
  state.over = pointer(event)
  if (state.dragging && previous) { state.base -= (event.clientX - previous[0]) * .006; previous = [event.clientX, event.clientY] }
  retarget(); wake()
})
figure.addEventListener('pointerleave', () => { if (!state.dragging) { state.over = null; retarget(); wake() } })
function release() { state.dragging = false; previous = null; retarget(); wake() }
figure.addEventListener('pointerup', release); figure.addEventListener('pointercancel', release); figure.addEventListener('lostpointercapture', release)
figure.addEventListener('focus', () => { state.focused = true; wake() })
figure.addEventListener('blur', () => { state.focused = false; state.over = null; retarget(); wake() })
figure.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'ArrowLeft') state.base += .16
  if (event.key === 'ArrowRight') state.base -= .16
  if (event.key === 'ArrowUp') state.over = [CX, CY - 80]
  if (event.key === 'ArrowDown') state.over = [CX, CY + 80]
  if (event.key === 'Escape') { state.base = .6; state.over = null; status.textContent = 'Globe view reset.' }
  retarget(); wake()
})
new ResizeObserver(resize).observe(figure)
window.addEventListener('resize', resize)
visualViewport?.addEventListener('resize', resize)
new IntersectionObserver(([entry]) => { state.visible = entry.isIntersecting; if (state.visible) wake(); else { cancelAnimationFrame(frame); frame = 0 } }, { threshold: 0 }).observe(figure)
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0 } else wake() })
reduced.addEventListener('change', () => { state.playing = !reduced.matches; wake() })
resize(); wake()
