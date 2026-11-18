import { dotLattice } from './lattice.js?v=1'

// the globe is bigger than the screen, so only a part of it shows. its radius is a part of the
// screen diagonal, and its top is this far in from the left and from the top of the screen
const GLOBE = { radius: 0.75, left: 0.08, top: 0.05 }
// distance between two dots on screen, in CSS pixels
const DOT_GAP = 12
// the smallest angle between two dots, so a very large screen does not get too many
const MIN_SPACING = 0.0085
// the globe leans, so its rows of dots cross the screen at an angle
const LEAN = { roll: -0.42, pitch: 0.5 }
const TURN_SECONDS = 240
// the light comes from behind the globe. angle is its direction on the screen, and behind is
// how far it is behind the globe: more behind gives a thinner crescent
const LIGHT = { angle: 0.85, behind: 0.6 }
const SHADES = 12
// the middle color is the supabase green
const DEEP = [18, 112, 74]
const GREEN = [62, 207, 142]
const WHITE = [226, 255, 240]

const canvas = document.querySelector('#scene')
const ctx = canvas.getContext('2d')
const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const mix = (from, to, amount) => from.map((part, index) => Math.round(part + (to[index] - part) * amount))

// the color of a dot for each step of light: deep green in the dim part, green for most
// of the crescent, and pale green only next to the edge
const RAMP = Array.from({ length: SHADES }, (_, shade) => {
  const light = ((shade + 1) / SHADES) ** 1.5
  const color = light < 0.8 ? mix(DEEP, GREEN, light / 0.8) : mix(GREEN, WHITE, (light - 0.8) / 0.2)
  return `rgba(${color.join(', ')}, ${light ** 0.7})`
})

const view = { width: 1, height: 1, ratio: 1, radius: 1, x: 0, y: 0 }
const pointer = { x: 0.5, y: 0.5 }
const light = { angle: LIGHT.angle, behind: LIGHT.behind }
const buckets = Array.from({ length: SHADES }, () => [])
let dots = new Float32Array(0)
let previous = 0

const resize = () => {
  const { clientWidth: width, clientHeight: height } = canvas.parentElement
  const ratio = Math.min(devicePixelRatio, 2)
  canvas.width = width * ratio
  canvas.height = height * ratio
  const radius = GLOBE.radius * Math.hypot(width, height)
  Object.assign(view, {
    width: width * ratio,
    height: height * ratio,
    ratio,
    radius: radius * ratio,
    x: GLOBE.left * width * ratio,
    y: (GLOBE.top * height + radius) * ratio,
  })
  dots = dotLattice(Math.max(DOT_GAP / radius, MIN_SPACING))
}

const frame = (now) => {
  requestAnimationFrame(frame)
  const time = isMotionReduced ? 0 : now / 1000
  const dt = Math.min(now / 1000 - previous, 0.1)
  previous = now / 1000

  // the pointer moves the light: across the screen for a thin or wide crescent, and up and
  // down to move it along the edge of the globe
  const ease = isMotionReduced ? 1 : 1 - Math.exp(-dt * 3)
  light.behind += (LIGHT.behind + (0.5 - pointer.x) * 0.7 + Math.sin(time * 0.25) * 0.06 - light.behind) * ease
  light.angle += (LIGHT.angle + (0.5 - pointer.y) * 0.9 - light.angle) * ease
  const lx = Math.cos(light.angle) * Math.cos(light.behind)
  const ly = Math.sin(light.angle) * Math.cos(light.behind)
  const lz = -Math.sin(light.behind)
  // the light is full only at the edge of the globe, on the side of the light
  const full = Math.cos(light.behind)

  // the globe turns on its own axis, then leans. these are the rows of that turn as one matrix
  const spin = (time / TURN_SECONDS) * Math.PI * 2
  const [cs, ss] = [Math.cos(spin), Math.sin(spin)]
  const [cp, sp] = [Math.cos(LEAN.pitch), Math.sin(LEAN.pitch)]
  const [cr, sr] = [Math.cos(LEAN.roll), Math.sin(LEAN.roll)]
  const m00 = cr * cs - sr * sp * ss
  const m01 = -sr * cp
  const m02 = cr * ss + sr * sp * cs
  const m10 = sr * cs + cr * sp * ss
  const m11 = cr * cp
  const m12 = sr * ss - cr * sp * cs
  const m20 = -cp * ss
  const m21 = sp
  const m22 = cp * cs

  for (const bucket of buckets) bucket.length = 0
  for (let index = 0; index < dots.length; index += 3) {
    const px = dots[index]
    const py = dots[index + 1]
    const pz = dots[index + 2]
    // the far half of the globe is not seen
    const z = m20 * px + m21 * py + m22 * pz
    if (z < 0) continue
    const x = m00 * px + m01 * py + m02 * pz
    const y = m10 * px + m11 * py + m12 * pz
    const lit = (x * lx + y * ly + z * lz) / full
    if (lit <= 0) continue
    const sx = view.x + x * view.radius
    const sy = view.y - y * view.radius
    if (sx < -4 || sx > view.width + 4 || sy < -4 || sy > view.height + 4) continue
    buckets[Math.min(Math.floor(lit * SHADES), SHADES - 1)].push(sx, sy)
  }

  ctx.clearRect(0, 0, view.width, view.height)
  for (const [shade, bucket] of buckets.entries()) {
    // each point is a small square, and a square in more light is bigger
    const side = (1.8 + (1.8 * (shade + 1)) / SHADES) * view.ratio
    ctx.fillStyle = RAMP[shade]
    ctx.beginPath()
    for (let index = 0; index < bucket.length; index += 2) {
      // whole pixels keep the edges of a square sharp
      ctx.rect(Math.round(bucket[index] - side / 2), Math.round(bucket[index + 1] - side / 2), side, side)
    }
    ctx.fill()
  }

  // a thin line of light on the edge of the globe, where the light comes over it
  ctx.lineWidth = 1.2 * view.ratio
  const steps = 360
  for (let step = 0; step < steps; step++) {
    const from = (step / steps) * Math.PI * 2
    const to = ((step + 1) / steps) * Math.PI * 2
    const lit = clamp01((Math.cos(from) * lx + Math.sin(from) * ly) / full)
    if (lit <= 0) continue
    ctx.strokeStyle = `rgba(${mix(GREEN, WHITE, lit ** 3).join(', ')}, ${lit ** 2})`
    ctx.beginPath()
    // the canvas has y down, so the arc goes the other way around
    ctx.arc(view.x, view.y, view.radius, -from, -to, true)
    ctx.stroke()
  }
}

const handlePointerMove = (event) => {
  pointer.x = event.clientX / innerWidth
  pointer.y = event.clientY / innerHeight
}

new ResizeObserver(resize).observe(canvas.parentElement)
resize()
addEventListener('pointermove', handlePointerMove)
requestAnimationFrame(frame)
