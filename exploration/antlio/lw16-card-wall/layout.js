export const CAMERA_Z = 2000
export const ROWS = [-2, -1, 0, 1, 2]
export const mod = (value, period) => ((value % period) + period) % period

export function layoutWall(width, height) {
  const screenWidth = width < 650 ? Math.max(110, width * .32) : Math.min(240, width / 7.9)
  const depth = 960
  const factor = (CAMERA_Z + depth) / CAMERA_Z
  const cardWidth = screenWidth * factor
  const cardHeight = cardWidth * 1.4
  const gap = cardWidth * .115
  const pitch = cardWidth + gap
  const rowPitch = cardHeight + gap
  const projectedRadius = width * .62
  const distance = CAMERA_Z + depth
  const ratio = projectedRadius / CAMERA_Z
  const radius = distance * (ratio * ratio + ratio * Math.sqrt(1 + ratio * ratio))
  const halfAngle = Math.min(1.4, Math.acos(radius / (distance + radius)) + .04)
  const length = radius * halfAngle * 2
  const room = { radius, depth, halfAngle, length, middle: length / 2 }
  return { room, cardWidth, cardHeight, pitch, rowPitch, width, height }
}

export function cardPoint(layout, center, row, u, v) {
  const { radius, depth, middle } = layout.room
  const longitude = (center + (u - .5) * layout.cardWidth - middle) / radius
  const latitude = (row * layout.rowPitch + (v - .5) * layout.cardHeight) / radius
  const ring = radius * Math.cos(latitude)
  return {
    x: ring * Math.sin(longitude),
    y: radius * Math.sin(latitude),
    z: ring * Math.cos(longitude) - radius - depth,
  }
}
