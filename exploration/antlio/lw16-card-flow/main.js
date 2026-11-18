import { GROUPS, STATES, next } from './flow.js?v=13'
import { cameraProblem, mockCamera, openCamera, trackFace } from './mirror.js?v=13'
import { BANK_CARD_MM, CARD_MM, readPxPerMm, savePxPerMm } from './realsize.js?v=14'
import * as sound from './sound.js?v=13'
import { DAYS } from './stamps.js?v=13'
import { LABEL_BAND, createTicket } from './ticket.js?v=18'

const ENGRAVE_MS = 2400
const STAMP_MS = 1300
// a link from the code on a card: handle, card number and stamp count
const SHARED_CARD = /^([A-Za-z0-9_.-]{1,18})\.(\d{1,4})\.([0-5])$/
const DEMO_IDENTITY = { handle: 'antlio', number: 481 }
const MATERIALS = ['smoke', 'chrome']
const THEMES = ['light', 'dark']
const ARTS = ['stamps', 'quadtree']
const ARROW_ICON =
  '<svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v4a3 3 0 0 0 3 3h7" /><path d="m10 7 3 3-3 3" /></svg>'

const $ = (selector) => document.querySelector(selector)
const page = $('.state-page')
const stage = $('#study')
const video = $('#camera')
const switcher = $('#switcher')
const select = $('#switcher-select')
const handleInput = $('#handle')
const feedNote = $('#feed-note')
const deniedNote = $('#denied-note')
const readyNote = $('#ready-note')
const stampButton = $('#stamp')
const mirrorButton = $('#mirror')
const textureButton = $('#texture')
const soundButton = $('#sound')
const artButton = $('#art')
const realNote = $('#real-note')
const ruler = $('#ruler')
const bankCard = $('#bank-card')
const scaleInput = $('#scale')

const url = new URL(location.href)
const readParam = (name, allowed, fallback) => {
  const value = url.searchParams.get(name)
  return allowed.includes(value) ? value : fallback
}
const writeParam = (name, value) => {
  url.searchParams.set(name, value)
  history.replaceState(null, '', url)
}

const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const lerp = (from, to, t) => from + (to - from) * t
const easeOut = (t) => 1 - (1 - t) ** 3

const tween = ({ duration, update, signal }) =>
  new Promise((resolve) => {
    if (isMotionReduced) {
      update(1)
      return resolve()
    }
    const start = performance.now()
    const step = (now) => {
      if (signal.aborted) return resolve()
      const t = Math.min((now - start) / duration, 1)
      update(t)
      t < 1 ? requestAnimationFrame(step) : resolve()
    }
    requestAnimationFrame(step)
  })

const shared = url.searchParams.get('c')?.match(SHARED_CARD)
let state = shared ? 'ready' : readParam('__state', Object.keys(STATES), 'idle')
let material = readParam('material', MATERIALS, 'smoke')
let theme = readParam('theme', THEMES, 'light')
let art = readParam('art', ARTS, 'stamps')
let identity = shared ? { handle: shared[1], number: Number(shared[2]) } : DEMO_IDENTITY
let stamps = shared
  ? Number(shared[3])
  : Math.min(Math.max(Math.trunc(Number(url.searchParams.get('stamps'))) || 0, 0), DAYS.length)
let run = new AbortController()
let feed = null
let grantedCamera = null
let stopEngraveSound = () => {}
let ticket

try {
  ticket = createTicket({
    canvas: $('#scene'),
    isMotionReduced,
    onTap: () => sound.tap(material),
  })
} catch (error) {
  console.error(error)
  $('#scene').hidden = true
  $('#fallback').hidden = false
}

const closeFeed = () => {
  feed?.stop()
  feed = null
  video.srcObject = null
  ticket.setVideo(null)
  ticket.setFace(null)
  ticket.params.mirror = 0
}

