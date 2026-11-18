import * as THREE from 'three'
import { createPoster } from './posters.js?v=3'
import { createCorridor } from './corridor.js?v=4'

const MOTION = { stiffness: 100, damping: 20, dragStep: 220, wheelStep: 470, wheelSettle: 160, maxVelocity: 7 }
const collection = [
  { serial: 'LW16 / A builder’s collection', title: 'From prototype to petabyte.', copy: 'Five days of what comes next for builders.', ticket: true },
  { serial: '01 / Monday', title: 'Issues Inbox', copy: 'A place for the issues that need your attention.' },
  { serial: '02 / Monday', title: 'Request Timeline', copy: 'A closer look at how each request unfolds.' },
  { serial: '03 / Tuesday', title: 'Storage Versioning', copy: 'A new chapter for the files you build with.' },
  { serial: '04 / Wednesday', title: 'Warehouse', copy: 'More room for your next scale.' },
  { serial: '05 / Thursday', title: 'Scoped OAuth apps', copy: 'Access without the keys.' },
  { serial: '06 / Friday', title: 'Sign in with Claude', copy: 'One more way to start building.' },
  { serial: 'LW16 / Admit one', title: 'Make something big.', copy: 'Join the builders. Get your Launch Week ticket.', ticket: true },
]
const canvas = document.querySelector('#scene')
const gallery = document.querySelector('#gallery')
const captionList = document.querySelector('#captions')
const dialog = document.querySelector('#detail')
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(35, 1, 1, 20000)
const corridor = createCorridor(scene, camera)
renderer.setClearColor('#fafafa')
const exhibits = []
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let width = 0
let height = 0
const requestedExhibit = ['lw16', 'inbox', 'timeline', 'storage', 'warehouse', 'oauth', 'claude', 'ticket'].indexOf(new URLSearchParams(location.search).get('exhibit'))
let position = Math.max(0, requestedExhibit)
let target = position
let velocity = 0
let pointer = null
let wheelTimer = 0
let animation = 0
let lastTime = 0
let inViewport = true
let inspection = -1
let inspectTurn = 0
let turnAngle = 0
let turnVelocity = 0
let liftedIndex = -1
let lift = 0
let liftVelocity = 0
let announced = -1
let returnFocus = canvas
const wrap = value => THREE.MathUtils.euclideanModulo(value + collection.length / 2, collection.length) - collection.length / 2
const activeIndex = () => THREE.MathUtils.euclideanModulo(Math.round(position), collection.length)
const nearest = index => position + wrap(index - position)

function addExhibit(index, model) {
  const label = document.createElement('li')
  const data = collection[index]
  corridor.add(index, model)
  const heading = document.createElement('h2')
  const headingButton = document.createElement('button')
  headingButton.type = 'button'
  headingButton.textContent = data.title
  headingButton.setAttribute('aria-label', data.ticket ? `Center ${data.title}` : `Inspect ${data.title}`)
  headingButton.addEventListener('focus', () => focusExhibit(index, true))
  headingButton.addEventListener('click', () => data.ticket ? focusExhibit(index) : openDetails(index, headingButton))
  heading.append(headingButton)
  label.append(heading)
  captionList.append(label)
  const exhibit = { index, headingButton }
  exhibits.push(exhibit)
  return exhibit
}

for (let index = 0; index < collection.length; index++) {
  addExhibit(index, createPoster(index, renderer))
}
gallery.classList.add('ready')

