import * as THREE from 'three'
import {
  GLASS_GLSL,
  NOISE_GLSL,
  SIZE,
  STUDIO_GLSL,
  TEX,
  drawFace,
  ticketShape,
} from '../lw16-card-flow/ticket.js?v=18'
import { LENS_GLSL, SCREEN_VERTEX } from '../lw16-card-flow/backdrop.js?v=14'
import {
  COUNT,
  FOV,
  INTRO_SECONDS,
  KEYS,
  clamp01,
  smooth,
  smoothstep,
  stageAt,
} from './layouts.js?v=11'

// 48 designs at half size keep the atlas under the 4096 px texture limit of small GPUs
const ATLAS = { columns: 8, rows: 6, scale: 0.5 }
const CELLS = ATLAS.columns * ATLAS.rows
// a ticket of the prism changes to its day card when it is this close to edge-on to the eye,
// so the change is never seen
const EDGE_ON = 0.3
const CELL = { w: TEX.w * ATLAS.scale, h: TEX.h * ATLAS.scale }
// tickets fade out between these distances from the camera
const FOG = [16, 34]

const NAMES = [
  'ada', 'joao', 'kiwi', 'mira', 'sam', 'ben', 'olli', 'theo', 'ines', 'yuki', 'noor', 'lena',
  'omar', 'zoe', 'max', 'ivy', 'raj', 'eli', 'nina', 'hugo', 'aya', 'leo', 'tess', 'finn',
]
const TAILS = ['', '_dev', 'codes', '.sql', '_z', 'db', '42', '_pg', 'builds', '.io']

const VERTEX = /* glsl */ `
  attribute float aCell;
  varying vec3 vWorld, vNormal, vTangent, vBitangent, vObj, vObjNormal;
  varying float vCell;
  void main() {
    mat4 model = modelMatrix * instanceMatrix;
    mat3 rotation = mat3(model);
    vec4 world = model * vec4(position, 1.);
    vObj = position;
    vObjNormal = normal;
    vCell = aCell;
    vWorld = world.xyz;
    vNormal = normalize(rotation * normal);
    vTangent = normalize(rotation * vec3(1., 0., 0.));
    vBitangent = normalize(rotation * vec3(0., 1., 0.));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const FRAGMENT = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uDark;
  uniform vec2 uFog;
  varying vec3 vWorld, vNormal, vTangent, vBitangent, vObj, vObjNormal;
  varying float vCell;
  ${NOISE_GLSL}
  ${STUDIO_GLSL}
  ${GLASS_GLSL}
  ${LENS_GLSL}

  float depth_at(vec2 t, float front) {
    vec3 d = texture2D(uAtlas, t).rgb;
    return (d.r + d.g) * front + d.b * .25;
  }

  void main() {
    float face = step(.5, abs(vObjNormal.z));
    float front = step(0., vObjNormal.z);
    vec2 uv = vObj.xy / vec2(${SIZE.w.toFixed(1)}, ${SIZE.h.toFixed(1)}) + .5;
    float u = clamp(mix(1. - uv.x, uv.x, front), .004, .996);
    float v = clamp(uv.y, .004, .996);
    vec2 cell = vec2(mod(vCell, ${ATLAS.columns}.), floor(vCell / ${ATLAS.columns}.));
    vec2 auv = vec2((cell.x + u) / ${ATLAS.columns}., (${ATLAS.rows - 1}. - cell.y + v) / ${ATLAS.rows}.);

    // red and green are the engraving, blue is the matte parts of the case
    vec3 drawn = texture2D(uAtlas, auv).rgb * face;

    vec2 px = vec2(1. / ${(CELL.w * ATLAS.columns).toFixed(1)}, 1. / ${(CELL.h * ATLAS.rows).toFixed(1)});
    float dx = (depth_at(auv + vec2(px.x, 0.), front) - depth_at(auv - vec2(px.x, 0.), front)) * mix(-1., 1., front) * face;
    float dy = (depth_at(auv + vec2(0., px.y), front) - depth_at(auv - vec2(0., px.y), front)) * face;
    vec3 N = normalize(vNormal + (vTangent * dx + vBitangent * dy) * 1.5);
    vec3 V = normalize(cameraPosition - vWorld);
    float fresnel = pow(1. - max(dot(N, V), 0.), 5.);

    vec3 bent = normalize(N + (vTangent * (uv.x - .5) * .62 + vBitangent * (uv.y - .26) * .5) * face);
    vec3 env = studio(reflect(-V, bent), .03);
    float lambert = max(dot(N, normalize(vec3(-.45, .7, .55))), 0.);

    // the tickets are smoke glass with a bent rim, the same as the default card of the claim flow
    vec4 result = glass(vec3(.1, .105, .115), .55, uv, face, max(drawn.b, drawn.g * front), drawn.r * front, env, fresnel, lambert, 1.);
    result += lens(vObj.xy) * face * (1. - result.a);
    gl_FragColor = result * (1. - smoothstep(uFog.x, uFog.y, length(cameraPosition - vWorld)));
  }
`

