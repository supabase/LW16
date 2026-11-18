import * as THREE from 'three'
import { createCardArtwork, CARD_COUNT } from './cards.js?v=2'
import { CAMERA_Z, ROWS, layoutWall, cardPoint, mod } from './layout.js?v=4'

const wall = document.querySelector('#wall')
const canvas = document.querySelector('#scene')
const dialog = document.querySelector('#card-dialog')
const pauseButton = document.querySelector('#pause')
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const status = document.querySelector('#status')
const artworks = Array.from({ length: CARD_COUNT }, (_, index) => createCardArtwork(index))
const SEGMENTS = 48
const VERTICAL_SEGMENTS = 12
const instances = []
let paused = reduced.matches
let position = 0
let target = 0
let velocity = 0
let selectedRow = 0
let pointer = null
let previous = 0
let frame = 0
let resumeAt = 0
let visible = true
let contextLost = false
let layout
let hitObjects = []
let renderer
let scene
let camera
let raycaster
let edgeMaterial
let selectedEdgeMaterial
const mouse = new THREE.Vector2()

function updatePause() {
  pauseButton.setAttribute('aria-pressed', String(paused))
  pauseButton.setAttribute('aria-label', paused ? 'Play motion' : 'Pause motion')
  pauseButton.title = paused ? 'Play' : 'Pause'
  pauseButton.querySelector('path').setAttribute('d', paused ? 'm9 5 10 7-10 7Z' : 'M9 6v12M15 6v12')
}
function togglePause() {
  paused = !paused
  updatePause()
  status.textContent = paused ? 'Motion paused' : 'Motion playing'
  invalidate()
}
updatePause()
pauseButton.addEventListener('click', togglePause)

let opener = canvas
function openCard(index) {
  opener = document.activeElement
  const artwork = artworks[index]
  document.querySelector('#card-title').textContent = artwork.name
  const image = document.querySelector('#card-image')
  image.src = artwork.bitmap.toDataURL('image/png')
  image.alt = `${artwork.name}, a mint LW16 card with a fine geometric drawing`
  dialog.showModal()
  document.querySelector('#close-card').focus({ preventScroll: true })
}
document.querySelector('#close-card').addEventListener('click', () => dialog.close())
dialog.addEventListener('close', () => {
  resumeAt = performance.now() + 2000
  // without webgl the canvas is hidden, so focus goes back to the card button
  ;(canvas.hidden ? opener : canvas).focus({ preventScroll: true })
  invalidate()
})
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close()
})

function poseCard(instance) {
  const center = layout.room.middle + (mod(instance.column - position + CARD_COUNT / 2, CARD_COUNT) - CARD_COUNT / 2 + instance.copy * CARD_COUNT) * layout.pitch
  const start = center - layout.cardWidth / 2
  const left = Math.max(0, start)
  const right = Math.min(layout.room.length, start + layout.cardWidth)
  const rowCenter = instance.row * layout.rowPitch
  const latitudeLimit = layout.room.radius * layout.room.halfAngle
  const low = Math.max(-latitudeLimit, rowCenter - layout.cardHeight / 2)
  const high = Math.min(latitudeLimit, rowCenter + layout.cardHeight / 2)
  instance.mesh.visible = instance.edge.visible = right > left && high > low
  instance.edge.material = document.activeElement === canvas && instance.row === selectedRow && instance.column === mod(Math.round(target), CARD_COUNT) && instance.copy === 0 ? selectedEdgeMaterial : edgeMaterial
  if (!instance.mesh.visible) return
  const positions = instance.geometry.getAttribute('position')
  const uv = instance.geometry.getAttribute('uv')
  const edge = instance.edge.geometry.getAttribute('position')
  const rowSize = SEGMENTS + 1
  for (let row = 0; row <= VERTICAL_SEGMENTS; row++) {
    const height = high - (high - low) * row / VERTICAL_SEGMENTS
    const v = (height - rowCenter) / layout.cardHeight + .5
    for (let col = 0; col <= SEGMENTS; col++) {
      const distance = left + (right - left) * col / SEGMENTS
      const u = (distance - start) / layout.cardWidth
      const point = cardPoint(layout, center, instance.row, u, v)
      const i = row * rowSize + col
      positions.setXYZ(i, point.x, point.y, point.z)
      uv.setXY(i, u, v)
    }
  }
  let edgeIndex = 0
  const edgeVertex = index => {
    edge.setXYZ(edgeIndex++, positions.getX(index), positions.getY(index), positions.getZ(index) + .1)
  }
  for (let col = 0; col <= SEGMENTS; col++) edgeVertex(col)
  for (let row = 1; row <= VERTICAL_SEGMENTS; row++) edgeVertex(row * rowSize + SEGMENTS)
  for (let col = SEGMENTS - 1; col >= 0; col--) edgeVertex(VERTICAL_SEGMENTS * rowSize + col)
  for (let row = VERTICAL_SEGMENTS - 1; row > 0; row--) edgeVertex(row * rowSize)
  positions.needsUpdate = true
  instance.geometry.computeBoundingSphere()
  uv.needsUpdate = true
  edge.needsUpdate = true
  hitObjects.push(instance.mesh)
}

