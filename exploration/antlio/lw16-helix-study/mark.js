const CENTER = [54.3, 56]
const SCALE = 4.1 / 113
const STRETCH = 1.12
const TAU = Math.PI * 2

function cubic(a, b, c, d, steps = 40) {
  const points = []
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t
    points.push([u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0], u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1]])
  }
  return points
}

// paths from apps/www/public/brand-assets/supabase-icon-green-transparent.svg in the supabase/supabase repository
const upper = [
  [45.317, 2.07103],
  ...cubic([45.317, 2.07103], [48.1765, -1.53037], [53.9745, .442937], [54.0434, 5.041]),
  [54.4849, 72.2922], [9.83113, 72.2922],
  ...cubic([9.83113, 72.2922], [1.64038, 72.2922], [-2.92775, 62.8321], [2.1655, 56.4175]),
  [45.317, 2.07103],
]
const lower = [
  [63.7076, 110.284],
  ...cubic([63.7076, 110.284], [60.8481, 113.885], [55.0502, 111.912], [54.9813, 107.314]),
  [53.9738, 40.0627], [99.1935, 40.0627],
  ...cubic([99.1935, 40.0627], [107.384, 40.0627], [111.952, 49.5228], [106.859, 55.9374]),
  [63.7076, 110.284],
]
const polygons = [upper, lower].map(polygon => polygon.map(([x, y]) => [(x - CENTER[0]) * SCALE, (y - CENTER[1]) * SCALE * STRETCH]))

export function markRadius(angle) {
  const dx = Math.cos(angle), dz = Math.sin(angle)
  let radius = 0
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length - 1; i++) {
      const [px, pz] = polygon[i]
      const vx = polygon[i + 1][0] - px, vz = polygon[i + 1][1] - pz
      const cross = dx * vz - dz * vx
      if (Math.abs(cross) < 1e-10) continue
      const distance = (px * vz - pz * vx) / cross
      const segment = (px * dz - pz * dx) / cross
      if (distance > 0 && segment >= 0 && segment <= 1) radius = Math.max(radius, distance)
    }
  }
  return radius
}

export const FIN_COUNT = 44
export const OUTER_RADIUS = 5.8
const HEIGHT = 2.8
export const TWIST = .24
const THICKNESS = .008
export function finPoint(index, level, outer, side, morph = 1) {
  const angle = index / FIN_COUNT * TAU + (level - .5) * TWIST + side * THICKNESS
  const anchor = index / FIN_COUNT * TAU + TWIST / 2
  const inner = 1.0 + (markRadius(anchor) - 1.0) * morph
  const radius = outer ? OUTER_RADIUS : inner
  return [Math.cos(angle) * radius, (level - .5) * HEIGHT, Math.sin(angle) * radius]
}
