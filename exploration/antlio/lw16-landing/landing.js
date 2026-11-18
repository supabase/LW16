import { DAYS } from '../lw16-card-flow/stamps.js?v=13'
import { createCrowd } from './crowd.js?v=25'
import { INTRO_SECONDS, clamp01, readRoll, smoothstep } from './layouts.js?v=11'
import { weekOn } from './week.js?v=1'

const FADE = 0.025
// screens of scroll: for the stages of the tickets, then for the launch cards and the closing
// line. keep in step with the height of .journey in style.css
const SCREENS = { main: 5, tail: 2 }
// the parts of the tail, from 0 to 1: the scroll rolls the launch cards until `cards`, then
// the closing line takes the place of the heading of the cards
const TAIL = { cards: 0.7, outro: [0.76, 0.92] }

const journey = document.querySelector('#journey')
const week = document.querySelector('#week')
const prism = document.querySelector('#prism')
const ring = document.querySelector('#ring')
const frontDay = document.querySelector('#front-day')
const outro = document.querySelector('#outro')
const captions = [...document.querySelectorAll('.caption')].map((element) => {
  const [from, to] = element.dataset.range.split(',').map(Number)
  return { element, from, to }
})
const isMotionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
// ?today=2026-12-08 shows the week as it is on that day
const givenDay = new URLSearchParams(location.search).get('today')
const today = /^\d{4}-\d{2}-\d{2}$/.test(givenDay)
  ? givenDay
  : new Date().toLocaleDateString('en-CA')
const days = weekOn(today, DAYS.length)
let scrolled = 0
let previous = 0
let start
let crowd
let shownDay = -1

// the words of a day card. a locked day does not say what it launches
const dayLine = (index) => {
  const { date, isLocked, isLive } = days[index]
  const when = `${date.slice(8)} Dec`
  if (isLocked) return `Day ${index + 1}, locked. Unlocks ${when}`
  return `Day ${index + 1}, ${DAYS[index].feature}. ${isLive ? 'Live now' : `Shipped ${when}`}`
}

const frame = (now) => {
  requestAnimationFrame(frame)
  // the clock starts at the first frame, so a slow load does not eat the opening
  start ??= now
  const time = (now - start) / 1000
  const dt = Math.min(time - previous, 0.1)
  previous = time
  const { top } = journey.getBoundingClientRect()
  const target = Math.min(Math.max(-top / innerHeight, 0), SCREENS.main + SCREENS.tail)
  scrolled = isMotionReduced ? target : scrolled + (target - scrolled) * (1 - Math.exp(-dt * 7))
  const progress = Math.min(scrolled / SCREENS.main, 1)
  const tail = clamp01((scrolled - SCREENS.main) / SCREENS.tail)

  for (const { element, from, to } of captions) {
    const opacity = Math.min((progress - from) / FADE, (to - progress) / FADE, 1)
    element.style.opacity = Math.max(opacity, 0)
    element.inert = opacity < 0.5
  }

  // the pile rolls into a prism of the day cards. after that the scroll rolls the prism one
  // card at a time, with a rest on each card
  const roll = readRoll({ progress, faces: DAYS.length, face: prism.offsetWidth / innerHeight })
  const steps = clamp01(tail / TAIL.cards) * (DAYS.length - 1)
  const card = Math.floor(steps)
  const turn = card + smoothstep(0.2, 0.8, steps - card)
  roll.behind += (turn * Math.PI * 2) / DAYS.length
  if (Math.round(turn) !== shownDay) {
    shownDay = Math.round(turn)
    frontDay.textContent = dayLine(shownDay)
  }

  const outroShown = smoothstep(...TAIL.outro, tail)
  week.style.opacity = 1 - outroShown
  outro.style.opacity = outroShown
  outro.inert = outroShown < 0.5

  // with reduced motion the tickets do not move on their own clock
  crowd.update({ progress, time: isMotionReduced ? INTRO_SECONDS : time, roll })
}

ring.innerHTML = DAYS.map((_, index) => `<li>${dayLine(index)}</li>`).join('')

try {
  crowd = createCrowd({
    canvas: document.querySelector('#crowd'),
    // a day card shows the stamps of the days up to its own, and a locked day shows none
    days: days.map(({ isLocked }, index) => ({
      title: `DAY ${index + 1}`,
      number: index + 1,
      stamps: isLocked ? 0 : index + 1,
      link: `https://supabase.com/launch-week/16/day-${index + 1}`,
    })),
  })
  requestAnimationFrame(frame)
} catch (error) {
  // without WebGL the page still reads top to bottom as plain text
  console.error(error)
  document.documentElement.classList.add('is-static')
}
