import * as THREE from 'three'
import { FIN_COUNT, finPoint } from './mark.js?v=4'

const canvas = document.querySelector('#scene')
const study = document.querySelector('#study')
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const pauseButton = document.querySelector('#pause')
const topButton = document.querySelector('#top')
const ringButton = document.querySelector('#ring')
const markButton = document.querySelector('#mark')
const status = document.querySelector('#status')
const STEPS = 24
const surface = '#050505'
const shapes = []
let morph = 1
let targetMorph = 1
let yaw = 0
let targetYaw = 0
let elevation = 1.22
let targetElevation = 1.22
let time = 0
let paused = reduced.matches
let pointer = null
let frame = 0
let previous = 0
let width = 0
let height = 0
let dpr = 1
let visible = true
let contextLost = false
let renderer
let scene
let camera
let lastMorph = -1
const center = new THREE.Vector3(0, 0, 0)

function vectors(index, state) {
  const faces = []
  const lines = []
  const point = (level, outer, side) => finPoint(index, level, outer, side, state)
  const quad = (a, b, c, d) => faces.push(...a, ...b, ...c, ...a, ...c, ...d)
  const line = (a, b) => lines.push(...a, ...b)
  for (let step = 0; step < STEPS; step++) {
    const a = step / STEPS, b = (step + 1) / STEPS
    for (const side of [-1, 1]) {
      quad(point(a, false, side), point(a, true, side), point(b, true, side), point(b, false, side))
      line(point(a, false, side), point(b, false, side))
      line(point(a, true, side), point(b, true, side))
    }
    for (const outer of [false, true]) quad(point(a, outer, -1), point(a, outer, 1), point(b, outer, 1), point(b, outer, -1))
  }
  for (const level of [0, 1]) {
    const corners = [point(level, false, -1), point(level, true, -1), point(level, true, 1), point(level, false, 1)]
    quad(...corners)
    for (let i = 0; i < 4; i++) line(corners[i], corners[(i + 1) % 4])
  }
  return { faces: new Float32Array(faces), lines: new Float32Array(lines) }
}

function blend(attribute, a, b, amount) {
  const array = attribute.array
  for (let i = 0; i < array.length; i++) array[i] = a[i] + (b[i] - a[i]) * amount
  attribute.needsUpdate = true
}
function updateShape() {
  if (Math.abs(lastMorph - morph) < .00001) return
  for (const shape of shapes) {
    blend(shape.geometry.getAttribute('position'), shape.ring.faces, shape.mark.faces, morph)
    blend(shape.outline.getAttribute('position'), shape.ring.lines, shape.mark.lines, morph)
  }
  lastMorph = morph
}

function setShape(value) {
  targetMorph = value
  canvas.setAttribute('aria-label', value ? 'A helical arrangement of hairline fins with a Supabase-shaped opening' : 'A helical arrangement of hairline fins with a round opening')
  ringButton.setAttribute('aria-pressed', String(value === 0))
  markButton.setAttribute('aria-pressed', String(value === 1))
  if (reduced.matches) morph = value
  status.textContent = value ? 'S center. The outer helix is unchanged.' : 'Original round center.'
  invalidate()
}
ringButton.addEventListener('click', () => setShape(0))
markButton.addEventListener('click', () => setShape(1))
function togglePause() {
  paused = !paused
  pauseButton.setAttribute('aria-label', paused ? 'Play motion' : 'Pause motion')
  pauseButton.setAttribute('aria-pressed', String(paused))
  pauseButton.title = paused ? 'Play' : 'Pause'
  pauseButton.querySelector('path').setAttribute('d', paused ? 'm9 5 10 7-10 7Z' : 'M9 6v12M15 6v12')
  invalidate()
}
pauseButton.addEventListener('click', togglePause)
if (paused) { paused = false; togglePause() }
function setTop(value) {
  targetElevation = value ? Math.PI / 2 - .001 : 1.22
  if (value) targetYaw = 0
  topButton.setAttribute('aria-pressed', String(value))
  topButton.textContent = value ? '3D view' : 'Top view'
  topButton.setAttribute('aria-label', value ? 'Show oblique view' : 'Show top view')
  if (reduced.matches) { elevation = targetElevation; yaw = targetYaw }
  invalidate()
}
topButton.addEventListener('click', () => setTop(topButton.getAttribute('aria-pressed') !== 'true'))

