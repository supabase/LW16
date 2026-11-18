// width of the bent rim of the glass, in card units
const LENS_BAND = 0.085

// the rim of a rounded pane of glass, as premultiplied color. the page behind a card is plain,
// so the rim shows a band of the page color and a thin bright line at the edge
export const LENS_GLSL = /* glsl */ `
  uniform vec3 uPaper;

  // p is the offset from the center of the pane, in card units
  vec4 bend(vec2 p, vec2 half_size, float radius, float band) {
    vec2 q = abs(p) - (half_size - radius);
    vec2 corner = max(q, 0.);
    // rounded rect signed distance, positive inside the pane
    float depth = radius - length(corner) - min(max(q.x, q.y), 0.);
    float strength = depth < band ? pow(1. - max(depth, 0.) / band, 2.) : 0.;
    // a thin bright line where the edge of the pane turns to the eye
    vec3 color = uPaper + smoothstep(band * .14, 0., depth) * .25;
    float cover = smoothstep(0., .12, strength);
    return vec4(color * cover, cover);
  }

  // the whole card as one pane
  vec4 lens(vec2 p) {
    return bend(p, vec2(.5, .75), .055, ${LENS_BAND});
  }
`

// a quad that covers the screen, whatever the camera
export const SCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0., 1.);
  }
`
