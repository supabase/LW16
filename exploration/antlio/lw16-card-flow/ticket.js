import * as THREE from 'three'
import { encode } from '../shared/uqr/index.mjs'
import { LENS_GLSL } from './backdrop.js?v=14'
import { growQuadtree, leavesAt } from './quadtree.js?v=13'
import { DAYS } from './stamps.js?v=13'

export const SIZE = { w: 1, h: 1.5 }
export const TEX = { w: 800, h: 1200 }
// the matte plate at the top of the case, where the laser writes
const PLATE = { x: 44, y: 44, width: 712, height: 272 }
const QR = { x: 536, y: 72, size: 200 }
// the mirror below the plate, where the day stamps go
const WELL = { x: 44, y: 348, width: 712, height: 808 }
const STAMP_RADIUS = 104
// one place for each launch day, set out like the stamps of a loyalty card
const STAMP_SLOTS = [
  { x: 170, y: 610 },
  { x: 400, y: 610 },
  { x: 630, y: 610 },
  { x: 285, y: 850 },
  { x: 515, y: 850 },
]
// with no stamp in progress, the laser line spans the card and every stamp shows
const WHOLE_CARD = { left: -1, bottom: -1, right: 2, top: 2 }
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace'
const CAMERA_Z = 4.7
// keep in step with the panel container query in style.css
const WIDE_STAGE_PX = 760
// the open field of the ticket shows this many face heights around the face center
const FACE_FILL = 0.95
// a real mirror this small would lose the face after 2 degrees of tilt
const TILT_DAMP = 0.12
const REFLECTION_STRENGTH = 0.62
const NO_FACE = { x: 0.5, y: 0.5, size: 0.42 }

// both halves of the mark in one path, so a fill covers the seam where they overlap
const BOLT =
  'M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z' +
  'M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z'

// glass is see-through plastic, and density is how much of the page it hides
const MATERIALS = {
  smoke: { glass: 1, density: 0.55, tint: [0.1, 0.105, 0.115] },
  chrome: { glass: 0, density: 1, tint: [0.95, 0.96, 0.97] },
}

const toUvY = (px) => 1 - px / TEX.h

const stampPixels = (index) => {
  const reach = STAMP_RADIUS + 6
  const { x, y } = STAMP_SLOTS[index]
  return { x: x - reach, y: y - reach, width: reach * 2, height: reach * 2 }
}

const toUvRect = ({ x, y, width, height }) => ({
  left: x / TEX.w,
  right: (x + width) / TEX.w,
  top: toUvY(y),
  bottom: toUvY(y + height),
})

// the cell map of the quadtree art has one texel for each smallest cell
const CELL_GRID = 32

// where the word behind the card shows, in the open top of the pane above the day stamps:
// its center from the card center in card units, and its width as a part of the card width
export const LABEL_BAND = { top: toUvY(PLATE.y - 16), bottom: toUvY(PLATE.y + PLATE.height + 16) }

const FIELD_CENTER_Y = (toUvY(WELL.y + WELL.height / 2) - 0.5) * SIZE.h
const FIELD_HALF_H = ((WELL.height / TEX.h) * SIZE.h) / 2

const WELL_UV = {
  left: (WELL.x / TEX.w).toFixed(4),
  right: ((WELL.x + WELL.width) / TEX.w).toFixed(4),
  top: toUvY(WELL.y).toFixed(4),
  bottom: toUvY(WELL.y + WELL.height).toFixed(4),
}

export const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
`

// clear plastic with frosted engraving, as premultiplied color. needs noise() before it
export const GLASS_GLSL = /* glsl */ `
  vec4 glass(vec3 tint, float density, vec2 uv, float face, float frost, float ink, vec3 reflection, float fresnel, float lambert, float outside) {
    vec2 in_well = step(vec2(${WELL_UV.left}, ${WELL_UV.bottom}), uv) * step(uv, vec2(${WELL_UV.right}, ${WELL_UV.top}));
    // the pane in the well is denser than the rim, and the cut edges are the densest
    float body = mix(mix(density * .45, density, in_well.x * in_well.y), .6, 1. - face);
    vec3 base = mix(tint, vec3(.9, .93, .95), (1. - face) * .7);
    vec4 result = vec4(base * body, body);
    result = mix(result, vec4(vec3(.95) * (.74 + .3 * lambert), 1.), frost * .97);
    result = mix(result, vec4(vec3(.07), 1.), ink);
    // fine scratches catch the light, the way a handled case does
    float scratch = smoothstep(.93, 1., noise(vec2(uv.x * 9. + uv.y * 5., uv.y * 420. - uv.x * 180.)))
      + smoothstep(.95, 1., noise(vec2(uv.x * 380. + uv.y * 130., uv.y * 7. - uv.x * 4.)));
    vec3 gloss = (reflection * (.2 + .9 * fresnel) + scratch * .16) * (1. - frost * .8) * face * outside
      + reflection * .35 * (1. - face);
    result.rgb += gloss;
    result.a = min(result.a + dot(gloss, vec3(.33)), 1.);
    // the far wall of the case shows through the near one, dimmer
    return result * mix(.55, 1., outside);
  }
