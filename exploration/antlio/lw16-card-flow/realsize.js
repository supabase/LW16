export const CARD_MM = { width: 63, height: 94.5 }
export const BANK_CARD_MM = { width: 85.6, height: 53.98 }

const STORAGE_KEY = 'lw16-px-per-mm'
// screen diagonal in inches of each iPhone, by its size in CSS pixels and its pixel ratio
const IPHONE_INCHES = {
  '320x568@2': 4,
  '375x667@2': 4.7,
  '414x736@3': 5.5,
  '375x812@3': 5.8,
  '414x896@2': 6.1,
  '414x896@3': 6.5,
  '390x844@3': 6.1,
  '428x926@3': 6.7,
  '393x852@3': 6.1,
  '430x932@3': 6.7,
  '402x874@3': 6.3,
  '440x956@3': 6.9,
}

// a browser can block site storage, and then the page uses its own guess
const readSaved = () => {
  try {
    return Number(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 0
  }
}

export const readPxPerMm = () => {
  const saved = readSaved()
  if (saved > 0) return saved
  const short = Math.min(screen.width, screen.height)
  const long = Math.max(screen.width, screen.height)
  const inches = IPHONE_INCHES[`${short}x${long}@${devicePixelRatio}`]
  // a browser does not tell the real size of a screen, so other devices get the usual density
  if (!inches) return (matchMedia('(pointer: coarse)').matches ? 160 : 96) / 25.4
  return Math.hypot(short, long) / (inches * 25.4)
}

export const savePxPerMm = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch (error) {
    console.warn('The screen size could not be saved', error)
  }
}
