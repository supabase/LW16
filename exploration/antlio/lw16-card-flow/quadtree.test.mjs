import assert from 'node:assert/strict'
import { growQuadtree, leavesAt } from './quadtree.js'

const DAYS = 5

for (const seed of ['antlio.481', 'your_name.1', 'a.9999', 'kiwi_dev.20', 'x']) {
  const cells = growQuadtree(seed, DAYS)
  assert.deepEqual(cells, growQuadtree(seed, DAYS), 'a seed must always grow the same tree')

  let before = 0
  for (let day = 0; day <= DAYS; day++) {
    const leaves = leavesAt(cells, day)
    // the leaves of a day must tile the square: no gap and no overlap
    const area = leaves.reduce((sum, leaf) => sum + leaf.size ** 2, 0)
    assert.ok(Math.abs(area - 1) < 1e-9, `${seed} day ${day}: leaves cover ${area}`)
    for (const [index, a] of leaves.entries()) {
      for (const b of leaves.slice(index + 1)) {
        const apart = a.x + a.size <= b.x || b.x + b.size <= a.x || a.y + a.size <= b.y || b.y + b.size <= a.y
        assert.ok(apart, `${seed} day ${day}: two leaves overlap`)
      }
    }
    // each day must add cells
    assert.ok(leaves.length > before, `${seed} day ${day} added nothing`)
    before = leaves.length
  }

  // each day has one stamp, in a cell that is whole on that day and stays whole
  for (let day = 1; day <= DAYS; day++) {
    const homes = cells.filter((cell) => cell.iconDay === day)
    assert.equal(homes.length, 1, `${seed}: day ${day} has ${homes.length} stamp cells`)
    assert.ok(homes[0].day <= day && homes[0].splitDay === undefined)
  }
}

console.log('quadtree ok')
