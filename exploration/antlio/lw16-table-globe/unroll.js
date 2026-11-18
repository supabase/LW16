// the table as a sheet around a globe of this radius. the sheet goes once around it
export const RADIUS = 1
export const SHEET = { width: 2 * Math.PI * RADIUS, height: 2.6 * RADIUS }

// a point of the sheet, given from its center, as the sheet goes from the globe (flat 0)
// to a flat table (flat 1). the globe gets bigger until its surface is flat, so the sheet
// unrolls and does not stretch along its middle row
export const unroll = (x, y, flat) => {
  const bend = (1 - flat) / RADIUS
  // a globe this big is flat to the eye, and the division below is not safe
  if (bend < 1e-6) return [x, y, 0]
  return [
    (Math.cos(y * bend) * Math.sin(x * bend)) / bend,
    Math.sin(y * bend) / bend,
    (Math.cos(y * bend) * Math.cos(x * bend) - 1) / bend + RADIUS * (1 - flat),
  ]
}

// the direction that points away from the sheet at a point. its last part says how much the
// sheet faces the reader there, from -1 for the far side of the globe to 1
export const normal = (x, y, flat) => {
  const bend = (1 - flat) / RADIUS
  return [
    Math.cos(y * bend) * Math.sin(x * bend),
    Math.sin(y * bend),
    Math.cos(y * bend) * Math.cos(x * bend),
  ]
}