`

// needs a float uniform uDark declared before it
export const STUDIO_GLSL = /* glsl */ `
  float band(float x, float center, float half_width, float blur) {
    return smoothstep(center - half_width - blur, center - half_width + blur, x)
      * (1. - smoothstep(center + half_width - blur, center + half_width + blur, x));
  }

  vec3 studio(vec3 r, float rough) {
    float blur = .008 + rough * .5;
    float az = atan(r.x, r.z);
    float y = r.y + sin(az * 1.3 + .4) * .07;
    float sky = smoothstep(-blur, blur, y + .02);

    vec3 above = mix(vec3(1.), vec3(.6, .63, .67), smoothstep(0., .85, y));
    vec3 below = mix(vec3(.07, .07, .08), vec3(.8, .78, .74), smoothstep(0., -.7, y));
    float flags = band(az, -1.05, .13, blur) + band(az, .72, .045, blur) + band(az, 2.4, .3, blur);
    above = mix(above, above * .18, min(flags, 1.) * band(y, .5, .42, blur));
    vec3 day = mix(below, above, sky);

    float key = band(az, -.55, .11, blur) * band(y, .5, .42, blur);
    float rim = band(az, 1.05, .035, blur) * band(y, .45, .4, blur);
    float window = band(az, .3, .3, blur) * band(y, .55, .3, blur);
    float mullion = smoothstep(.03, .05 + blur, abs(fract(az * 4.6) - .5));
    window *= mix(mullion, 1., clamp(rough * 2., 0., 1.));
    vec3 dusk = mix(vec3(1., .74, .58), vec3(.5, .66, 1.), smoothstep(.3, .8, y));
    vec3 night_above = mix(vec3(.2, .21, .24), vec3(.035, .037, .045), smoothstep(0., .7, y))
      + (key + rim * .8) * vec3(1., .985, .96) + window * dusk * .8;
    vec3 night_below = mix(vec3(.5, .52, .56), vec3(.1), smoothstep(0., -.45, y));
    vec3 night = mix(night_below, night_above, sky);

    return mix(day, night, uDark);
  }
