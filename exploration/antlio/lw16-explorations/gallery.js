import { groups, studies } from './studies.js?v=20'

const grid = document.querySelector('#studies')
const filters = document.querySelector('#filters')
const viewer = document.querySelector('#viewer')
const stage = document.querySelector('#viewer-stage')
const loading = document.querySelector('#loading')
const query = new URLSearchParams(location.search)
let group = groups.some(item => item.id === query.get('group')) ? query.get('group') : 'all'
let active = null
let returnFocus = null
let closeTimer = 0
const cards = new Map()
const filterButtons = new Map()
const visibleStudies = () => studies.filter(study => group === 'all' || study.group === group)

function updateURL() {
  const url = new URL(location.href)
  if (group === 'all') url.searchParams.delete('group')
  else url.searchParams.set('group', group)
  if (active) url.searchParams.set('study', active.id)
  else url.searchParams.delete('study')
  history.replaceState(null, '', url)
}

for (const item of groups) {
  const button = document.createElement('button')
  const count = item.id === 'all' ? studies.length : studies.filter(study => study.group === item.id).length
  button.type = 'button'
  button.textContent = item.label
  button.setAttribute('aria-label', `${item.label}, ${count} ${count === 1 ? 'exploration' : 'explorations'}`)
  button.setAttribute('aria-controls', 'studies')
  button.addEventListener('click', () => {
    group = item.id
    renderFilter()
    updateURL()
  })
  filterButtons.set(item.id, button)
  filters.append(button)
}

studies.forEach((study, index) => {
  const card = document.createElement('li')
  card.className = 'card'
  card.dataset.study = study.id
  card.innerHTML = `
    <article>
      <button class="preview" type="button" style="--preview:${study.color}" aria-label="Preview ${study.title}" aria-haspopup="dialog">
        <img src="./previews/${study.image}" alt="" width="1280" height="720" loading="${index < 4 ? 'eager' : 'lazy'}" decoding="async">
        <span class="preview-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6 18 12 9 18Z"/></svg></span>
      </button>
      <div class="card-meta"><h2>${study.title}</h2><a class="open-study" href="${study.href}" aria-label="Open ${study.title} page" title="Open ${study.title}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a></div>
    </article>`
  const preview = card.querySelector('.preview')
  preview.addEventListener('click', () => openPreview(study, preview))
  cards.set(study.id, card)
  grid.append(card)
})

function renderFilter() {
  filterButtons.forEach((button, id) => button.setAttribute('aria-pressed', String(id === group)))
  for (const study of studies) cards.get(study.id).hidden = group !== 'all' && study.group !== group
  const count = visibleStudies().length
  document.querySelector('#count').textContent = `${count} ${count === 1 ? 'exploration' : 'explorations'}`
}

function openPreview(study, trigger = null) {
  clearTimeout(closeTimer)
  active = study
  if (trigger) returnFocus = trigger
  document.querySelector('#viewer-title').textContent = study.title
  document.querySelector('#viewer-open').href = study.href
  document.querySelector('#viewer-open').setAttribute('aria-label', `Open ${study.title} page`)
  loading.hidden = false
  stage.querySelector('iframe')?.remove()
  stage.style.backgroundColor = study.color
  stage.style.backgroundImage = `url("./previews/${study.image}")`
  const frame = document.createElement('iframe')
  frame.title = `${study.title} interactive preview`
  frame.src = study.href
  frame.addEventListener('load', () => {
    if (!frame.isConnected || active !== study) return
    frame.classList.add('loaded')
    stage.style.backgroundImage = ''
    loading.hidden = true
  })
  stage.append(frame)
  document.body.classList.add('preview-open')
  viewer.classList.remove('is-closing')
  if (!viewer.open) {
    viewer.showModal()
    void viewer.offsetWidth
    viewer.classList.add('is-open')
    document.querySelector('#viewer-close').focus({ preventScroll: true })
  } else viewer.classList.add('is-open')
  updateURL()
}

function closePreview() {
  if (!viewer.open || viewer.classList.contains('is-closing')) return
  viewer.classList.remove('is-open')
  viewer.classList.add('is-closing')
  const closeMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur')) || 150
  closeTimer = setTimeout(() => {
    viewer.close()
    viewer.classList.remove('is-closing')
    stage.querySelector('iframe')?.remove()
    stage.style.backgroundImage = ''
    document.body.classList.remove('preview-open')
    active = null
    updateURL()
    returnFocus?.focus({ preventScroll: true })
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : closeMs)
}
function stepPreview(direction) {
  if (!active) return
  const list = visibleStudies()
  const index = (list.indexOf(active) + direction + list.length) % list.length
  openPreview(list[index])
}
document.querySelector('#viewer-close').addEventListener('click', closePreview)
document.querySelector('#viewer-previous').addEventListener('click', () => stepPreview(-1))
document.querySelector('#viewer-next').addEventListener('click', () => stepPreview(1))
viewer.addEventListener('cancel', event => { event.preventDefault(); closePreview() })
viewer.addEventListener('click', event => {
  if (event.target !== viewer) return
  const rect = viewer.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePreview()
})
renderFilter()
const requestedStudy = studies.find(study => study.id === query.get('study'))
if (requestedStudy) {
  if (group !== 'all' && requestedStudy.group !== group) { group = 'all'; renderFilter() }
  openPreview(requestedStudy, cards.get(requestedStudy.id).querySelector('.preview'))
}
