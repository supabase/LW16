import * as THREE from 'three'
import { makeRoom, sampleRoom } from './room-path.js'

const CAMERA_Z = 2000
const SEGMENTS = 96
const COPIES = [-1, 0, 1]
const mod = (value, length) => THREE.MathUtils.euclideanModulo(value, length)

export function createCorridor(scene, camera) {
  const posters = []
  const instances = []
  let room = null
  let centers = []
  let period = 1
  let width = 1
  let height = 1
  let scale = 1
  let hitObjects = []

  function meshPair(template, index) {
    const frontSource = template.children.find(child => child.isMesh && child.material.map)
    const backSource = template.children.find(child => child.isMesh && child.material.side === THREE.BackSide)
    const geometry = new THREE.PlaneGeometry(1, 1, SEGMENTS, 1)
    geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage)
    geometry.getAttribute('uv').setUsage(THREE.DynamicDrawUsage)
    const front = new THREE.Mesh(geometry, frontSource.material)
    const back = new THREE.Mesh(geometry, backSource.material)
    const edgeGeometry = new THREE.BufferGeometry()
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage))
    const edge = new THREE.LineLoop(edgeGeometry, new THREE.LineBasicMaterial({ color: '#c8c8c8', depthWrite: false }))
    const group = new THREE.Group()
    group.add(front, back, edge)
    scene.add(group)
    for (const mesh of [front, back, edge]) mesh.frustumCulled = false
    front.userData = { exhibit: index, type: 'poster' }
    back.userData = { exhibit: index, type: 'poster' }
    return { index, group, geometry, front, back, edge }
  }

  function add(index, template) {
    const front = template.children.find(child => child.isMesh && child.material.map)
    const { width, height } = front.geometry.parameters
    posters[index] = { width, height }
    for (const copy of COPIES) instances.push({ ...meshPair(template, index), copy })
  }

  function layout(w, h) {
    width = w
    height = h
    scale = Math.min(height * .66, 560) / 6.7
    const widths = posters.map(p => p.width * scale)
    const average = widths.reduce((a, b) => a + b, 0) / widths.length
    const maximum = Math.max(...widths)
    const flatWidth = maximum * 1.32
    const radius = average * (width < 650 ? .52 : .72)
    const depth = average * (width < 650 ? 2.7 : 3.2)
    const half = flatWidth / 2 + radius
    const front = Math.max(240, CAMERA_Z * (1 - half / (width / 2 + 110)) + maximum / 2 + 100)
    room = makeRoom({ flatWidth, radius, depth, front })
    const gap = average * .72
    centers = [0]
    for (let i = 1; i < posters.length; i++) centers.push(centers[i - 1] + widths[i - 1] / 2 + gap + widths[i] / 2)
    period = centers.at(-1) + widths.at(-1) / 2 + gap + widths[0] / 2
    camera.position.set(0, 0, CAMERA_Z)
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / (2 * CAMERA_Z)))
    camera.aspect = width / height
    camera.near = 1
    camera.far = 20000
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  function offset(position) {
    const whole = Math.floor(position)
    const i = mod(whole, posters.length)
    const cycle = Math.floor(whole / posters.length)
    const a = centers[i] + cycle * period
    const b = (i === posters.length - 1 ? period : centers[i + 1]) + cycle * period
    return THREE.MathUtils.lerp(a, b, position - whole)
  }
  function nearestCenter(index, position) {
    return room.middle + mod(centers[index] - offset(position) + period / 2, period) - period / 2
  }
  function settings(index, center, options) {
    const selected = options.liftedIndex === index
    const lift = selected ? options.lift : 0
    const factor = 1 + lift * .16
    const w = posters[index].width * scale * factor
    const h = posters[index].height * scale * factor
    return {
      width: w, height: h,
      y: lift * (width < 650 ? 100 : 16),
      angle: selected ? options.turn : 0,
      pivot: sampleRoom(room, center),
    }
  }
  function rotate(point, pose) {
    if (Math.abs(pose.angle) < .00001) return point
    const x = point.x - pose.pivot.x, z = point.z - pose.pivot.z
    const c = Math.cos(pose.angle), s = Math.sin(pose.angle)
    return { ...point, x: pose.pivot.x + x * c + z * s, z: pose.pivot.z - x * s + z * c }
  }
  function bend(geometry, center, span, sheetHeight, y, pose) {
    const start = center - span / 2
    const left = Math.max(0, start)
    const right = Math.min(room.length, start + span)
    if (right <= left) return false
    const positions = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')
    const row = SEGMENTS + 1
    for (let col = 0; col <= SEGMENTS; col++) {
      const distance = left + (right - left) * col / SEGMENTS
      const point = rotate(sampleRoom(room, distance), pose)
      positions.setXYZ(col, point.x, y + sheetHeight / 2, point.z)
      positions.setXYZ(col + row, point.x, y - sheetHeight / 2, point.z)
      const u = (distance - start) / span
      uv.setX(col, u)
      uv.setX(col + row, u)
    }
    positions.needsUpdate = true
    uv.needsUpdate = true
    geometry.computeBoundingSphere()
    return true
  }
  function update(position, options) {
    if (!room) return
    hitObjects = []
    for (const instance of instances) {
      const canonical = nearestCenter(instance.index, position)
      const center = canonical + instance.copy * period
      const pose = settings(instance.index, center, options)
      const visible = bend(instance.geometry, center, pose.width, pose.height, pose.y, pose)
      instance.group.visible = visible
      if (!visible) continue
      const positions = instance.geometry.getAttribute('position')
      const edge = instance.edge.geometry.getAttribute('position')
      const row = SEGMENTS + 1
      for (let col = 0; col < row; col++) {
        edge.setXYZ(col, positions.getX(col), positions.getY(col), positions.getZ(col))
        const bottom = row + SEGMENTS - col
        edge.setXYZ(row + col, positions.getX(bottom), positions.getY(bottom), positions.getZ(bottom))
      }
      edge.needsUpdate = true
      hitObjects.push(instance.front, instance.back)
    }
  }

  function hit(event) {
    return { index: event.object.userData.exhibit }
  }
  return { add, layout, update, hit, get hitObjects() { return hitObjects } }
}
