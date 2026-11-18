// adapted from apps/kb/src/lib/ascii/glyph-path.ts for this standalone study
export const GLYPH_SIZE = 2.2
const GLYPH_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, monospace'

function sampleGlyphPath(points, isClosed, size = GLYPH_SIZE) {
  const count = isClosed ? points.length : points.length - 1
  const glyphs = []
  let carry = 0
  let travelled = 0
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % points.length
    const dx = points[next].x - points[i].x
    const dy = points[next].y - points[i].y
    const length = Math.hypot(dx, dy)
    if (!length) continue
    const step = size * ((Math.abs(dx) * .65 + Math.abs(dy)) / length)
    let distance = carry
    for (; distance < length; distance += step) {
      glyphs.push({
        x: points[i].x + dx * distance / length,
        y: points[i].y + dy * distance / length,
        distance: travelled + distance,
      })
    }
    carry = distance - length
    travelled += length
  }
  return { glyphs, length: travelled }
}

export function fillGlyphPath({ ctx, points, isClosed = false, text, offset = 0, surface, color, size = GLYPH_SIZE, pulse = null }) {
  if (points.length < 2 || !text.length) return offset
  const { glyphs, length } = sampleGlyphPath(points, isClosed, size)
  ctx.beginPath()
  for (const { x, y } of glyphs) ctx.rect(x - size * .325, y - size * .5, size * .65, size)
  ctx.fillStyle = surface
  ctx.fill()
  ctx.font = `${size}px ${GLYPH_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  glyphs.forEach(({ x, y }, index) => ctx.fillText(text[(offset + index) % text.length], x, y))
  if (pulse && length > 0) {
    const head = pulse.distance % (length + 140)
    ctx.fillStyle = pulse.color
    glyphs.forEach(({ x, y, distance }, index) => {
      const behind = head - distance
      if (behind < 0 || behind > 140) return
      ctx.globalAlpha = 1 - behind / 140
      ctx.fillText(text[(offset + index) % text.length], x, y)
    })
    ctx.globalAlpha = 1
  }
  return offset + glyphs.length
}
