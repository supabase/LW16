import { fillGlyphPath, GLYPH_SIZE } from './glyph-path.js'

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
  base: .6, time: 0, effectTime: 0, playing: !reduced.matches, over: null, dragging: false,
  focused: false, selected: 0, visible: true,
}
let width = 0, height = 0, ratio = 1, fit = 1, left = 0, top = 0
let palette = {}, lastDraw = '', frame = 0, lastTime = null, lastPaint = -Infinity
function spring(value) { return { x: value, v: 0, target: value } }
const yaw = spring(.6), tilt = spring(.6)
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

// the geography comes from particle density, with no coastline strokes
const particles = []
let seed = 16
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const landResponse = await fetch('./land-particles.json')
if (!landResponse.ok) throw new Error('Unable to load the particle map')
const landPoints = await landResponse.json()
for (const point of landPoints) {
  const radius = .997 + random() * .003
  particles.push({ point: point.map(n => n * radius), brightness: .45 + random() * .55, size: random() < .82 ? .85 : 1.35, phase: random() * TAU, land: true })
}
// a few faint particles keep the empty ocean from feeling like a cutout
for (let i = 0; i < 1500; i++) {
  const latitude = Math.asin(random() * 2 - 1), longitude = random() * TAU
  particles.push({ point: [Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude), Math.cos(latitude) * Math.cos(longitude)], brightness: .06, size: .65, phase: 0, land: false })
}
let overlay = null
export function registerOverlay(drawOverlay) { overlay = drawOverlay; lastDraw = ''; draw(); wake() }
function ringPoints(spec, y = yaw.x, t = tilt.x) {
  return Array.from({ length: 193 }, (_, i) => {
    const a = i / 192 * TAU
    return project([Math.cos(a), Math.sin(a) * Math.sin(spec.inclination), Math.sin(a) * Math.cos(spec.inclination)], y, t, R * spec.radius)
  })
}
function screen(point) { return { x: left + point[0] * fit, y: top + point[1] * fit } }
function circle(x, y, radius) {
  return Array.from({ length: 129 }, (_, i) => [x + Math.cos(i / 128 * TAU) * radius, y + Math.sin(i / 128 * TAU) * radius])
}function draw() {
  if (!ctx || !width) return
  const key = [yaw.x, tilt.x, state.time, state.effectTime].map(n => n.toFixed(4)).join(',') + state.selected
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
  const buckets = Array.from({ length: 12 }, () => [])
  for (const particle of particles) {
    const p = project(particle.point)
    if (p[2] <= .02) continue
    const pixel = screen(p)
    if (pixel.x < -2 || pixel.x > width + 2 || pixel.y < -2 || pixel.y > height + 2) continue
    const shimmer = particle.land ? .92 + .08 * Math.sin(state.time * .6 + particle.phase) : 1
    const strength = particle.brightness * (.2 + .8 * p[2]) * shimmer
    buckets[Math.min(11, Math.floor(strength * 12))].push([pixel.x, pixel.y, particle.size])
  }
  ctx.fillStyle = palette.hi
  buckets.forEach((bucket, i) => {
    ctx.beginPath()
    for (const [x, y, size] of bucket) ctx.rect(x, y, size, size)
    ctx.globalAlpha = .09 + i / 11 * .77
    ctx.fill()
  })
  ctx.globalAlpha = 1
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
  if (overlay) {
    ctx.save()
    overlay({ ctx, time: state.effectTime, reduced: reduced.matches, project: point => { const p = project(point); return { ...screen(p), depth: p[2] } }, colors: palette })
    ctx.restore()
  }

}
function pick(point) {
  let best = 0, distance = Infinity
  specs.forEach((spec, i) => {
    for (const p of ringPoints(spec, state.base, .6)) {
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
  tilt.target = .6 + (state.over && !state.dragging ? Math.tanh((state.over[1] - CY) / 90) * reach * .5 : 0)
  const selected = state.over ? pick(state.over) : 0
  if (selected !== state.selected) { state.selected = selected; lastDraw = '' }
}
function tick(now) {
  const dt = lastTime === null ? 1 / 60 : Math.min((now - lastTime) / 1000, .05)
  lastTime = now
  const touring = state.playing && !reduced.matches && !state.over && !state.focused
  const ambient = state.playing && !reduced.matches && Boolean(overlay)
  if (ambient) state.effectTime += dt
  if (touring) { state.time += dt; state.base += .096 * dt }
  retarget()
  const movingYaw = step(yaw, dt), movingTilt = step(tilt, dt)
  // keep the spring clock at display rate and the glyph painting at 30 fps
  if (now - lastPaint >= 1000 / 30 || (!touring && !ambient && !movingYaw && !movingTilt)) {
    draw()
    lastPaint = now
  }
  frame = (touring || ambient || movingYaw || movingTilt) && state.visible && !document.hidden ? requestAnimationFrame(tick) : 0
}
function wake() { if (!frame && state.visible && !document.hidden) { lastTime = null; frame = requestAnimationFrame(tick) } }
function resize() {
  const box = figure.getBoundingClientRect()
  width = box.width; height = box.height
  ratio = Math.min(devicePixelRatio * (visualViewport?.scale ?? 1), Math.sqrt(16_000_000 / (width * height)))
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
  const radius = width < 768 ? Math.min(width * .68, 360) : Math.min(width * .44, 430)
  const centerY = height * (width < 768 ? .58 : .70)
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