const render = () => {
  for (const block of stage.querySelectorAll('[data-for]')) {
    block.hidden = block.dataset.for !== state
  }
  for (const node of stage.querySelectorAll('[data-text="handle"]')) {
    node.textContent = `@${identity.handle}`
  }
  for (const node of stage.querySelectorAll('[data-text="number"]')) {
    node.textContent = `#${String(identity.number).padStart(4, '0')}`
  }
  for (const button of switcher.querySelectorAll('button')) {
    const isActive = button.dataset.state === state
    button.setAttribute('aria-pressed', isActive)
    if (isActive) button.scrollIntoView({ block: 'nearest' })
  }
  select.value = state

  const number = `#${String(identity.number).padStart(4, '0')}`
  const nextDay = DAYS[stamps]
  readyNote.textContent = nextDay
    ? `Ticket ${number}. Day ${stamps + 1} is live: ${nextDay.feature}. Scan the code with a phone to see the card at real size.`
    : `Ticket ${number}. All ${DAYS.length} days are on your card. Scan the code with a phone to see it at real size.`
  stampButton.hidden = !nextDay
  stampButton.textContent = `Engrave day ${stamps + 1}`
  mirrorButton.className = nextDay ? 'quiet' : 'primary'
  $('#stamp-title').textContent = `Engraving day ${stamps}`
  $('#stamp-note').textContent = DAYS[stamps - 1]?.feature ?? ''
}

// the code on the card opens this page on that card, at real size
const drawCard = () => {
  const link = `${location.origin}${location.pathname}?c=${identity.handle}.${identity.number}.${stamps}`
  ticket.setDesign({ ...identity, stamps, link, art })
  artButton.textContent = `Art: ${art}`
}

const setStamps = (count) => {
  stamps = count
  writeParam('stamps', count)
  drawCard()
}

const showRealSize = () => {
  const pxPerMm = readPxPerMm()
  const width = CARD_MM.width * pxPerMm
  const room = Math.min(
    stage.clientWidth,
    ((stage.clientHeight - 120) * CARD_MM.width) / CARD_MM.height
  )
  ticket.setRealWidth(Math.min(width, room))
  realNote.textContent =
    width > room
      ? `This screen is too small for real size. Shown at ${Math.round((room / width) * 100)}%.`
      : `Real size: ${CARD_MM.width} × ${CARD_MM.height} mm`
  // the outline stands upright, so a bank card fits on a phone screen
  bankCard.style.width = `${BANK_CARD_MM.height * pxPerMm}px`
  bankCard.style.height = `${BANK_CARD_MM.width * pxPerMm}px`
  scaleInput.value = pxPerMm
}

const handleScaleInput = () => {
  savePxPerMm(scaleInput.value)
  showRealSize()
}

const handleRulerToggle = () => {
  ruler.hidden = !ruler.hidden
}

const startMirror = async (signal) => {
  let problem = ''
  const camera =
    grantedCamera ??
    (await openCamera().catch((error) => {
      problem = cameraProblem(error)
      return null
    })) ??
    mockCamera()
  grantedCamera = null
  if (signal.aborted) return camera.stop()
  feed = camera
  video.srcObject = camera.stream
  // a feed closed during play rejects the play, and the abort check below handles that
  await video.play().catch((error) => {
    if (error.name !== 'AbortError') throw error
  })
  if (signal.aborted) return
  ticket.setVideo(video)
  sound.lens()
  tween({ duration: 600, signal, update: (t) => (ticket.params.mirror = easeOut(t)) })

  if (camera.face) {
    feedNote.textContent = `${problem} This is a drawn stand-in.`
    const poll = setInterval(() => ticket.setFace(camera.face()), 66)
    signal.addEventListener('abort', () => clearInterval(poll))
    return
  }
  feedNote.textContent = 'Tilt the ticket to move your reflection.'
  trackFace({ video, onFace: ticket.setFace, signal }).catch((error) => {
    // the reflection still works without tracking, it only stops following the face
    console.warn('Face tracking is unavailable', error)
  })
}