`

const TICKET_VERTEX = /* glsl */ `
  varying vec3 vWorld, vNormal, vTangent, vBitangent, vObj, vObjNormal;
  void main() {
    mat3 rotation = mat3(modelMatrix);
    vec4 world = modelMatrix * vec4(position, 1.);
    vObj = position;
    vObjNormal = normal;
    vWorld = world.xyz;
    vNormal = normalize(rotation * normal);
    vTangent = normalize(rotation * vec3(1., 0., 0.));
    vBitangent = normalize(rotation * vec3(0., 1., 0.));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const TICKET_FRAGMENT = /* glsl */ `
  uniform sampler2D uDesign, uVideo, uSurface;
  uniform float uTime, uMirror, uDark, uVideoAspect, uSurfaceOn, uMirrorK, uCut, uCutStamp, uGlass, uDensity, uQuad;
  uniform sampler2D uCells, uCellsBefore;
  uniform vec2 uScan, uMirrorCenter;
  uniform vec4 uPending;
  uniform vec3 uTint, uEtch, uFace;
  varying vec3 vWorld, vNormal, vTangent, vBitangent, vObj, vObjNormal;
  ${NOISE_GLSL}
  ${STUDIO_GLSL}
  ${GLASS_GLSL}
  ${LENS_GLSL}
  float depth_at(vec2 t, float stamp_shown) {
    vec3 d = texture2D(uDesign, t).rgb;
    return d.r + d.g * stamp_shown + d.b * .25;
  }

  void main() {
    float face = step(.5, abs(vObjNormal.z));
    float front = step(0., vObjNormal.z);
    vec2 uv = vObj.xy / vec2(${SIZE.w.toFixed(1)}, ${SIZE.h.toFixed(1)}) + .5;
    float u = clamp(uv.x, .002, .998) * .5;
    vec2 tuv = vec2(mix(1. - u, u, front), uv.y);

    // red is what the laser writes, green is the day stamps, blue is the matte parts of the case
    float engraved = smoothstep(uCut - .003, uCut + .003, uv.y) * face;
    vec3 drawn = texture2D(uDesign, tuv).rgb;
    float plate = drawn.b * face;
    // uPending is the stamp the laser draws now, as left, bottom, right, top
    float in_pending = step(uPending.x, uv.x) * step(uv.x, uPending.z) * step(uPending.y, uv.y) * step(uv.y, uPending.w);
    float stamp_shown = 1. - in_pending * (1. - smoothstep(uCutStamp - .003, uCutStamp + .003, uv.y));
    float written = drawn.r * engraved;
    float stamped = drawn.g * stamp_shown * engraved;
    float etch = max(written, stamped);

    vec2 px = vec2(1. / ${(TEX.w * 2).toFixed(1)}, 1. / ${TEX.h.toFixed(1)});
    float dx = (depth_at(tuv + vec2(px.x, 0.), stamp_shown) - depth_at(tuv - vec2(px.x, 0.), stamp_shown)) * engraved;
    float dy = (depth_at(tuv + vec2(0., px.y), stamp_shown) - depth_at(tuv - vec2(0., px.y), stamp_shown)) * engraved;
    dx *= mix(-1., 1., front);
    float grain = noise(uv * vec2(7., 1100.)) - .5;
    vec3 N = normalize(vNormal + (vTangent * dx + vBitangent * dy) * 1.5 + vBitangent * grain * .004);

    vec3 V = normalize(cameraPosition - vWorld);
    vec3 R = reflect(-V, N);
    float fresnel = pow(1. - max(dot(N, V), 0.), 5.);
    float rough = mix(.03, .8, max(etch, plate));
    // a flat mirror shows one small patch of the room, so the room lookup bends the surface
    vec3 bent = normalize(N + (vTangent * (uv.x - .5) * .62 + vBitangent * (uv.y - .26) * .5) * face);
    vec3 env = studio(reflect(-V, bent), rough);

    vec3 reflection = env;
    if (uMirror > .001) {
      vec3 flat_r = reflect(-V, vNormal);
      vec2 flat_m = flat_r.xy / max(flat_r.z, .3);
      vec2 planar = (vWorld.xy - cameraPosition.xy) / max(cameraPosition.z - vWorld.z, .1);
      vec2 relief = R.xy / max(R.z, .3) - flat_m;
      vec2 tilt = flat_m - planar;
      vec2 m = planar - uMirrorCenter + (relief * 3. + tilt) * ${TILT_DAMP.toFixed(2)};
      vec2 vuv = uFace.xy + vec2(-m.x / uVideoAspect, m.y) * uMirrorK * uFace.z;
      float inside = band(vuv.x, .5, .42, .16) * band(vuv.y, .5, .42, .16) * smoothstep(.15, .5, vNormal.z);
      vec3 video = texture2D(uVideo, vuv, 1.6 + rough * 6.).rgb;
      video = mix(vec3(dot(video, vec3(.3, .59, .11))), video, .5);
      // the room light stays on top, so the face reads as a reflection in metal
      float room = dot(env, vec3(.3, .59, .11));
      reflection = mix(env, video * (.4 + .8 * room) + env * .12, inside * uMirror * (1. - plate) * ${REFLECTION_STRENGTH.toFixed(2)});
    }

    vec3 surface = mix(vec3(1.), texture2D(uSurface, uv * vec2(1., ${SIZE.h.toFixed(1)})).rgb, uSurfaceOn);
    float surface_lum = dot(surface, vec3(.3, .59, .11));

    vec3 metal = reflection * mix(uTint, vec3(1.), fresnel);
    metal += (pow(reflection, vec3(3.)) * .3 + .04) * (1. - uTint.g);
    metal *= mix(1., .55 + surface_lum * .55, uSurfaceOn);
    vec3 L = normalize(vec3(-.45, .7, .55));
    float lambert = max(dot(N, L), 0.);
    float tooth = .75 + .5 * noise(uv * 900.);
    float shade = .72 + .4 * lambert;
    metal = mix(metal, uEtch * tooth * shade + env * .06, stamped);
    metal = mix(metal, vec3(.82) * (.9 + .1 * tooth) * shade + env * .05, plate);
    metal = mix(metal, vec3(.1) * tooth, written);

    vec3 color = metal;

    float any_etch = max(drawn.r, drawn.g);
    float in_span = step(uPending.x, uv.x) * step(uv.x, uPending.z);
    float scan_line = exp(-pow((uv.y - uScan.x) / .0035, 2.));
    float trail = exp(-max(uv.y - uScan.x, 0.) / .03) * step(uScan.x, uv.y);
    float flicker = .8 + .2 * sin(uTime * 90. + uv.x * 400.);
    vec3 glow = uScan.y * face * in_span * (
      vec3(1., .96, .85) * scan_line * (.12 + any_etch * 2.4) * flicker
      + vec3(1., .42, .08) * trail * any_etch
    );

    vec4 result = vec4(color, 1.);
    if (uGlass > .5) {
      result = glass(uTint, uDensity, uv, face, max(plate, stamped), written, reflection, fresnel, lambert, gl_FrontFacing ? 1. : 0.);
      // the bent rim goes under the case, so the label and the engraving stay on top of it
      if (gl_FrontFacing) {
        vec4 behind = lens(vObj.xy);
        vec2 well_min = vec2(${WELL_UV.left}, ${WELL_UV.bottom});
        vec2 well_size = vec2(${WELL_UV.right}, ${WELL_UV.top}) - well_min;
        vec2 at = (uv - well_min) / well_size;
        if (uQuad > .5 && at == clamp(at, 0., 1.)) {
          // each leaf of the quadtree is its own small pane of glass
          // a texel holds the corner of its leaf in steps of the grid, and the level of the leaf
          vec4 cell = mix(texture2D(uCellsBefore, at), texture2D(uCells, at), step(uCutStamp, uv.y));
          float size = exp2(-floor(cell.b * 255. / 40. + .5));
          vec2 center = floor(cell.rg * 255. / 4. + .5) / ${CELL_GRID}. + size * .5;
          vec2 half_size = size * .5 * well_size * vec2(${SIZE.w.toFixed(1)}, ${SIZE.h.toFixed(1)});
          float small = min(half_size.x, half_size.y);
          // a big leaf keeps a thin rim, so its middle stays clear like the card itself
          float band = min(small * .55, .05);
          vec4 tile = bend((at - center) * well_size * vec2(${SIZE.w.toFixed(1)}, ${SIZE.h.toFixed(1)}), half_size, small * .2, band);
          behind += tile * (1. - behind.a);
        }
        result += behind * face * (1. - result.a);
      }
    }
    gl_FragColor = vec4(result.rgb + glow, min(result.a + dot(glow, vec3(.33)), 1.));
  }
`

const SHADOW_FRAGMENT = /* glsl */ `
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    vec2 q = abs(vUv - .5) * vec2(1.9, 2.55) - vec2(.42, .66);
    float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.);
    gl_FragColor = vec4(0., 0., 0., smoothstep(.3, -.25, d) * uAlpha);
  }
`

const UV_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`

export const ticketShape = () => {
  const x = SIZE.w / 2
  const y = SIZE.h / 2
  const corner = 0.055
  const shape = new THREE.Shape()
  shape.moveTo(-x + corner, -y)
  shape.lineTo(x - corner, -y)
  shape.absarc(x - corner, -y + corner, corner, -Math.PI / 2, 0, false)
  shape.lineTo(x, y - corner)
  shape.absarc(x - corner, y - corner, corner, 0, Math.PI / 2, false)
  shape.lineTo(-x + corner, y)
  shape.absarc(-x + corner, y - corner, corner, Math.PI / 2, Math.PI, false)
  shape.lineTo(-x, -y + corner)
  shape.absarc(-x + corner, -y + corner, corner, Math.PI, Math.PI * 1.5, false)
  return shape
}

const setFont = (ctx, size, weight = 600, spacing = 0) => {
  ctx.font = `${weight} ${size}px ${MONO}`
  ctx.letterSpacing = `${spacing}px`
}

const drawBolt = (ctx, { x, y, scale, isOutline }) => {
  const mark = new Path2D(BOLT)
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  if (isOutline) {
    ctx.lineWidth = 7 / scale
    ctx.stroke(mark)
    // erase the inside, so only the outer half of the stroke stays
    ctx.globalCompositeOperation = 'destination-out'
  }
  ctx.fill(mark)
  ctx.restore()
}

// the day stamps the user has engraved so far, in the green channel
const drawStamps = (ctx, stamps) => {
  ctx.strokeStyle = '#0f0'
  ctx.lineJoin = 'round'
  for (const [index, slot] of STAMP_SLOTS.slice(0, stamps).entries()) {
    ctx.save()
    ctx.translate(slot.x, slot.y)
    ctx.lineWidth = 1
    for (let ring = 0; ring < 6; ring++) {
      ctx.beginPath()
      for (let step = 0; step <= 360; step++) {
        const angle = (step / 360) * Math.PI * 2
        const radius =
          STAMP_RADIUS * (0.7 + ring * 0.055) * (1 + 0.04 * Math.sin(angle * 16 + ring * 0.7))
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
      }
      ctx.stroke()
    }
    const scale = STAMP_RADIUS * 0.36
    ctx.scale(scale, scale)
    ctx.lineWidth = 4.5 / scale
    ctx.stroke(new Path2D(DAYS[index].icon))
    ctx.restore()
  }
}

// the matte parts every card has: the rim of the case, and the well with the maker's mark
const drawCase = (ctx) => {
  ctx.filter = 'blur(0.6px)'
  ctx.fillStyle = ctx.strokeStyle = '#00f'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(20, 20, TEX.w - 40, TEX.h - 40, 30)
  ctx.roundRect(WELL.x, WELL.y, WELL.width, WELL.height, 14)
  ctx.stroke()
  drawBolt(ctx, { x: 662, y: 1058, scale: 0.6, isOutline: true })
}

const treeOf = ({ handle, number }) => growQuadtree(`${handle}.${number}`, DAYS.length)

// the quadtree art: lines that are done go in blue, and the lines of the newest day in green,
// so the laser can reveal the newest day alone
const drawQuadtree = (ctx, { handle, number, stamps }) => {
  const toX = (x) => WELL.x + x * WELL.width
  const toY = (y) => WELL.y + y * WELL.height
  ctx.lineWidth = 1.2
  ctx.lineJoin = 'round'
  for (const cell of treeOf({ handle, number })) {
    const half = cell.size / 2
    if (cell.splitDay <= stamps) {
      ctx.strokeStyle = cell.splitDay === stamps ? '#0f0' : '#00f'
      ctx.beginPath()
      ctx.moveTo(toX(cell.x + half), toY(cell.y))
      ctx.lineTo(toX(cell.x + half), toY(cell.y + cell.size))
      ctx.moveTo(toX(cell.x), toY(cell.y + half))
      ctx.lineTo(toX(cell.x + cell.size), toY(cell.y + half))
      ctx.stroke()
    }
    if (cell.iconDay <= stamps) {
      const scale = cell.size * WELL.width * 0.24
      ctx.save()
      ctx.strokeStyle = cell.iconDay === stamps ? '#0f0' : '#00f'
      ctx.translate(toX(cell.x + half), toY(cell.y + half))
      ctx.scale(scale, scale)
      ctx.lineWidth = 3.4 / scale
      ctx.stroke(new Path2D(DAYS[cell.iconDay - 1].icon))
      ctx.restore()
    }
  }
}

// for each texel of the well, the corner and the level of the leaf it is in
const cellMap = (identity, day) => {
  const data = new Uint8Array(CELL_GRID * CELL_GRID * 4)
  for (const leaf of leavesAt(treeOf(identity), day)) {
    const span = leaf.size * CELL_GRID
    // the texture has its first row at the bottom, and the tree has y down
    const left = leaf.x * CELL_GRID
    const bottom = (1 - leaf.y - leaf.size) * CELL_GRID
    for (let row = bottom; row < bottom + span; row++) {
      for (let column = left; column < left + span; column++) {
        data.set([left * 4, bottom * 4, Math.round(-Math.log2(leaf.size)) * 40, 255], (row * CELL_GRID + column) * 4)
      }
    }
  }
  const texture = new THREE.DataTexture(data, CELL_GRID, CELL_GRID)
  texture.needsUpdate = true
  return texture
}

export const drawFace = (ctx, { handle, title = `@${handle}`, number, stamps, link, art }) => {
  const left = PLATE.x + 26
  const textWidth = QR.x - left - 28
  drawCase(ctx)
  ctx.beginPath()
  ctx.roundRect(PLATE.x, PLATE.y, PLATE.width, PLATE.height, 14)
  ctx.fill()
  art === 'quadtree' ? drawQuadtree(ctx, { handle, number, stamps }) : drawStamps(ctx, stamps)

  ctx.filter = 'blur(0.5px)'
  ctx.fillStyle = '#f00'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  setFont(ctx, 18, 700, 2.2)
  ctx.fillText('SUPABASE / LAUNCH WEEK 16', left, 98)
  ctx.fillText(`STAMPS ${stamps}/${STAMP_SLOTS.length}`, left, 290)
  ctx.textAlign = 'right'
  ctx.fillText('06–10 DEC 2026', left + textWidth, 290)
  ctx.fillRect(left, 246, textWidth, 2)

  ctx.textAlign = 'left'
  const label = title
  setFont(ctx, 60, 700, -1.5)
  setFont(ctx, Math.min(60, (60 * textWidth) / ctx.measureText(label).width), 700, -1.5)
  ctx.fillText(label, left - 3, 170)

  // the bar widths come from the card number, so each card has its own code
  let seed = number * 9301 + 49297
  for (let x = left; x < left + 112; ) {
    seed = (seed * 9301 + 49297) % 233280
    const width = 2 + (seed % 3) * 2
    if (x + width <= left + 112) ctx.fillRect(x, 194, width, 30)
    x += width + 2 + (seed % 3) * 2
  }
  setFont(ctx, 22, 700, 1.5)
  ctx.fillText(`NO. ${String(number).padStart(4, '0')}`, left + 130, 220)

  // the code stays sharp, because a phone has to read it off the screen
  ctx.filter = 'none'
  const { size, data } = encode(link, { ecc: 'L', border: 0 })
  const cell = Math.floor(QR.size / size)
  const inset = (QR.size - cell * size) / 2
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (data[row][column]) {
        ctx.fillRect(QR.x + inset + column * cell, QR.y + inset + row * cell, cell, cell)
      }
    }
  }
}

const drawBack = (ctx) => {
  drawCase(ctx)
  ctx.textAlign = 'center'
  setFont(ctx, 22, 700, 2.6)
  ctx.fillText('SUPABASE.COM/LAUNCH-WEEK', TEX.w / 2, 190)
}

export const createTicket = ({ canvas, isMotionReduced, onTap }) => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(0, 0, CAMERA_Z)

  const design = document.createElement('canvas')
  design.width = TEX.w * 2
  design.height = TEX.h
  const designCtx = design.getContext('2d', { willReadFrequently: true })
  const designTexture = new THREE.CanvasTexture(design)
  designTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()

  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  blank.needsUpdate = true

  const uniforms = {
    uPaper: { value: new THREE.Color() },
    uDesign: { value: designTexture },
    uVideo: { value: blank },
    uSurface: { value: blank },
    uTime: { value: 0 },
    uMirror: { value: 0 },
    uDark: { value: 0 },
    uVideoAspect: { value: 4 / 3 },
    uSurfaceOn: { value: 0 },
    uMirrorK: { value: 1 },
    uScan: { value: new THREE.Vector2(2, 0) },
    uCut: { value: 2 },
    uCutStamp: { value: -1 },
    uQuad: { value: 0 },
    uCells: { value: blank },
    uCellsBefore: { value: blank },
    uPending: { value: new THREE.Vector4() },
    uMirrorCenter: { value: new THREE.Vector2() },
    uTint: { value: new THREE.Vector3() },
    uEtch: { value: new THREE.Vector3() },
    uGlass: { value: 1 },
    uDensity: { value: 1 },
    uFace: { value: new THREE.Vector3(NO_FACE.x, NO_FACE.y, NO_FACE.size) },
  }

  const depth = 0.014
  const geometry = new THREE.ExtrudeGeometry(ticketShape(), {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 20,
  })
  geometry.translate(0, 0, -depth / 2)
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: TICKET_VERTEX,
      fragmentShader: TICKET_FRAGMENT,
      // both sides draw, far wall first, so a clear case shows its back through its front
      transparent: true,
      premultipliedAlpha: true,
      side: THREE.DoubleSide,
    })
  )

  const shadowUniforms = { uAlpha: { value: 0 } }
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(SIZE.w * 1.9, SIZE.h * 1.7),
    new THREE.ShaderMaterial({
      uniforms: shadowUniforms,
      vertexShader: UV_VERTEX,
      fragmentShader: SHADOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
    })
  )
  shadow.position.set(0.04, -0.09, -0.5)
  shadow.renderOrder = -1

  const group = new THREE.Group()
  group.add(mesh)
  const rig = new THREE.Group()
  rig.add(group, shadow)
  scene.add(rig)

  const params = { scanY: 2, scanOn: 0, cut: 2, cutStamp: -1, pending: null, mirror: 0 }
  const yaw = { x: 0, v: 0 }
  const pitch = { x: 0, v: 0 }
  const hover = { x: 0, y: 0 }
  const face = { ...NO_FACE }
  let faceTarget = NO_FACE
  let turns = 0
  let drag = null
  let videoTexture = null
  let previousTime = 0
  let isDark = false
  let materialName = 'smoke'
  let realWidth = null
  let art = 'stamps'

  const applyLook = () => {
    const material = MATERIALS[materialName]
    // a laser mark must contrast with what the mirror shows around it
    const isEtchLight = materialName === 'chrome' && isDark
    uniforms.uGlass.value = material.glass
    uniforms.uDensity.value = material.density
    uniforms.uTint.value.set(...material.tint)
    uniforms.uEtch.value.setScalar(isEtchLight ? 0.7 : 0.14)
    uniforms.uDark.value = isDark ? 1 : 0
    uniforms.uPaper.value.set(isDark ? '#0c0c0c' : '#f3f1ec')
    shadowUniforms.uAlpha.value = (isDark ? 0.5 : 0.2) * material.density
  }

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = canvas.parentElement
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    const visibleHeight = 2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const visibleWidth = visibleHeight * camera.aspect
    const isWide = width >= WIDE_STAGE_PX && !realWidth
    // at real size the card is centered and as wide on screen as the given CSS pixels
    const scale = realWidth
      ? (realWidth * visibleHeight) / (height * SIZE.w)
      : Math.min(1, visibleWidth / (SIZE.w * 1.5))
    const lift = realWidth ? 0 : visibleHeight * (isWide ? 0.07 : 0.13)
    rig.scale.setScalar(scale)
    rig.position.set(isWide ? visibleWidth * 0.14 : 0, lift, 0)
    uniforms.uMirrorCenter.value.set(
      rig.position.x / CAMERA_Z,
      (rig.position.y + FIELD_CENTER_Y * scale) / CAMERA_Z
    )
    uniforms.uMirrorK.value = FACE_FILL / ((FIELD_HALF_H * scale) / CAMERA_Z)
  }
  new ResizeObserver(resize).observe(canvas.parentElement)
  resize()

  const spring = (value, target, dt) => {
    value.v += ((target - value.x) * 110 - value.v * 15) * dt
    value.x += value.v * dt
  }

  const tick = (now) => {
    const time = now / 1000
    const dt = Math.min(time - previousTime, 1 / 30)
    previousTime = time
    const float = isMotionReduced || drag ? 0 : 1
    spring(
      yaw,
      turns * Math.PI + (drag?.yaw ?? 0) + hover.x * 0.3 + Math.sin(time * 0.6) * 0.06 * float,
      dt
    )
    spring(pitch, (drag?.pitch ?? 0) - hover.y * 0.22 + Math.sin(time * 0.47) * 0.04 * float, dt)
    group.rotation.set(pitch.x, yaw.x, 0)

    const ease = 1 - Math.exp(-dt * 9)
    face.x += (faceTarget.x - face.x) * ease
    face.y += (faceTarget.y - face.y) * ease
    face.size += (faceTarget.size - face.size) * ease

    uniforms.uTime.value = time
    uniforms.uMirror.value = params.mirror
    uniforms.uScan.value.set(params.scanY, params.scanOn)
    uniforms.uCut.value = params.cut
    uniforms.uCutStamp.value = params.cutStamp
    const pending = params.pending ?? WHOLE_CARD
    uniforms.uPending.value.set(pending.left, pending.bottom, pending.right, pending.top)
    uniforms.uFace.value.set(face.x, face.y, face.size)
    renderer.render(scene, camera)
  }
  renderer.setAnimationLoop(tick)
  document.addEventListener('visibilitychange', () =>
    renderer.setAnimationLoop(document.hidden ? null : tick)
  )

  const raycaster = new THREE.Raycaster()
  const isOnTicket = (event) => {
    const rect = canvas.getBoundingClientRect()
    const point = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(point, camera)
    return raycaster.intersectObject(mesh).length > 0
  }

  canvas.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, y: event.clientY, yaw: 0, pitch: 0, hasMoved: false }
    canvas.setPointerCapture(event.pointerId)
  })
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect()
    hover.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    hover.y = ((event.clientY - rect.top) / rect.height) * 2 - 1
    if (!drag) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (Math.hypot(dx, dy) > 4) drag.hasMoved = true
    drag.yaw = dx * 0.008
    drag.pitch = THREE.MathUtils.clamp(dy * 0.004, -0.5, 0.5)
  })
  const release = (event) => {
    if (!drag) return
    if (drag.hasMoved) turns += Math.round(drag.yaw / Math.PI)
    else if (isOnTicket(event)) onTap()
    drag = null
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', () => (drag = null))
  canvas.addEventListener('pointerleave', () => {
    hover.x = 0
    hover.y = 0
  })

  const setDesign = (identity) => {
    const ctx = designCtx
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter = 'none'
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, design.width, design.height)
    // each layer draws in one color channel, so additive blending keeps them apart
    ctx.globalCompositeOperation = 'lighter'
    drawFace(ctx, identity)
    ctx.save()
    ctx.translate(TEX.w, 0)
    drawBack(ctx)
    ctx.restore()
    designTexture.needsUpdate = true

    art = identity.art
    for (const uniform of [uniforms.uCells, uniforms.uCellsBefore]) {
      if (uniform.value !== blank) uniform.value.dispose()
      uniform.value = blank
    }
    uniforms.uQuad.value = art === 'quadtree' ? 1 : 0
    if (art !== 'quadtree') return
    uniforms.uCells.value = cellMap(identity, identity.stamps)
    uniforms.uCellsBefore.value = cellMap(identity, Math.max(identity.stamps - 1, 0))
  }

  // the part of the card the laser scans for one day stamp
  const stampArea = (index) => (art === 'quadtree' ? WELL : stampPixels(index))

  const readDensity = ({ x, y, width, height }) => {
    const { data } = designCtx.getImageData(x, y, width, height)
    const density = new Float32Array(height)
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const pixel = (row * width + column) * 4
        density[row] += data[pixel] + data[pixel + 1]
      }
    }
    const peak = Math.max(...density, 1)
    return density.map((value) => value / peak)
  }

  return {
    params,
    setDesign,
    engraveDensity: () =>
      readDensity({ x: 0, y: PLATE.y - 16, width: TEX.w, height: PLATE.height + 32 }),
    stampRect: (index) => toUvRect(stampArea(index)),
    stampDensity: (index) => readDensity(stampArea(index)),
    setFace: (next) => (faceTarget = next ?? NO_FACE),
    flip: () => (turns += 1),
    setRealWidth: (cssPixels) => {
      realWidth = cssPixels
      resize()
    },
    spin: () => (turns += isMotionReduced ? 0 : 2),
    setMaterial: (name) => {
      materialName = name
      applyLook()
    },
    setTheme: (theme) => {
      isDark = theme === 'dark'
      applyLook()
    },
    setVideo: (video) => {
      videoTexture?.dispose()
      videoTexture = null
      uniforms.uVideo.value = blank
      if (!video) return
      videoTexture = new THREE.VideoTexture(video)
      // the shader blurs the reflection on rough areas with a mip bias
      videoTexture.generateMipmaps = true
      videoTexture.minFilter = THREE.LinearMipmapLinearFilter
      uniforms.uVideo.value = videoTexture
      uniforms.uVideoAspect.value = video.videoWidth / video.videoHeight || 4 / 3
    },
    setSurface: (image) => {
      if (uniforms.uSurface.value !== blank) uniforms.uSurface.value.dispose()
      uniforms.uSurface.value = blank
      uniforms.uSurfaceOn.value = image ? 1 : 0
      if (!image) return
      const texture = new THREE.Texture(image)
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.needsUpdate = true
      uniforms.uSurface.value = texture
    },
  }
}