function render() {
  hitObjects = []
  for (const instance of instances) poseCard(instance)
  scene.updateMatrixWorld(true)
  renderer.render(scene, camera)
}
const autoPlaying = () => !paused && !pointer && !dialog.open
const canRender = () => renderer && visible && !document.hidden && !contextLost
function animate(now) {
  frame = 0
  if (!canRender()) return
  const dt = Math.min((now - (previous || now - 16)) / 1000, .032)
  previous = now
  if (!pointer && !dialog.open) {
    if (autoPlaying() && now > resumeAt) target += dt * .095
    if (reduced.matches) { position = target; velocity = 0 }
    else {
      velocity += ((target - position) * 105 - velocity * 21) * dt
      position += velocity * dt
    }
  }
  render()
  if (!dialog.open && (autoPlaying() || Math.abs(target - position) + Math.abs(velocity) > .0001)) frame = requestAnimationFrame(animate)
}
function invalidate() {
  if (!frame && canRender()) {
    previous = 0
    frame = requestAnimationFrame(animate)
  }
}
function resize() {
  layout = layoutWall(wall.clientWidth, wall.clientHeight)
  renderer.setSize(layout.width, layout.height, false)
  camera.position.set(0, 0, CAMERA_Z)
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(layout.height / (2 * CAMERA_Z)))
  camera.aspect = layout.width / layout.height
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  invalidate()
}
function hit(x, y) {
  const bounds = canvas.getBoundingClientRect()
  mouse.set((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2)
  raycaster.setFromCamera(mouse, camera)
  return raycaster.intersectObjects(hitObjects, false)[0]?.object.userData
}
function rest() { resumeAt = performance.now() + 2400 }
function finishPointer(event) {
  if (pointer?.id !== event.pointerId) return
  const ended = pointer
  pointer = null
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  canvas.style.cursor = 'grab'
  if (event.type !== 'pointercancel' && !ended.moved) {
    const card = hit(event.clientX, event.clientY)
    if (card) openCard(card.index)
  } else {
    const freshSpeed = ended.speed * Math.exp(-Math.max(0, event.timeStamp - ended.lastTime - 40) / 120)
    target = position + (reduced.matches ? 0 : freshSpeed * .14)
  }
  rest()
  invalidate()
}

function initialize() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor('#fafbf8')
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(35, 1, 1, 12000)
  raycaster = new THREE.Raycaster()
  const materials = artworks.map(artwork => {
    const texture = new THREE.CanvasTexture(artwork.bitmap)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    return new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide })
  })
  edgeMaterial = new THREE.LineBasicMaterial({ color: '#78ba8d', transparent: true, opacity: .28, depthWrite: false })
  selectedEdgeMaterial = new THREE.LineBasicMaterial({ color: '#3f7655', depthWrite: false })
  for (const row of ROWS) for (let column = 0; column < CARD_COUNT; column++) for (const copy of [-1, 0, 1]) {
    const index = mod(column + row * 7, CARD_COUNT)
    const geometry = new THREE.PlaneGeometry(1, 1, SEGMENTS, VERTICAL_SEGMENTS)
    geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage)
    geometry.getAttribute('uv').setUsage(THREE.DynamicDrawUsage)
    const mesh = new THREE.Mesh(geometry, materials[index])
    mesh.frustumCulled = false
    mesh.userData = { index, row, column }
    const edgeGeometry = new THREE.BufferGeometry()
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGMENTS + VERTICAL_SEGMENTS) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage))
    const edge = new THREE.LineLoop(edgeGeometry, edgeMaterial)
    edge.frustumCulled = false
    scene.add(mesh, edge)
    instances.push({ row, column, copy, geometry, mesh, edge })
  }

  canvas.addEventListener('focus', invalidate)
  canvas.addEventListener('blur', invalidate)
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    canvas.focus({ preventScroll: true })
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastTime: event.timeStamp, position, speed: 0, moved: false }
    target = position
    velocity = 0
    canvas.setPointerCapture(event.pointerId)
    canvas.style.cursor = 'grabbing'
    rest()
  })
  canvas.addEventListener('pointermove', event => {
    if (pointer?.id === event.pointerId) {
      const dx = event.clientX - pointer.x
      if (Math.hypot(dx, event.clientY - pointer.y) > 5) pointer.moved = true
      const step = layout.width < 650 ? layout.width * .32 : layout.width / 7.9
      position = target = pointer.position - dx / (step * 1.115)
      const dt = Math.max(8, event.timeStamp - pointer.lastTime) / 1000
      const speed = -(event.clientX - pointer.lastX) / (step * 1.115) / dt
      pointer.speed = THREE.MathUtils.clamp(pointer.speed * .6 + speed * .4, -12, 12)
      pointer.lastX = event.clientX
      pointer.lastTime = event.timeStamp
      invalidate()
    } else canvas.style.cursor = hit(event.clientX, event.clientY) ? 'pointer' : 'grab'
  })
  canvas.addEventListener('pointerup', finishPointer)
  canvas.addEventListener('pointercancel', finishPointer)
  canvas.addEventListener('wheel', event => {
    if (event.ctrlKey) return
    event.preventDefault()
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    const factor = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? layout.height : 1
    target += delta * factor / 260
    if (reduced.matches) position = target
    rest()
    invalidate()
  }, { passive: false })
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Home', ' '].includes(event.key)) return
    event.preventDefault()
    if (event.key === ' ') { togglePause(); return }
    if (event.key === 'Enter') { openCard(mod(Math.round(target) + selectedRow * 7, CARD_COUNT)); return }
    if (event.key === 'ArrowLeft') target = Math.round(target) - 1
    if (event.key === 'ArrowRight') target = Math.round(target) + 1
    if (event.key === 'ArrowUp') selectedRow = Math.min(1, selectedRow + 1)
    if (event.key === 'ArrowDown') selectedRow = Math.max(-1, selectedRow - 1)
    if (event.key === 'Home') { target = 0; selectedRow = 0 }
    if (reduced.matches) { position = target; velocity = 0 }
    const active = mod(Math.round(target) + selectedRow * 7, CARD_COUNT)
    status.textContent = `${artworks[active].name}. Row ${2 - selectedRow} of 3`
    rest()
    invalidate()
  })
  window.addEventListener('blur', () => {
    if (pointer) finishPointer({ pointerId: pointer.id, type: 'pointercancel', timeStamp: performance.now() })
  })
  new ResizeObserver(resize).observe(wall)
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) invalidate() }).observe(wall)
  document.addEventListener('visibilitychange', invalidate)
  reduced.addEventListener('change', () => {
    paused = reduced.matches
    position = target
    velocity = 0
    updatePause()
    invalidate()
  })
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault()
    contextLost = true
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  })
  canvas.addEventListener('webglcontextrestored', () => { contextLost = false; resize() })
  resize()
}

try { initialize() } catch {
  canvas.hidden = true
  pauseButton.hidden = true
  const fallback = document.querySelector('#fallback')
  fallback.hidden = false
  artworks.forEach((artwork, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('aria-label', `Open ${artwork.name}`)
    const image = document.createElement('img')
    image.src = artwork.bitmap.toDataURL('image/png')
    image.alt = ''
    button.append(image)
    button.addEventListener('click', () => openCard(index))
    fallback.append(button)
  })
}
