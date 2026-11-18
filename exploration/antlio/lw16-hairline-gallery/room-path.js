export function makeRoom({ flatWidth, radius, depth, front }) {
  const half = flatWidth / 2 + radius
  const side = front + depth - radius
  const corner = Math.PI * radius / 2
  const length = side * 2 + corner * 2 + flatWidth
  return { flatWidth, radius, depth, front, half, side, corner, length, middle: length / 2 }
}

export function sampleRoom(room, distance) {
  const { flatWidth, radius, depth, front, half, side, corner } = room
  let s = distance
  if (s < side) return { x: -half, z: front - s, tx: 0, tz: -1 }
  s -= side
  if (s < corner) {
    const a = s / radius
    return { x: -half + radius - radius * Math.cos(a), z: -depth + radius - radius * Math.sin(a), tx: Math.sin(a), tz: -Math.cos(a) }
  }
  s -= corner
  if (s < flatWidth) return { x: -flatWidth / 2 + s, z: -depth, tx: 1, tz: 0 }
  s -= flatWidth
  if (s < corner) {
    const a = s / radius
    return { x: flatWidth / 2 + radius * Math.sin(a), z: -depth + radius - radius * Math.cos(a), tx: Math.cos(a), tz: Math.sin(a) }
  }
  s -= corner
  return { x: half, z: -depth + radius + s, tx: 0, tz: 1 }
}

