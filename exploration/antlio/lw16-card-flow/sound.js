const VOLUME = 0.6

let context
let output
let reverb
let noiseBuffer
let isMuted = false
let tickCount = 0

const vary = () => 1 + (Math.random() - 0.5) * 0.06

export const unlock = () => {
  if (!context) {
    context = new AudioContext()
    output = context.createGain()
    output.gain.value = isMuted ? 0 : VOLUME
    output.connect(context.destination)

    const length = context.sampleRate * 1.8
    const impulse = context.createBuffer(2, length, context.sampleRate)
    for (const channel of [0, 1]) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
    }
    reverb = context.createConvolver()
    reverb.buffer = impulse
    const wet = context.createGain()
    wet.gain.value = 0.3
    reverb.connect(wet).connect(output)

    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
    const noise = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1
  }
  if (context.state === 'suspended') context.resume()
}

// a sound scheduled on a suspended context plays late, when the context resumes
const live = () => (context?.state === 'running' && !isMuted ? context : null)

const envelope = (ac, { at, duration, gain, attack }) => {
  const node = ac.createGain()
  node.gain.setValueAtTime(0.0001, at)
  node.gain.exponentialRampToValueAtTime(gain, at + attack)
  node.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  return node
}

const tone = (
  ac,
  { type = 'sine', frequency, to, delay = 0, duration, gain, attack = 0.004, isWet }
) => {
  const at = ac.currentTime + delay
  const oscillator = ac.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, at)
  if (to) oscillator.frequency.exponentialRampToValueAtTime(to, at + duration)
  const amp = envelope(ac, { at, duration, gain, attack })
  oscillator.connect(amp).connect(output)
  if (isWet) amp.connect(reverb)
  oscillator.start(at)
  oscillator.stop(at + duration + 0.05)
}

const hiss = (
  ac,
  { filter = 'bandpass', frequency, to, q = 1, delay = 0, duration, gain, attack = 0.003 }
) => {
  const at = ac.currentTime + delay
  const source = ac.createBufferSource()
  source.buffer = noiseBuffer
  source.loop = true
  const biquad = ac.createBiquadFilter()
  biquad.type = filter
  biquad.Q.value = q
  biquad.frequency.setValueAtTime(frequency, at)
  if (to) biquad.frequency.exponentialRampToValueAtTime(to, at + duration)
  source.connect(biquad).connect(envelope(ac, { at, duration, gain, attack })).connect(output)
  source.start(at, Math.random())
  source.stop(at + duration + 0.05)
}

const bell = (ac, { frequency, delay = 0, gain = 0.08 }) => {
  const partials = [
    { ratio: 1, level: 1, duration: 2.2 },
    { ratio: 2.76, level: 0.3, duration: 1.1 },
    { ratio: 5.4, level: 0.1, duration: 0.5 },
  ]
  for (const { ratio, level, duration } of partials) {
    tone(ac, { frequency: frequency * ratio, delay, duration, gain: gain * level, isWet: true })
  }
}

export const tick = () => {
  const ac = live()
  if (!ac) return
  const frequency = [2600, 3100, 2300][tickCount++ % 3] * vary()
  hiss(ac, { frequency, q: 6, duration: 0.02, gain: 0.05 })
}

export const pop = () => {
  const ac = live()
  if (!ac) return
  tone(ac, { frequency: 480 * vary(), to: 170, duration: 0.07, gain: 0.16 })
  hiss(ac, { frequency: 1800, q: 1.5, duration: 0.02, gain: 0.04 })
}

export const engrave = (duration, density) => {
  const ac = live()
  if (!ac) return () => {}
  // the audio clock can tick during this call, and a curve that starts in the past moves
  // a start a little in the future keeps the curve and its release from overlapping
  const at = ac.currentTime + 0.03
  const amp = ac.createGain()
  amp.gain.setValueCurveAtTime(
    Float32Array.from(density, (value) => 0.012 + value * 0.075),
    at,
    duration
  )
  amp.gain.setTargetAtTime(0, at + duration + 0.01, 0.02)
  // a new event on a gain that still runs its curve throws, so an early stop uses this gate
  const gate = ac.createGain()
  amp.connect(gate).connect(output)

  const buzz = ac.createBiquadFilter()
  buzz.type = 'bandpass'
  buzz.frequency.value = 2400
  buzz.Q.value = 3
  buzz.connect(amp)
  const sources = [118, 236.5].map((frequency, index) => {
    const oscillator = ac.createOscillator()
    oscillator.type = index === 0 ? 'sawtooth' : 'square'
    oscillator.frequency.value = frequency
    oscillator.connect(buzz)
    return oscillator
  })
  const scratch = ac.createBufferSource()
  scratch.buffer = noiseBuffer
  scratch.loop = true
  const highpass = ac.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 4200
  scratch.connect(highpass).connect(amp)
  sources.push(scratch)

  for (const source of sources) {
    source.start(at)
    source.stop(at + duration + 0.2)
  }
  return () => {
    gate.gain.setTargetAtTime(0, ac.currentTime, 0.01)
    for (const source of sources) source.stop(ac.currentTime + 0.1)
  }
}

export const chime = () => {
  const ac = live()
  if (!ac) return
  for (const [index, frequency] of [523.25, 659.25, 783.99, 1174.66].entries()) {
    bell(ac, { frequency, delay: index * 0.07 })
  }
  for (const frequency of [261.63, 392]) {
    tone(ac, { type: 'triangle', frequency, duration: 2.4, gain: 0.035, attack: 0.3, isWet: true })
  }
}

export const tap = (material) => {
  const ac = live()
  if (!ac) return
  if (material !== 'chrome') {
    // a plastic case gives a short dry knock
    tone(ac, { frequency: 620 * vary(), to: 380, duration: 0.06, gain: 0.12 })
    hiss(ac, { frequency: 3400, q: 1.2, duration: 0.02, gain: 0.07 })
    return
  }
  const pitch = 2093 * vary()
  tone(ac, { frequency: pitch, duration: 0.4, gain: 0.07, isWet: true })
  tone(ac, { frequency: pitch * 2.67, duration: 0.14, gain: 0.03 })
  hiss(ac, { frequency: 5200, q: 2, duration: 0.012, gain: 0.05 })
}

export const flip = () => {
  const ac = live()
  if (!ac) return
  hiss(ac, { frequency: 700, to: 2600, q: 1.2, duration: 0.24, gain: 0.05, attack: 0.12 })
}

export const lens = () => {
  const ac = live()
  if (!ac) return
  tone(ac, { frequency: 783.99, duration: 0.6, gain: 0.05, isWet: true })
  tone(ac, { frequency: 1174.66, delay: 0.09, duration: 0.8, gain: 0.05, isWet: true })
}

export const setMuted = (next) => {
  isMuted = next
  if (output) output.gain.value = next ? 0 : VOLUME
}