const canRender = () => renderer && visible && !document.hidden && !contextLost
function render() {
  updateShape()
  const breathing = paused ? 0 : Math.sin(time * .17) * .025
  const viewYaw = yaw + breathing
  camera.position.set(Math.sin(viewYaw) * Math.cos(elevation) * 20, Math.sin(elevation) * 20, Math.cos(viewYaw) * Math.cos(elevation) * 20)
  camera.lookAt(center)
  camera.updateMatrixWorld()
  renderer.render(scene, camera)
}
function pending() {
  return Math.abs(targetMorph - morph) + Math.abs(targetYaw - yaw) + Math.abs(targetElevation - elevation) > .0001
}
function animate(now) {
  frame = 0
  if (!canRender()) return
  const dt = Math.min((now - (previous || now - 16)) / 1000, .04)
  previous = now
  if (!paused) time += dt
  const ease = reduced.matches ? 1 : 1 - Math.exp(-dt * 9)
  morph += (targetMorph - morph) * ease
  yaw += (targetYaw - yaw) * ease
  elevation += (targetElevation - elevation) * ease
  render()
  if (!paused || pending()) frame = requestAnimationFrame(animate)
}
function invalidate() {
  if (!frame && canRender()) { previous = 0; frame = requestAnimationFrame(animate) }
}
function resize() {
  width = study.clientWidth
  height = study.clientHeight
  dpr = Math.min(devicePixelRatio, 2)
  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height, false)
  const aspect = width / height
  const halfHeight = aspect < 1 ? 7.1 / aspect : 6.7
  camera.left = -halfHeight * aspect
  camera.right = halfHeight * aspect
  camera.top = halfHeight
  camera.bottom = -halfHeight
  camera.updateProjectionMatrix()
  invalidate()
}

function initialize() {
  renderer = new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'})
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(surface)
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-10, 10, 6.7, -6.7, .1, 100)
  const fill = new THREE.MeshBasicMaterial({color:surface,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1})
  const ink = new THREE.LineBasicMaterial({color:'#bfc4b5',transparent:true,opacity:.86,depthWrite:false})
  for (let index = 0; index < FIN_COUNT; index++) {
    const ring = vectors(index, 0), mark = vectors(index, 1)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(mark.faces.slice(), 3).setUsage(THREE.DynamicDrawUsage))
    const mesh = new THREE.Mesh(geometry, fill)
    mesh.frustumCulled = false
    const outline = new THREE.BufferGeometry()
    outline.setAttribute('position', new THREE.BufferAttribute(mark.lines.slice(), 3).setUsage(THREE.DynamicDrawUsage))
    const edges = new THREE.LineSegments(outline, ink)
    edges.frustumCulled = false
    scene.add(mesh, edges)
    shapes.push({geometry,outline,ring,mark})
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    canvas.focus({preventScroll:true})
    pointer = {id:event.pointerId,x:event.clientX,y:event.clientY,yaw:targetYaw,elevation:targetElevation}
    canvas.setPointerCapture(event.pointerId)
  })
  canvas.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId) return
    targetYaw = pointer.yaw - (event.clientX - pointer.x) * .005
    targetElevation = THREE.MathUtils.clamp(pointer.elevation + (event.clientY - pointer.y) * .004, .25, Math.PI / 2 - .001)
    topButton.setAttribute('aria-pressed','false')
    topButton.textContent = 'Top view'
    topButton.setAttribute('aria-label','Show top view')
    if (reduced.matches) {yaw=targetYaw;elevation=targetElevation}
    invalidate()
  })
  const release = event => {
    if (pointer?.id !== event.pointerId) return
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    pointer = null
  }
  canvas.addEventListener('pointerup',release)
  canvas.addEventListener('pointercancel',release)
  canvas.addEventListener('keydown',event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home',' '].includes(event.key)) return
    event.preventDefault()
    if (event.key === ' ') {togglePause();return}
    if (event.key === 'Home') {targetYaw=0;setTop(false)}
    if (event.key === 'ArrowLeft') targetYaw -= .12
    if (event.key === 'ArrowRight') targetYaw += .12
    if (event.key === 'ArrowUp') targetElevation = Math.min(Math.PI/2-.001,targetElevation+.1)
    if (event.key === 'ArrowDown') targetElevation = Math.max(.25,targetElevation-.1)
    if (reduced.matches) {yaw=targetYaw;elevation=targetElevation}
    invalidate()
  })
  new ResizeObserver(resize).observe(study)
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)invalidate()}).observe(study)
  document.addEventListener('visibilitychange',invalidate)
  reduced.addEventListener('change',()=>{
    paused = !reduced.matches
    togglePause()
    morph=targetMorph;yaw=targetYaw;elevation=targetElevation
  })
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;if(frame)cancelAnimationFrame(frame);frame=0})
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;resize()})
  resize()
}
try {initialize()} catch {
  document.querySelector('#fallback').hidden = false
  canvas.style.display = 'none'
  document.querySelectorAll('.controls button').forEach(button=>{button.disabled=true})
}