function focusExhibit(index, immediate = false) {
  clearTimeout(wheelTimer)
  target = nearest(index)
  if (reduced.matches || immediate) { position = target; velocity = 0 }
  if (immediate && width && height) render()
  invalidate()
}
function openDetails(index, trigger = canvas) {
  if (collection[index].ticket) { location.href = '../lw16-card-flow/'; return }
  focusExhibit(index)
  inspection = liftedIndex = index
  inspectTurn = turnAngle = turnVelocity = 0
  returnFocus = trigger
  document.querySelector('#detail-day').textContent = collection[index].serial
  document.querySelector('#detail-title').textContent = collection[index].title
  document.querySelector('#detail-copy').textContent = collection[index].copy
  dialog.showModal()
  document.querySelector('#close').focus({ preventScroll: true })
  invalidate()
}
function closeDetails() {
  inspection = -1
  inspectTurn = 0
  dialog.close()
  returnFocus?.focus({ preventScroll: true })
  invalidate()
}
document.querySelector('#close').addEventListener('click', closeDetails)
dialog.addEventListener('cancel', e => { e.preventDefault(); closeDetails() })
document.querySelector('#turn-left').addEventListener('click', () => { inspectTurn -= .28; invalidate() })
document.querySelector('#turn-right').addEventListener('click', () => { inspectTurn += .28; invalidate() })