// the last cells of the atlas hold the day cards, and the others the tickets of the people
const drawAtlas = (days) => {
  const canvas = document.createElement('canvas')
  canvas.width = CELL.w * ATLAS.columns
  canvas.height = CELL.h * ATLAS.rows
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'lighter'
  for (let index = 0; index < CELLS; index++) {
    ctx.save()
    ctx.translate((index % ATLAS.columns) * CELL.w, Math.floor(index / ATLAS.columns) * CELL.h)
    ctx.beginPath()
    ctx.rect(0, 0, CELL.w, CELL.h)
    ctx.clip()
    ctx.scale(ATLAS.scale, ATLAS.scale)
    const day = days[index - (CELLS - days.length)]
    const handle =
      index === 0 ? 'your_name' : `${NAMES[index % NAMES.length]}${TAILS[(index * 7) % TAILS.length]}`
    drawFace(
      ctx,
      day ?? {
        handle,
        number: 1 + ((index * 577) % 2400),
        stamps: index % 6,
        link: `https://supabase.com/lw16/${handle}`,
      }
    )
    ctx.restore()
  }
  return canvas
}

// the top and bottom of the screen act as the rim of one big pane of glass
// what comes near them is pulled to the edge, smeared, and split into colors
const EDGE = { band: 0.2, reach: 0.12, taps: 8 }

const EDGE_FRAGMENT = /* glsl */ `
  uniform sampler2D uScene;
  varying vec2 vUv;
  void main() {
    float depth = min(vUv.y, 1. - vUv.y);
    if (depth >= ${EDGE.band}) {
      gl_FragColor = texture2D(uScene, vUv);
      return;
    }
    float strength = pow(1. - depth / ${EDGE.band}, 2.);
    float inward = vUv.y < .5 ? 1. : -1.;
    // the picture also spreads sideways as it nears the edge, like light in a thick rim
    float x = .5 + (vUv.x - .5) * (1. - strength * .24);
    vec4 sum = vec4(0.);
    for (int i = 0; i < ${EDGE.taps}; i++) {
      float shift = strength * ${EDGE.reach} * (.35 + .65 * (float(i) + .5) / ${EDGE.taps}.) * inward;
      vec4 red = texture2D(uScene, vec2(x, vUv.y + shift * 1.096));
      vec4 green = texture2D(uScene, vec2(x, vUv.y + shift));
      vec4 blue = texture2D(uScene, vec2(x, vUv.y + shift * .904));
      sum += vec4(red.r, green.g, blue.b, (red.a + green.a + blue.a) / 3.);
    }
    gl_FragColor = sum / ${EDGE.taps}.;
  }
`

