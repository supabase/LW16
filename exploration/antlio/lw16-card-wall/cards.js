const WIDTH = 600
const HEIGHT = 840
export const CARD_COUNT = 24
const PAPER = '#a9e8bb'
const INK = '#3f7655'
const TAU = Math.PI * 2
const families = ['Torus', 'Helix', 'Lattice', 'Cloud', 'Layers', 'Orbit', 'Columns', 'Ribbon']

function random(seed) {
  let value = seed >>> 0
  return () => {
    value = Math.imul(value, 1664525) + 1013904223 | 0
    return (value >>> 0) / 4294967296
  }
}

export function createCardArtwork(index) {
  const bitmap = document.createElement('canvas')
  bitmap.width = WIDTH
  bitmap.height = HEIGHT
  const ctx = bitmap.getContext('2d')
  const rng = random(index * 1013 + 1616)
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const light = ctx.createLinearGradient(0, HEIGHT, WIDTH, 0)
  light.addColorStop(0, '#ffffff12')
  light.addColorStop(1, '#ffffff00')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const variant = Math.floor(index / families.length)
  const family = index % families.length
  const yaw = -.45 + variant * .34
  const pitch = .48 + variant * .11
  const zoom = 110 + variant * 6
  const project = (x, y, z) => {
    const xx = x * Math.cos(yaw) + z * Math.sin(yaw)
    const zz = -x * Math.sin(yaw) + z * Math.cos(yaw)
    const yy = y * Math.cos(pitch) - zz * Math.sin(pitch)
    const depth = y * Math.sin(pitch) + zz * Math.cos(pitch)
    const perspective = 7 / (7 - depth)
    return [277 + xx * zoom * perspective, 410 - yy * zoom * perspective]
  }
  const line = (points, opacity = .48, thickness = 1.35) => {
    ctx.beginPath()
    points.forEach(([x, y, z], i) => {
      const p = project(x, y, z)
      if (i) ctx.lineTo(...p)
      else ctx.moveTo(...p)
    })
    ctx.strokeStyle = INK
    ctx.globalAlpha = opacity
    ctx.lineWidth = thickness
    ctx.stroke()
  }
  const dot = (x, y, z, radius = 1.5, opacity = .45) => {
    const p = project(x, y, z)
    ctx.beginPath()
    ctx.arc(...p, radius, 0, TAU)
    ctx.fillStyle = INK
    ctx.globalAlpha = opacity
    ctx.fill()
  }
  const cube = (x, y, z, size, opacity = .48) => {
    for (let axis = 0; axis < 3; axis++) {
      for (const a of [-1, 1]) for (const b of [-1, 1]) {
        const start = [x, y, z], end = [x, y, z]
        start[axis] -= size / 2
        end[axis] += size / 2
        start[(axis + 1) % 3] += a * size / 2
        end[(axis + 1) % 3] += a * size / 2
        start[(axis + 2) % 3] += b * size / 2
        end[(axis + 2) % 3] += b * size / 2
        line([start, end], opacity, 1.1)
      }
    }
  }

  if (family === 0) {
    const ring = 1.35, tube = .48 + variant * .1
    for (let band = 0; band < 32; band++) {
      const a = band / 32 * TAU
      const points = []
      for (let j = 0; j <= 60; j++) {
        const b = j / 60 * TAU
        points.push([(ring + tube * Math.cos(b)) * Math.cos(a), tube * Math.sin(b), (ring + tube * Math.cos(b)) * Math.sin(a)])
      }
      line(points, .42)
    }
    for (let j = 0; j < 16; j++) {
      const b = j / 16 * TAU
      line(Array.from({ length: 121 }, (_, i) => {
        const a = i / 120 * TAU
        return [(ring + tube * Math.cos(b)) * Math.cos(a), tube * Math.sin(b), (ring + tube * Math.cos(b)) * Math.sin(a)]
      }), .22)
    }
  } else if (family === 1) {
    for (let i = 0; i < 34; i++) {
      const y = (i / 33 - .5) * 4.3
      const a = y * (1.1 + variant * .3)
      const radius = .67 + Math.sin(i * .19) * .18
      line(Array.from({ length: 5 }, (_, j) => {
        const b = a + j / 4 * TAU
        return [Math.cos(b) * radius, y, Math.sin(b) * radius]
      }), .5)
      if (i % 2 === 0) cube(Math.cos(a) * .2, y, Math.sin(a) * .2, .7, .25)
    }
  } else if (family === 2) {
    for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) + Math.abs(y) + Math.abs(z) > 3 + variant) continue
      const spread = 1 + .16 * (Math.abs(x) + Math.abs(y) + Math.abs(z))
      cube(x * .53 * spread, y * .53 * spread, z * .53 * spread, .43, .38)
    }
  } else if (family === 3) {
    for (let i = 0; i < 2500; i++) {
      const y = 1 - 2 * rng()
      const a = rng() * TAU
      const r = 1.65 * Math.cbrt(rng())
      const s = Math.sqrt(1 - y * y)
      const x = r * s * Math.cos(a), z = r * s * Math.sin(a)
      if (variant === 1 && x > .1 && z > .1) continue
      if (variant === 2 && y > 0 && rng() > .25) continue
      dot(x, y * r, z, .8 + rng() * 2.2, .18 + rng() * .43)
    }
  } else if (family === 4) {
    for (let i = 0; i < 19; i++) {
      const y = (i / 18 - .5) * 3.5
      const a = y * .24 + variant * .3
      line(Array.from({ length: 5 }, (_, j) => {
        const b = a + j / 4 * TAU + Math.PI / 4
        return [Math.cos(b) * 1.5, y, Math.sin(b) * 1.5]
      }), .5, 1.8)
      for (let j = 0; j < 8; j++) {
        const t = j / 7 * 2 - 1
        line([[-1.05, y, t], [1.05, y, t]], .12, .8)
      }
    }
  } else if (family === 5) {
    for (let i = 0; i < 20; i++) {
      const tilt = i / 20 * Math.PI
      line(Array.from({ length: 121 }, (_, j) => {
        const a = j / 120 * TAU
        const r = 1.65 + .1 * Math.sin(a * 3 + variant)
        return [r * Math.cos(a) * Math.cos(tilt), r * Math.sin(a), r * Math.cos(a) * Math.sin(tilt)]
      }), .36)
    }
    for (let i = 0; i < 50; i++) dot((rng() - .5) * 4.8, (rng() - .5) * 4.8, (rng() - .5) * 4.8, 1.4, .35)
  } else if (family === 6) {
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      const h = .6 + rng() * 3.3
      for (let y = 0; y < h; y += .29) cube(x * .63, y - 1.7, z * .63, .49, .27)
    }
  } else {
    for (let i = 0; i < 25; i++) {
      const t = (i / 24 - .5) * .85
      line(Array.from({ length: 161 }, (_, j) => {
        const a = j / 160 * TAU
        const radius = 1.35 + .45 * Math.cos(a * 3 + variant)
        return [(radius + t * Math.cos(a * 1.5)) * Math.cos(a), t * Math.sin(a * 1.5) + .25 * Math.sin(a * 3), (radius + t * Math.cos(a * 1.5)) * Math.sin(a)]
      }), .38)
    }
  }

  ctx.globalAlpha = .08
  for (let i = 0; i < 80; i++) {
    const x = (rng() - .5) * 4.6, y = (rng() - .5) * 4.6, z = (rng() - .5) * 4.6
    dot(x, y, z, 1, .1)
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = '#f3fff1'
  ctx.save()
  ctx.translate(548, 775)
  ctx.rotate(-Math.PI / 2)
  ctx.font = '400 54px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('LW16', 0, 0)
  ctx.font = '400 44px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText(`#${String(index + 1).padStart(3, '0')}`, 0, -55)
  ctx.restore()
  ctx.fillStyle = INK
  ctx.globalAlpha = .5
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('SUPABASE / LAUNCH WEEK 16', 30, 38)
  ctx.fillText(families[family].toUpperCase(), 30, HEIGHT - 30)
  ctx.globalAlpha = .07
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rng() > .5 ? '#fff' : '#24553d'
    ctx.fillRect(rng() * WIDTH, rng() * HEIGHT, 1, 1)
  }
  ctx.globalAlpha = 1
  return { bitmap, name: `${families[family]} ${String(index + 1).padStart(3, '0')}` }
}
