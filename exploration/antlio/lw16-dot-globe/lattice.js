// dots on a globe of radius 1, in rows of equal latitude. spacing is the angle in radians
// between two rows, and the dots of a row are that far apart too, so the dots are even
// over the whole globe. returns x, y, z for each dot, one after the other
export const dotLattice = (spacing) => {
  const points = []
  const rows = Math.round(Math.PI / spacing)
  for (let row = 0; row < rows; row++) {
    const latitude = ((row + 0.5) / rows - 0.5) * Math.PI
    const count = Math.max(Math.round((Math.cos(latitude) * Math.PI * 2) / spacing), 1)
    for (let dot = 0; dot < count; dot++) {
      // each row starts a little after the one below it, so the dots do not line up in columns
      const longitude = ((dot + row * 0.37) / count) * Math.PI * 2
      points.push(
        Math.cos(latitude) * Math.sin(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.cos(longitude)
      )
    }
  }
  return new Float32Array(points)
}
