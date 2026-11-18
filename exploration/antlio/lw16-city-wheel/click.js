// the click of the wheel, made with web audio: a small metal switch. a very short snap of
// noise, and the short ring of its spring
let context
let noise

// a browser starts audio only after a press or a key, not after the mouse wheel
export const unlock = () => {
  if (!context) {
    context = new AudioContext()
    noise = context.createBuffer(1, context.sampleRate * 0.05, context.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (context.state === 'suspended') context.resume()
}

// clicks closer than this, in seconds, are one run. each click of a run is higher, up to the
// top, and a pause brings the pitch back down
const RUN = { gap: 0.22, step: 0.07, top: 2 }
let last = 0
let bend = 1

const fade = (at, gain, duration) => {
  const node = context.createGain()
  node.gain.setValueAtTime(gain, at)
  node.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  node.connect(context.destination)
  return node
}

export const click = () => {
  if (context?.state !== 'running') return
  const at = context.currentTime
  bend = at - last < RUN.gap ? Math.min(bend + RUN.step, RUN.top) : 1
  last = at
  // no two clicks of a real switch are the same
  const pitch = bend * (1 + (Math.random() - 0.5) * 0.06)

  // the snap: a very short burst of bright noise
  const snap = context.createBufferSource()
  snap.buffer = noise
  const high = context.createBiquadFilter()
  high.type = 'highpass'
  high.frequency.value = 2500 * pitch
  snap.connect(high).connect(fade(at, 0.8, 0.006))
  snap.start(at)

  // the ring of the small spring under the snap. it bends down in the click, so the click
  // has a pitch that goes up with the run
  const ring = context.createOscillator()
  ring.type = 'square'
  ring.frequency.setValueAtTime(1800 * pitch, at)
  ring.frequency.exponentialRampToValueAtTime(900 * pitch, at + 0.018)
  ring.connect(fade(at, 0.12, 0.018))
  ring.start(at)
  ring.stop(at + 0.03)
}

// a short note, from the frequency to the end frequency
const note = ({ type, from, to = from, delay = 0, duration, gain }) => {
  const at = context.currentTime + delay
  const oscillator = context.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, at)
  oscillator.frequency.exponentialRampToValueAtTime(to, at + duration)
  const amp = context.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.006)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  // a lowpass takes the hard edge off a square wave, so it sounds like an old speaker
  const soft = context.createBiquadFilter()
  soft.type = 'lowpass'
  soft.frequency.value = 2400
  oscillator.connect(soft).connect(amp).connect(context.destination)
  oscillator.start(at)
  oscillator.stop(at + duration + 0.02)
}

// the sound of a city when the wheel stops on it: open goes up, nearing capacity is one
// note, and the waiting list goes down, lower and duller
const STATUS_NOTES = {
  open: [
    { type: 'triangle', from: 880, duration: 0.09, gain: 0.3 },
    { type: 'triangle', from: 1320, delay: 0.08, duration: 0.16, gain: 0.3 },
  ],
  nearing: [{ type: 'triangle', from: 990, to: 960, duration: 0.2, gain: 0.3 }],
  full: [
    { type: 'square', from: 330, duration: 0.1, gain: 0.12 },
    { type: 'square', from: 247, to: 233, delay: 0.1, duration: 0.2, gain: 0.12 },
  ],
}

export const settle = (status) => {
  if (context?.state !== 'running') return
  for (const part of STATUS_NOTES[status]) note(part)
}
