import * as THREE from 'three'
import { fillGlyphPath } from '../lw16-ticket-globe/glyph-path.js'

const INK = '#292929'
const MID = '#8c8c8c'
const FAINT = '#cecece'
const PAPER = '#f4f4f4'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const EDITIONS = [
  { width: 1200, height: 1600, worldHeight: 6.4, lines: ['LW16'], footer: 'OPEN INVITATION / 000016' },
  { width: 1200, height: 1600, worldHeight: 6.4, lines: ['Issues', 'Inbox'], footer: 'MONDAY / RELEASE 01' },
  { width: 1600, height: 1200, worldHeight: 4.5, lines: ['Request', 'Timeline'], footer: 'MONDAY / RELEASE 02' },
  { width: 1200, height: 1600, worldHeight: 6.2, lines: ['Storage', 'Versioning'], footer: 'TUESDAY / RELEASE 03' },
  { width: 1500, height: 1350, worldHeight: 5.4, lines: ['Warehouse'], footer: 'WEDNESDAY / RELEASE 04' },
  { width: 1100, height: 1600, worldHeight: 6.7, lines: ['Access', 'without', 'the keys.'], footer: 'THURSDAY / RELEASE 05' },
  { width: 1250, height: 1450, worldHeight: 6.1, lines: ['Sign in', 'with Claude'], footer: 'FRIDAY / RELEASE 06' },
  { width: 1200, height: 1600, worldHeight: 6.4, lines: ['Make', 'something', 'big.'], footer: 'ADMIT ONE / 000016' },
]