function render() {
  corridor.update(position, { liftedIndex, lift, turn: turnAngle })
  scene.updateMatrixWorld(true)
  renderer.render(scene, camera)
  for (const exhibit of exhibits) exhibit.headingButton.setAttribute('aria-current', String(activeIndex() === exhibit.index))
  const active = activeIndex()
  if (announced !== active && Math.abs(position - target) < .015) {
    announced = active
    document.querySelector('#status').textContent = `${active + 1} of ${collection.length}. ${collection[active].title}`
  }
}
function pending() {
  return Math.abs(position - target) + Math.abs(velocity) > .0001 || Math.abs(lift - (inspection >= 0 ? 1 : 0)) + Math.abs(liftVelocity) > .0001 || Math.abs(turnAngle - inspectTurn) + Math.abs(turnVelocity) > .0001
}
function frame(now) {
  animation = 0
  const dt = Math.min(.032, (now - (lastTime || now - 16)) / 1000)
  lastTime = now
  if (!pointer) {
    velocity += (MOTION.stiffness * (target - position) - MOTION.damping * velocity) * dt
    position += velocity * dt
  }
  const liftTarget = inspection >= 0 ? 1 : 0
  if (reduced.matches) {
    lift = liftTarget
    liftVelocity = 0
    turnAngle = inspectTurn
    turnVelocity = 0
  } else {
    liftVelocity += (100 * (liftTarget - lift) - 20 * liftVelocity) * dt
    lift += liftVelocity * dt
    turnVelocity += (100 * (inspectTurn - turnAngle) - 20 * turnVelocity) * dt
    turnAngle += turnVelocity * dt
  }
  render()
  if (inViewport && !document.hidden && pending()) animation = requestAnimationFrame(frame)
}
function invalidate() {
  if (!animation && inViewport && !document.hidden) { lastTime = 0; animation = requestAnimationFrame(frame) }
}
function resize() {
  const rect = gallery.getBoundingClientRect()
  width = rect.width
  height = rect.height
  corridor.layout(width, height)
  renderer.setSize(width, height, false)
  invalidate()
}
function hitTest(x, y) {
  mouse.set(x / width * 2 - 1, -y / height * 2 + 1)
  raycaster.setFromCamera(mouse, camera)
  for (const intersection of raycaster.intersectObjects(corridor.hitObjects, false)) {
    const hit = corridor.hit(intersection)
    if (hit) return hit
  }
  return null
}
gallery.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.closest('a, button')) return
  e.preventDefault()
  canvas.focus({ preventScroll: true })
  clearTimeout(wheelTimer)
  const axis = e.pointerType === 'touch' ? e.clientY : e.clientX
  pointer = { id: e.pointerId, start: axis, last: axis, startX: e.clientX, startY: e.clientY, axis: e.pointerType === 'touch' ? null : 'x', lastTime: e.timeStamp, position, speed: 0, moved: false, touch: e.pointerType === 'touch' }
  target = position
  velocity = 0
  gallery.setPointerCapture(e.pointerId)
  canvas.style.cursor = 'grabbing'
})
gallery.addEventListener('pointermove', e => {
  if (pointer?.id === e.pointerId) {
    if (pointer.touch && pointer.axis === null) {
      const dx = e.clientX - pointer.startX, dy = e.clientY - pointer.startY
      if (Math.hypot(dx, dy) < 6) return
      pointer.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      pointer.start = pointer.last = pointer.axis === 'x' ? pointer.startX : pointer.startY
    }
    const axis = pointer.axis === 'y' ? e.clientY : e.clientX
    const delta = axis - pointer.start
    pointer.moved ||= Math.abs(delta) > 6
    const dt = Math.max(.008, (e.timeStamp - pointer.lastTime) / 1000)
    pointer.speed = THREE.MathUtils.clamp(-(axis - pointer.last) / MOTION.dragStep / dt, -MOTION.maxVelocity, MOTION.maxVelocity)
    pointer.last = axis
    pointer.lastTime = e.timeStamp
    position = pointer.position - delta / MOTION.dragStep
    target = position
  } else {
    const rect = canvas.getBoundingClientRect()
    canvas.style.cursor = hitTest(e.clientX - rect.left, e.clientY - rect.top) ? 'pointer' : 'grab'
  }
  invalidate()
})
function endPointer(e) {
  if (pointer?.id !== e.pointerId) return
  const ended = pointer
  pointer = null
  if (gallery.hasPointerCapture(e.pointerId)) gallery.releasePointerCapture(e.pointerId)
  canvas.style.cursor = 'grab'
  if (e.type === 'pointercancel') { target = Math.round(position); invalidate(); return }
  if (ended.moved) {
    const releaseSpeed = ended.speed * Math.exp(-Math.max(0, e.timeStamp - ended.lastTime - 40) / 150)
    target = Math.round(position + (reduced.matches ? 0 : releaseSpeed * .12))
  } else {
    const rect = canvas.getBoundingClientRect()
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top)
    if (hit) {
      if (hit.index === activeIndex()) openDetails(hit.index)
      else focusExhibit(hit.index)
    } else target = Math.round(position)
  }
  if (reduced.matches) { position = target; velocity = 0 }
  invalidate()
}
gallery.addEventListener('pointerup', endPointer)
gallery.addEventListener('pointercancel', endPointer)
gallery.addEventListener('wheel', e => {
  if (dialog.open || e.ctrlKey) return
  e.preventDefault()
  const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  const multiplier = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? height : 1
  target += raw * multiplier / MOTION.wheelStep
  clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => { target = Math.round(target); if (reduced.matches) position = target; invalidate() }, MOTION.wheelSettle)
  if (reduced.matches) position = target
  invalidate()
}, { passive: false })
canvas.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); openDetails(activeIndex()); return }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    e.preventDefault()
    clearTimeout(wheelTimer)
    if (e.key === 'Home') target = position + wrap(-position)
    else if (e.key === 'End') target = nearest(collection.length - 1)
    else target = Math.round(target) + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1)
    if (reduced.matches) { position = target; velocity = 0 }
    invalidate()
  }
})
window.addEventListener('blur', () => {
  if (pointer) {
    const id = pointer.id
    pointer = null
    if (gallery.hasPointerCapture(id)) gallery.releasePointerCapture(id)
    canvas.style.cursor = 'grab'
    target = Math.round(position)
    invalidate()
  }
})
document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate() })
new ResizeObserver(resize).observe(gallery)
new IntersectionObserver(([entry]) => { inViewport = entry.isIntersecting; if (inViewport) invalidate() }).observe(gallery)
reduced.addEventListener('change', () => { position = target; velocity = 0; invalidate() })
captionList.addEventListener('focusout', invalidate)
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(animation); animation = 0; gallery.classList.remove('ready') })
canvas.addEventListener('webglcontextrestored', () => { gallery.classList.add('ready'); resize() })
resize()