const enter = async ({ from, isAuto }) => {
  run.abort()
  run = new AbortController()
  const { signal } = run
  stopEngraveSound()

  const params = ticket.params
  const isEngraved = !['idle', 'claim', 'engrave'].includes(state)
  Object.assign(params, { scanOn: 0, cut: isEngraved ? 0 : 2, cutStamp: -1, pending: null })
  // a stamp state opened from the list needs one stamp to draw
  if (state === 'stamp' && (isAuto || stamps === 0)) setStamps(stamps + 1)
  // the abort above stopped the face poll, so a new start of the same state opens the feed again
  if (state !== 'mirror-live' || from === 'mirror-live') closeFeed()
  render()
  if (isAuto) {
    const block = stage.querySelector(`[data-for="${state}"]`)
    ;(block.querySelector('input, button:not([hidden])') ?? block.querySelector('h2')).focus()
  }

  if (state === 'engrave') {
    if (!isMotionReduced) {
      stopEngraveSound = sound.engrave(ENGRAVE_MS / 1000, ticket.engraveDensity())
    }
    params.scanOn = 1
    await tween({
      duration: ENGRAVE_MS,
      signal,
      update: (t) => {
        params.scanY = lerp(LABEL_BAND.top, LABEL_BAND.bottom, t)
        params.cut = params.scanY
      },
    })
    if (signal.aborted) return
    params.scanOn = 0
    params.cut = 0
    if (isAuto) send('DONE')
    return
  }

  if (state === 'stamp') {
    const index = stamps - 1
    const rect = ticket.stampRect(index)
    if (!isMotionReduced) {
      stopEngraveSound = sound.engrave(STAMP_MS / 1000, ticket.stampDensity(index))
    }
    Object.assign(params, { pending: rect, cutStamp: rect.top, scanOn: 1 })
    await tween({
      duration: STAMP_MS,
      signal,
      update: (t) => {
        params.scanY = lerp(rect.top, rect.bottom, t)
        params.cutStamp = params.scanY
      },
    })
    if (signal.aborted) return
    Object.assign(params, { pending: null, cutStamp: -1, scanOn: 0 })
    sound.tap(material)
    if (isAuto) send('DONE')
    return
  }

  const isCardFull = from === 'stamp' && stamps === DAYS.length
  if (state === 'ready' && (from === 'engrave' || isCardFull)) {
    sound.chime()
    ticket.spin()
  }

  if (state === 'mirror-asking' && isAuto) {
    try {
      const camera = await openCamera()
      if (signal.aborted) return camera.stop()
      grantedCamera = camera
      send('GRANTED')
    } catch (error) {
      if (signal.aborted) return
      deniedNote.textContent = cameraProblem(error)
      send('DENIED')
    }
    return
  }

  if (state === 'mirror-live' && !feed) await startMirror(signal)
}

const setState = (to, { isAuto }) => {
  const from = state
  state = to
  writeParam('__state', to)
  enter({ from, isAuto })
}

const send = (event) => {
  const to = next(state, event)
  if (to !== state) setState(to, { isAuto: true })
}

const setMaterial = (name) => {
  material = name
  ticket.setMaterial(name)
  for (const button of document.querySelectorAll('[data-material]')) {
    button.setAttribute('aria-pressed', button.dataset.material === name)
  }
}

const setTheme = (name) => {
  theme = name
  document.documentElement.dataset.theme = name
  ticket.setTheme(name)
  for (const button of document.querySelectorAll('[data-theme-option]')) {
    button.setAttribute('aria-pressed', button.dataset.themeOption === name)
  }
}

const buildSwitcher = () => {
  for (const group of GROUPS) {
    const headingId = `states-${group.id}`
    const section = document.createElement('div')
    section.className = 'state-switcher-group'
    section.setAttribute('role', 'group')
    section.setAttribute('aria-labelledby', headingId)
    const heading = document.createElement('span')
    heading.className = 'state-switcher-heading'
    heading.id = headingId
    heading.innerHTML = ARROW_ICON
    heading.append(group.label)
    section.append(heading)
    const options = document.createElement('optgroup')
    options.label = group.label
    for (const name of group.states) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.state = name
      button.textContent = STATES[name].label
      section.append(button)
      options.append(new Option(STATES[name].label, name))
    }
    switcher.append(section)
    select.append(options)
  }
}