// days are the faces of the day cards: { title, number, stamps, link }
export const createCrowd = ({ canvas, days }) => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80)

  const atlas = new THREE.CanvasTexture(drawAtlas(days))
  const people = CELLS - days.length
  // a ticket of the prism shows its day card from the first time it is edge-on in the second
  // half of the roll, and its own face again from the first time it is edge-on before that
  const isDay = days.map(() => false)
  const normal = new THREE.Vector3()
  const toEye = new THREE.Vector3()
  atlas.anisotropy = renderer.capabilities.getMaxAnisotropy()

  const depth = 0.014
  const geometry = new THREE.ExtrudeGeometry(ticketShape(), {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
    curveSegments: 8,
  })
  geometry.translate(0, 0, -depth / 2)
  const cells = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1)
  geometry.setAttribute('aCell', cells)

  const uniforms = {
    uPaper: { value: new THREE.Color('#f3f1ec') },
    uAtlas: { value: atlas },
    uDark: { value: 0 },
    uFog: { value: new THREE.Vector2(...FOG) },
  }
  const mesh = new THREE.InstancedMesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      premultipliedAlpha: true,
      // the draw order comes from the center of each ticket, which is wrong for two tickets that
      // cross. the depth buffer keeps the nearer one on top where they overlap
      depthWrite: true,
    }),
    COUNT
  )
  mesh.frustumCulled = false

  scene.add(mesh)

  // the scene draws into a buffer first, so the screen edges can bend the finished picture
  const buffer = new THREE.WebGLRenderTarget(1, 1, { samples: 4 })
  const edges = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uScene: { value: buffer.texture } },
      vertexShader: SCREEN_VERTEX,
      fragmentShader: EDGE_FRAGMENT,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    })
  )
  edges.frustumCulled = false

  const poses = Array.from({ length: COUNT }, (_, index) => ({
    index,
    depth: 0,
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: 1,
  }))
  const forward = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  const size = new THREE.Vector3()
  const eye = new THREE.Vector3()
  const target = new THREE.Vector3()
  const nextEye = new THREE.Vector3()
  const nextTarget = new THREE.Vector3()

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = canvas.parentElement
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(width, height, false)
    buffer.setSize(width * renderer.getPixelRatio(), height * renderer.getPixelRatio())
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(canvas.parentElement)
  resize()

  const update = ({ progress, time, roll }) => {
    const found = KEYS.findIndex((key) => key.at > progress)
    const next = found === -1 ? KEYS.length - 1 : Math.max(found, 1)
    const a = KEYS[next - 1]
    const b = KEYS[next]
    const eased = smooth(clamp01((progress - a.at) / (b.at - a.at)))
    const context = {
      progress,
      time,
      intro: clamp01(time / INTRO_SECONDS),
      aspect: camera.aspect,
      roll,
    }

    eye.fromArray(a.eye).lerp(nextEye.fromArray(b.eye), eased)
    target.fromArray(a.target).lerp(nextTarget.fromArray(b.target), eased)
    // on a narrow screen the camera moves back for the wide shapes, so they still fit
    const pullBack = Math.max(1, 1.35 / camera.aspect)
    const fitFrom = a.isWide ? pullBack : 1
    const fit = fitFrom + ((b.isWide ? pullBack : 1) - fitFrom) * eased
    eye.sub(target).multiplyScalar(fit).add(target)
    uniforms.uFog.value.set(FOG[0] * fit, FOG[1] * fit)
    camera.position.copy(eye)
    camera.lookAt(target)
    camera.getWorldDirection(forward)
    camera.updateMatrixWorld()

    const place = stageAt(progress)
    for (const pose of poses) {
      place(pose, pose.index, context)
      pose.depth = pose.position.dot(forward)
    }
    // see-through tickets blend right only when the far ones draw first
    poses.sort((near, far) => far.depth - near.depth)
    for (const [slot, pose] of poses.entries()) {
      matrix.compose(pose.position, pose.quaternion, size.setScalar(pose.scale))
      mesh.setMatrixAt(slot, matrix)
      if (pose.index < days.length) {
        normal.set(0, 0, 1).applyQuaternion(pose.quaternion)
        toEye.subVectors(camera.position, pose.position).normalize()
        // a jump of the scroll can skip the roll, so a ticket at rest changes at once
        const isAtRest = roll.amount === 0 || roll.amount === 1
        if (isAtRest || Math.abs(normal.dot(toEye)) < EDGE_ON) isDay[pose.index] = roll.amount > 0.5
      }
      cells.array[slot] = isDay[pose.index] ? people + pose.index : pose.index % people
    }
    mesh.instanceMatrix.needsUpdate = true
    cells.needsUpdate = true
    renderer.setRenderTarget(buffer)
    renderer.clear()
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.render(edges, camera)
  }

  return { update }
}