function random(seed) {
  let state = seed >>> 0
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 | 0
    return (state >>> 0) / 4294967296
  }
}
function stroke(ctx, points, color = MID, width = 3, close = false) {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  if (close) ctx.closePath()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}
function label(ctx, text, x, y, size = 24, color = MID) {
  ctx.fillStyle = color
  ctx.font = `${size}px ${MONO}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, x, y)
}
function circle(ctx, x, y, radius, color = MID, width = 3, fill = null) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.stroke()
}
function cross(ctx, x, y, size = 7) {
  stroke(ctx, [{ x: x - size, y }, { x: x + size, y }], FAINT, 2)
  stroke(ctx, [{ x, y: y - size }, { x, y: y + size }], FAINT, 2)
}
function glyph(ctx, points, offset = 0, color = MID, text = 'LW16 / FROM PROTOTYPE TO PETABYTE / ') {
  fillGlyphPath({ ctx, points, text, offset, surface: PAPER, color, size: 5.2 })
}
function paper(ctx, width, height, seed) {
  const noise = document.createElement('canvas')
  noise.width = Math.ceil(width / 3)
  noise.height = Math.ceil(height / 3)
  const nctx = noise.getContext('2d')
  const pixels = nctx.createImageData(noise.width, noise.height)
  const rng = random(seed)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const tone = 244 + Math.floor((rng() - .5) * 11)
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = tone
    pixels.data[i + 3] = 255
  }
  nctx.putImageData(pixels, 0, 0)
  ctx.drawImage(noise, 0, 0, width, height)
  ctx.save()
  ctx.globalAlpha = .11
  ctx.strokeStyle = '#b8b8b8'
  ctx.lineWidth = .65
  for (let i = 0; i < 180; i++) {
    const x = rng() * width, y = rng() * height
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (rng() - .5) * 22, y + 2 + rng() * 11)
    ctx.stroke()
  }
  ctx.restore()
}

function growth(ctx) {
  const origin = { x: 100, y: 420 }
  ctx.fillStyle = INK
  ctx.fillRect(origin.x - 20, origin.y - 20, 40, 40)
  for (let row = 0; row < 11; row++) {
    const y = 90 + row * 52
    const points = []
    for (let j = 0; j <= 60; j++) {
      const t = j / 60
      const x = 150 + 290 * t
      points.push({ x, y: origin.y + (y - origin.y) * (t * t * (3 - 2 * t)) })
    }
    glyph(ctx, points, row * 1009, row === 5 ? INK : '#aaaaaa')
    for (let col = 0; col < 11; col++) {
      ctx.strokeStyle = col < 2 ? MID : FAINT
      ctx.lineWidth = 2
      ctx.strokeRect(458 + col * 45, y - 16, 27, 27)
    }
  }
  label(ctx, 'ONE RECORD', 65, 510, 22)
  label(ctx, 'ROOM TO GROW', 630, 720, 22)
}
function inbox(ctx) {
  for (let i = 0; i < 7; i++) {
    const x = 60 + i * 136
    stroke(ctx, [{ x, y: 90 }, { x, y: 140 + i % 3 * 26 }, { x: 500, y: 390 }], i === 3 ? INK : FAINT, i === 3 ? 3.5 : 2)
    ctx.fillStyle = PAPER
    ctx.fillRect(x - 34, 40, 70, 80)
    ctx.strokeStyle = MID
    ctx.lineWidth = 2.5
    ctx.strokeRect(x - 34, 40, 70, 80)
    stroke(ctx, [{ x: x - 19, y: 62 }, { x: x + 19, y: 62 }], MID, 2)
    stroke(ctx, [{ x: x - 19, y: 78 }, { x: x + 11, y: 78 }], FAINT, 2)
    cross(ctx, x, 8)
  }
  ctx.fillStyle = PAPER
  ctx.fillRect(110, 370, 780, 350)
  ctx.strokeStyle = INK
  ctx.lineWidth = 4
  ctx.strokeRect(110, 370, 780, 350)
  stroke(ctx, [{ x: 110, y: 455 }, { x: 890, y: 455 }], MID, 2)
  label(ctx, 'INCOMING / 01', 144, 423, 26, INK)
  for (let row = 0; row < 4; row++) {
    const y = 495 + row * 56
    ctx.strokeStyle = row === 1 ? INK : MID
    ctx.lineWidth = 2
    ctx.strokeRect(147, y - 13, 18, 18)
    if (row === 1) { ctx.fillStyle = INK; ctx.fillRect(150, y - 10, 12, 12) }
    stroke(ctx, [{ x: 193, y }, { x: 660 - row * 38, y }], row === 1 ? INK : MID, row === 1 ? 3 : 2)
    label(ctx, `0${row + 1}`, 800, y + 6, 20, MID)
  }
}
function timeline(ctx) {
  const points = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    points.push({ x: 60 + t * 880, y: 330 + Math.sin(t * Math.PI * 2 - .5) * 95 })
  }
  glyph(ctx, points, 2016, INK, 'REQUEST / RESPONSE / LW16 / ')
  for (let i = 0; i < 7; i++) {
    const p = points[Math.round(i / 6 * 150)]
    circle(ctx, p.x, p.y, i === 3 ? 14 : 8, i === 3 ? INK : MID, 3, i === 3 ? INK : PAPER)
    const sign = i % 2 ? -1 : 1
    stroke(ctx, [{ x: p.x, y: p.y + sign * 20 }, { x: p.x, y: p.y + sign * 145 }], FAINT, 2)
    for (let j = 0; j < 4; j++) {
      const yy = p.y + sign * (155 + j * 22)
      stroke(ctx, [{ x: p.x - 34, y: yy }, { x: p.x + 35 - j * 7, y: yy }], j === 0 ? MID : FAINT, 2)
    }
    label(ctx, `${String(i).padStart(2, '0')}`, p.x - 17, p.y + sign * 270, 20)
  }
  for (let i = 0; i < 45; i++) {
    const x = 50 + i * 20
    stroke(ctx, [{ x, y: 735 }, { x, y: i % 5 === 0 ? 708 : 721 }], i % 5 === 0 ? MID : FAINT, 2)
  }
}
function storage(ctx) {
  for (let layer = 0; layer < 6; layer++) {
    const y = 560 - layer * 67
    const points = [{ x: 115, y }, { x: 480, y: y - 140 }, { x: 900, y: y + 30 }, { x: 515, y: y + 185 }]
    ctx.beginPath()
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
    ctx.closePath()
    ctx.fillStyle = PAPER
    ctx.fill()
    ctx.strokeStyle = layer === 5 ? INK : MID
    ctx.lineWidth = layer === 5 ? 4 : 2.8
    ctx.stroke()
    for (let row = 0; row < 3; row++) {
      stroke(ctx, [{ x: 275 + row * 90, y: y - 20 - row * 35 }, { x: 580 + row * 35, y: y + 103 - row * 25 }], FAINT, 2)
    }
    label(ctx, `v.0${layer + 1}`, 34, y + 10, 22, layer === 5 ? INK : MID)
  }
  glyph(ctx, [{ x: 930, y: 170 }, { x: 930, y: 690 }], 3003)
}
function warehouse(ctx) {
  const ux = 57, uy = 29, uz = 73
  const iso = (x, y, z) => ({ x: 500 + (x - y) * ux, y: 315 + (x + y) * uy - z * uz })
  const cells = []
  for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) cells.push({ x, y, z: 1 + ((x * 7 + y * 3) % 3) })
  cells.sort((a, b) => a.x + a.y - b.x - b.y)
  for (const { x, y, z } of cells) {
    const faces = [
      [iso(x, y, 0), iso(x + 1, y, 0), iso(x + 1, y, z), iso(x, y, z)],
      [iso(x + 1, y, 0), iso(x + 1, y + 1, 0), iso(x + 1, y + 1, z), iso(x + 1, y, z)],
      [iso(x, y, z), iso(x + 1, y, z), iso(x + 1, y + 1, z), iso(x, y + 1, z)],
    ]
    faces.forEach((face, index) => {
      ctx.beginPath()
      face.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
      ctx.closePath()
      ctx.fillStyle = x === 2 && y === 2 ? '#373737' : index === 0 ? '#ededed' : PAPER
      ctx.fill()
      ctx.lineWidth = 2.8
      ctx.strokeStyle = x === 2 && y === 2 ? INK : MID
      ctx.stroke()
    })
  }
  const origin = iso(0, 0, 0)
  glyph(ctx, [{ x: 70, y: 710 }, { x: 500, y: 710 }, { x: 940, y: 710 }], 4040)
  label(ctx, 'ONE FOUNDATION / MORE CAPACITY', 234, 774, 20)
  cross(ctx, origin.x, origin.y + 18)
}
function access(ctx) {
  for (let i = 0; i < 5; i++) {
    const radius = 145 + i * 48
    const points = []
    for (let j = 0; j <= 140; j++) {
      const a = .22 + j / 140 * (Math.PI * 2 - .8)
      points.push({ x: 500 + Math.cos(a) * radius, y: 385 + Math.sin(a) * radius * .78 })
    }
    if (i === 1 || i === 4) glyph(ctx, points, i * 1009, i === 1 ? INK : MID, 'SCOPED / ACCESS / LW16 / ')
    else stroke(ctx, points, i === 2 ? INK : FAINT, i === 2 ? 4 : 2)
  }
  ctx.fillStyle = PAPER
  ctx.fillRect(375, 340, 250, 90)
  label(ctx, 'ACCESS', 394, 397, 43, INK)
  stroke(ctx, [{ x: 60, y: 385 }, { x: 277, y: 385 }], MID, 2)
  stroke(ctx, [{ x: 723, y: 385 }, { x: 940, y: 385 }], INK, 3)
  for (const x of [60, 940]) { circle(ctx, x, 385, 7, INK, 2, PAPER); cross(ctx, x, 320) }
}
function claude(ctx) {
  for (let i = 0; i < 84; i++) {
    const a = i / 84 * Math.PI * 2
    const inner = 100 + 18 * Math.sin(i * .8)
    const outer = 305 + 45 * Math.sin(i * .47)
    const points = []
    for (let j = 0; j <= 24; j++) {
      const t = j / 24
      const r = inner + (outer - inner) * t
      const angle = a + .19 * Math.sin(t * Math.PI)
      points.push({ x: 500 + Math.cos(angle) * r, y: 390 + Math.sin(angle) * r })
    }
    if (i % 7 === 0) glyph(ctx, points, i * 1009, MID, 'SIGN IN / CLAUDE / ')
    else stroke(ctx, points, i % 12 === 0 ? INK : i % 3 ? FAINT : MID, i % 12 === 0 ? 4 : 2)
  }
  circle(ctx, 500, 390, 62, FAINT, 2)
  label(ctx, 'A NEW WAY IN', 386, 780, 24)
}
function admission(ctx) {
  for (let layer = 3; layer >= 0; layer--) {
    const x = 100 + layer * 32, y = 180 - layer * 33
    ctx.fillStyle = PAPER
    ctx.fillRect(x, y, 720, 400)
    ctx.strokeStyle = layer === 0 ? INK : FAINT
    ctx.lineWidth = layer === 0 ? 4 : 2
    ctx.strokeRect(x, y, 720, 400)
  }
  label(ctx, 'ADMIT ONE', 150, 260, 38, INK)
  label(ctx, 'LAUNCH WEEK / 16', 150, 315, 22)
  const rng = random(1617)
  let x = 150
  while (x < 760) {
    const w = 2 + Math.floor(rng() * 5)
    ctx.fillStyle = INK
    ctx.fillRect(x, 404, w, 85)
    x += w + 2 + rng() * 6
  }
  label(ctx, '0000 0016', 151, 540, 24)
  glyph(ctx, [{ x: 100, y: 680 }, { x: 900, y: 680 }], 7117)
}
const graphics = [growth, inbox, timeline, storage, warehouse, access, claude, admission]

function drawEdition(index) {
  const spec = EDITIONS[index]
  const bitmap = document.createElement('canvas')
  bitmap.width = spec.width
  bitmap.height = spec.height
  const ctx = bitmap.getContext('2d')
  paper(ctx, spec.width, spec.height, 1616 + index * 1009)
  const pad = spec.width * .072
  const top = spec.height * .055
  const size = Math.min(spec.width, spec.height) / 9.6
  label(ctx, 'SUPABASE / LAUNCH WEEK 16', pad, top, 20, MID)
  ctx.textAlign = 'right'
  ctx.fillText(String(index).padStart(2, '0'), spec.width - pad, top)
  ctx.textAlign = 'left'
  stroke(ctx, [{ x: pad, y: top + 25 }, { x: spec.width - pad, y: top + 25 }], FAINT, 1.5)
  let titleBottom = top + 85
  ctx.fillStyle = INK
  ctx.textBaseline = 'alphabetic'
  if (index === 0) {
    ctx.font = `500 ${spec.width * .275}px Arial, sans-serif`
    ctx.fillText('LW16', pad - 9, top + 365)
    ctx.font = `400 ${size * .80}px Georgia, serif`
    ctx.fillText('From prototype', pad, top + 505)
    ctx.fillText('to petabyte.', pad, top + 605)
    titleBottom = top + 640
  } else {
    ctx.font = `400 ${size}px Georgia, serif`
    for (let i = 0; i < spec.lines.length; i++) ctx.fillText(spec.lines[i], pad - 3, top + 115 + i * size * .98)
    titleBottom = top + 115 + (spec.lines.length - 1) * size * .98 + 40
  }
  const bottom = spec.height - 155
  const availableW = spec.width - pad * 2
  const availableH = bottom - titleBottom - 40
  const scale = Math.min(availableW / 1000, availableH / 800)
  ctx.save()
  ctx.translate(pad + (availableW - 1000 * scale) / 2, titleBottom + (availableH - 800 * scale) / 2)
  ctx.scale(scale, scale)
  graphics[index](ctx)
  ctx.restore()
  stroke(ctx, [{ x: pad, y: bottom + 30 }, { x: spec.width - pad, y: bottom + 30 }], MID, 1.5)
  label(ctx, spec.footer, pad, bottom + 78, 22, INK)
  label(ctx, index === 0 || index === 7 ? 'GET YOUR TICKET ↗' : 'FROM PROTOTYPE TO PETABYTE', pad, bottom + 117, 18, MID)
  ctx.save()
  ctx.globalAlpha = .18
  const rng = random(index + 99)
  ctx.fillStyle = '#ededed'
  for (let i = 0; i < 2600; i++) ctx.fillRect(rng() * spec.width, rng() * spec.height, 1 + rng() * 2, 1 + rng() * 2)
  ctx.restore()
  return { bitmap, spec }
}

export function createPoster(index, renderer) {
  const { bitmap, spec } = drawEdition(index)
  const height = Math.min(spec.worldHeight, 5.2 * spec.height / spec.width)
  const width = height * spec.width / spec.height
  const geometry = new THREE.PlaneGeometry(width, height)
  const texture = new THREE.CanvasTexture(bitmap)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const front = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }))
  const back = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#e9e9e9', side: THREE.BackSide }))
  const model = new THREE.Group()
  model.add(front, back)
  return model
}