const handleSwitcherKey = (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return
  }
  if (event.target.closest('input, textarea, select, [contenteditable]')) return
  if (event.key.toLowerCase() === 'h') return page.classList.toggle('is-bare')
  const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key]
  if (!step) return
  event.preventDefault()
  const order = GROUPS.flatMap((group) => group.states)
  const index = (order.indexOf(state) + step + order.length) % order.length
  setState(order[index], { isAuto: false })
}

const handleClick = (event) => {
  const button = event.target.closest('button')
  if (!button) return
  if (stage.contains(button)) sound.pop()
  if (button.dataset.state) setState(button.dataset.state, { isAuto: false })
  if (button.dataset.send === 'RESET') setStamps(0)
  if (button.dataset.send) send(button.dataset.send)
  if (button.dataset.material) {
    setMaterial(button.dataset.material)
    writeParam('material', material)
    sound.tap(material)
  }
  if (button.dataset.themeOption) {
    setTheme(button.dataset.themeOption)
    writeParam('theme', theme)
  }
  if (button.id === 'flip' || button.id === 'flip-live') {
    ticket.flip()
    sound.flip()
  }
}

const handleClaimSubmit = (event) => {
  event.preventDefault()
  identity = { ...DEMO_IDENTITY, handle: handleInput.value.trim().replace(/^@+/, '') }
  drawCard()
  send('SUBMIT')
}

const handleArtToggle = () => {
  art = ARTS[(ARTS.indexOf(art) + 1) % ARTS.length]
  writeParam('art', art)
  drawCard()
}

const handleSoundToggle = () => {
  const isOn = soundButton.getAttribute('aria-pressed') !== 'true'
  soundButton.setAttribute('aria-pressed', isOn)
  sound.setMuted(!isOn)
}

const handleHover = (event) => {
  const button = event.target.closest?.('button')
  if (button && !button.contains(event.relatedTarget)) sound.tick()
}

const handleDragOver = (event) => {
  event.preventDefault()
  stage.classList.add('is-dropping')
}

const handleDragEnd = () => stage.classList.remove('is-dropping')

const handleDrop = async (event) => {
  event.preventDefault()
  handleDragEnd()
  const file = event.dataTransfer.files[0]
  if (!file?.type.startsWith('image/')) return
  const surface = await createImageBitmap(file).catch((error) => {
    console.warn('The dropped image could not be read', error)
  })
  if (!surface) return
  ticket.setSurface(surface)
  textureButton.hidden = false
}

const handleTextureClear = () => {
  ticket.setSurface(null)
  textureButton.hidden = true
}

if (ticket) {
  buildSwitcher()
  drawCard()
  setMaterial(material)
  setTheme(theme)
  enter({ from: null, isAuto: false })

  addEventListener('pointerdown', sound.unlock, { capture: true })
  addEventListener('keydown', sound.unlock, { capture: true })
  document.addEventListener('click', handleClick)
  select.addEventListener('change', () => setState(select.value, { isAuto: false }))
  $('#claim-form').addEventListener('submit', handleClaimSubmit)
  soundButton.addEventListener('click', handleSoundToggle)
  artButton.addEventListener('click', handleArtToggle)
  textureButton.addEventListener('click', handleTextureClear)
  stage.addEventListener('pointerover', handleHover)
  stage.addEventListener('dragover', handleDragOver)
  stage.addEventListener('dragleave', handleDragEnd)
  stage.addEventListener('drop', handleDrop)

  if (shared) {
    page.classList.add('is-bare', 'is-real')
    $('#real').hidden = false
    showRealSize()
    addEventListener('resize', showRealSize)
    scaleInput.addEventListener('input', handleScaleInput)
    $('#calibrate').addEventListener('click', handleRulerToggle)
    $('#calibrate-done').addEventListener('click', handleRulerToggle)
    // a shared card shows one state only, so the keys of the switcher do nothing
  } else addEventListener('keydown', handleSwitcherKey)
}
