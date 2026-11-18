import { registerOverlay } from './globe.js'

// the ticket counts in this study are fictional preview data
const cities = [
  { lat: 51.51, lon: -.13, count: 8 },
  { lat: 40.71, lon: -74.01, count: 10 },
  { lat: 37.77, lon: -122.42, count: 14 },
  { lat: -23.55, lon: -46.63, count: 4 },
  { lat: -33.92, lon: 18.42, count: 2 },
  { lat: -1.29, lon: 36.82, count: 3 },
  { lat: 25.2, lon: 55.27, count: 9 },
  { lat: 1.35, lon: 103.82, count: 12 },
  { lat: 35.68, lon: 139.69, count: 8 },
  { lat: -33.87, lon: 151.21, count: 3 },
]
function vector(city) {
  const lat = city.lat * Math.PI / 180, lon = city.lon * Math.PI / 180
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]
}
function lightColor(hex, alpha) {
  const color = hex.replace('#', '')
  const red = parseInt(color.slice(0, 2), 16), green = parseInt(color.slice(2, 4), 16), blue = parseInt(color.slice(4, 6), 16)
  return `rgba(${red},${green},${blue},${alpha})`
}
function drawBeacon(ctx, city, project, phase, time, colors, reduced) {
  if (city.count < 4) return
  const density = Math.min(1, Math.log2(city.count / 3) / 3)
  const radialHeight = .10 + density * .28
  const columns = 1 + Math.floor(density * 4)
  const normal = vector(city)
  const eastLength = Math.hypot(normal[0], normal[2])
  const east = [normal[2] / eastLength, 0, -normal[0] / eastLength]
  const north = [normal[1] * east[2], eastLength, -normal[1] * east[0]]
  for (let i = 0; i < columns; i++) {
    // each root sits on the sphere and lifts along its own surface normal
    const offset = (i - (columns - 1) / 2) * .008
    const root = normal.map((n, axis) => n + east[axis] * offset + north[axis] * (i % 2) * .003)
    const length = Math.hypot(...root)
    const unit = root.map(n => n / length)
    const h = radialHeight * (i === Math.floor(columns / 2) ? 1 : .66 + ((i * 7 + phase) % 5) * .06)
    const base = project(unit)
    const tip = project(unit.map(n => n * (1 + h)))
    const dx = tip.x - base.x, dy = tip.y - base.y
    const projectedLength = Math.hypot(dx, dy)
    if (projectedLength < 1) continue
    const body = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y)
    body.addColorStop(0, lightColor(colors.hi, .16))
    body.addColorStop(.15, lightColor(colors.hi, .4 + density * .25))
    body.addColorStop(.7, lightColor(colors.hi, .18))
    body.addColorStop(1, lightColor(colors.hi, 0))
    ctx.beginPath()
    ctx.moveTo(base.x, base.y)
    ctx.lineTo(tip.x, tip.y)
    ctx.lineWidth = .8
    ctx.strokeStyle = body
    ctx.stroke()
    if (reduced) continue
    const progress = (time * .28 + phase * .13 + i * .23) % 1
    const tailProgress = Math.max(0, progress - 24 / projectedLength)
    const head = { x: base.x + dx * progress, y: base.y + dy * progress }
    const tail = { x: base.x + dx * tailProgress, y: base.y + dy * tailProgress }
    const shimmer = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y)
    shimmer.addColorStop(0, lightColor(colors.hi, 0))
    shimmer.addColorStop(1, lightColor(colors.hi, (.7 + density * .3) * Math.sin(Math.PI * progress)))
    ctx.beginPath()
    ctx.moveTo(tail.x, tail.y)
    ctx.lineTo(head.x, head.y)
    ctx.lineWidth = 1.1
    ctx.strokeStyle = shimmer
    ctx.stroke()
  }
}
registerOverlay(({ ctx, project, colors, reduced, time }) => {
  for (const [index, city] of cities.entries()) {
    if (project(vector(city)).depth <= .12) continue
    drawBeacon(ctx, city, project, index, time, colors, reduced)
  }
})
