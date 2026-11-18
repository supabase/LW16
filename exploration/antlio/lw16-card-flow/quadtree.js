// a quadtree that grows one level on each launch day. the same seed always grows the same tree
const SPLIT_CHANCE = [1, 0.75, 0.6, 0.5, 0.45]

const hashOf = (text) => {
  let hash = 2166136261
  for (const letter of text) hash = Math.imul(hash ^ letter.codePointAt(0), 16777619)
  return hash >>> 0
}

// mulberry32
const randomFrom = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

// every cell the tree ever has, as { x, y, size, day, splitDay, iconDay } in a unit square
// day is when the cell appears, splitDay is when it turns into four, iconDay is the day stamp it holds
export const growQuadtree = (seed, days) => {
  const random = randomFrom(hashOf(seed))
  const root = { x: 0, y: 0, size: 1, day: 0 }
  const cells = [root]
  let newest = [root]
  for (let day = 1; day <= days; day++) {
    const chance = SPLIT_CHANCE[Math.min(day - 1, SPLIT_CHANCE.length - 1)]
    const picks = newest.map(() => random() < chance)
    // each day must split one cell, and keep one whole for the stamp of the day before
    if (!picks.includes(true)) picks[Math.floor(random() * picks.length)] = true
    if (newest.length > 1 && !picks.includes(false)) picks[Math.floor(random() * picks.length)] = false
    const made = []
    for (const [index, cell] of newest.entries()) {
      if (!picks[index]) continue
      cell.splitDay = day
      const size = cell.size / 2
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        made.push({ x: cell.x + dx * size, y: cell.y + dy * size, size, day })
      }
    }
    const kept = newest.find((cell) => cell.splitDay === undefined)
    if (kept) kept.iconDay = day - 1
    cells.push(...made)
    newest = made
  }
  newest[0].iconDay = days
  return cells
}

export const leavesAt = (cells, day) =>
  cells.filter((cell) => cell.day <= day && !(cell.splitDay <= day))
