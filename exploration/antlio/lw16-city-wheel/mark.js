// the hackday mark: a globe of thin smooth lines, with the word HACK over it in pixel
// letters. the numbers are in cells of the letters, and the mark is 45 by 21 cells
const SIZE = { w: 45, h: 21 }
const CENTER = { x: 22.5, y: 10.5 }
// the half widths of the three ovals of the globe, and its half height
const OVALS = [22, 14.5, 7]
const HALF_HEIGHT = 10
// the lines across the globe, above and below its middle line
const PARALLELS = [5, 16]
const LINE_WIDTH = 0.5
// each letter is 7 by 7 cells, with upright strokes of double width
const LETTERS = [
  '1100011 1100011 1100011 1111111 1100011 1100011 1100011',
  '0111110 1100011 1100011 1111111 1100011 1100011 1100011',
  '0111111 1100000 1100000 1100000 1100000 1100000 0111111',
  '1100011 1100110 1101100 1111000 1101100 1100110 1100011',
].map((letter) => letter.split(' '))
const WORD = { x: 6, y: 7, gap: 1 }
// the C is open to the right, so a line of the globe in it would make it read as an E
const OPEN_LETTER = 2

// each run of cells in a row of a letter is one rectangle of the path
const word = []
for (const [index, letter] of LETTERS.entries()) {
  for (const [row, bits] of letter.entries()) {
    // the top rows sit one cell to the right, so the word leans
    const left = WORD.x + index * (bits.length + WORD.gap) + (row < 3 ? 1 : 0)
    for (let column = 0; column < bits.length; column++) {
      if (bits[column] !== '1') continue
      const from = column
      while (bits[column + 1] === '1') column++
      word.push(`M${left + from} ${WORD.y + row}h${column - from + 1}v1h${from - column - 1}z`)
    }
  }
}

// the width of the globe at a height, for the ends of a line across it
const reachAt = (y) => OVALS[0] * Math.sqrt(1 - ((y - CENTER.y) / HALF_HEIGHT) ** 2)
const across = [CENTER.y, ...PARALLELS].map((y) => {
  const reach = reachAt(y)
  return `<line x1="${CENTER.x - reach}" y1="${y}" x2="${CENTER.x + reach}" y2="${y}" />`
})
const ovals = OVALS.map(
  (halfWidth) => `<ellipse cx="${CENTER.x}" cy="${CENTER.y}" rx="${halfWidth}" ry="${HALF_HEIGHT}" />`
)
const letterWidth = LETTERS[0][0].length
const openBox = `<rect x="${WORD.x + OPEN_LETTER * (letterWidth + WORD.gap)}" y="${WORD.y}" width="${letterWidth + 1}" height="${LETTERS[0].length}" />`

const mark = document.querySelector('#mark')
mark.setAttribute('viewBox', `0 0 ${SIZE.w} ${SIZE.h}`)
// the lines of the globe stop one cell from the letters, so the word reads
mark.innerHTML = `
  <mask id="mark-gap">
    <rect width="${SIZE.w}" height="${SIZE.h}" fill="#fff" />
    <g fill="#000" stroke="#000" stroke-width="2">
      <path d="${word.join('')}" />
      ${openBox}
    </g>
  </mask>
  <g class="mark-lines" mask="url(#mark-gap)" stroke-width="${LINE_WIDTH}">
    ${ovals.join('')}
    <line x1="${CENTER.x}" y1="${CENTER.y - HALF_HEIGHT}" x2="${CENTER.x}" y2="${CENTER.y + HALF_HEIGHT}" />
    ${across.join('')}
  </g>
  <path class="mark-word" d="${word.join('')}" />
`
