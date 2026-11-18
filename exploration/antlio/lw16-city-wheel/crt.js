// the two ends of the wheel of names act as the rim of a pane of glass, the way the screen
// edges do in ../lw16-landing/. a name that comes near an end is pulled around the wheel,
// smeared, and split into colors. the angles are from the middle of the wheel, in radians
const EDGE = { from: 0.47, to: 1.25, reach: 0.52, taps: 8 }
// the step between the red and the blue of the picture, in CSS pixels
const FRINGE = 1.2
const GRAIN = 0.045
// the globe is a ball of smooth, soft glass. the three colors of light bend by different
// amounts in it, and split is how far apart. more makes wider color edges at the rim
const GLASS = { split: 0.1 }
// the land of the earth is a smaller ball in the glass, with this radius as a part of the globe
const CORE = 0.86
// the glass shows the start of each name of the wheel at its very rim, as soft light. the
// rest of the name is on the back of the globe. wheel.js draws a small copy of the names
// for this, where the globe hides it. in globe radii: each name of the copy starts `start`
// from the center of the globe, its letters are `size` high, and the glass shows `tip` of
// it, across `depth` radians of the ball from the rim. squeeze makes the names bigger
// around the rim: at 0.5 they are two times as high. wheel.js draws each name of the copy
// two times as soft light: blur is the soft edge of the letters and glow is the wide light
// around them, in globe radii. split is how far apart the three colors are, which gives
// the color edges
export const MIRROR = {
  start: 0.95,
  size: 0.07,
  tip: 0.22,
  depth: 0.68,
  squeeze: 0.5,
  blur: 0.006,
  glow: 0.024,
  split: 0.012,
  strength: 0.5,
}
const PAPER = [12, 13, 13]

const VERTEX = /* glsl */ `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = aPosition * .5 + .5;
    gl_Position = vec4(aPosition, 0., 1.);
  }
`

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uPicture, uLand;
  uniform vec2 uResolution, uHub;
  uniform vec3 uSmall;
  uniform float uRadius, uRatio, uYaw, uGlow, uSmallOpacity;
  uniform vec2 uCity;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  vec4 picture(vec2 px) {
    vec2 uv = px / uResolution;
    return uv == clamp(uv, 0., 1.) ? texture2D(uPicture, uv) : vec4(0.);
  }

  // a tube screen does not put its three colors on the same place
  vec4 fringed(vec2 px) {
    vec2 aside = vec2(${FRINGE.toFixed(1)} * uRatio, 0.);
    vec4 middle = picture(px);
    return vec4(picture(px + aside).r, middle.g, picture(px - aside).b, middle.a);
  }

  vec4 wheel(vec2 px) {
    // the names are on the left of the globe, so the wheel is read as its mirror picture
    vec2 mirror = vec2(-1., 1.);
    vec2 spoke = (px - uHub) * mirror;
    float angle = atan(spoke.y, spoke.x);
    // the globe is inside the names, and it stays as it is
    float strength = pow(smoothstep(${EDGE.from}, ${EDGE.to}, abs(angle)), 2.)
      * smoothstep(1.2, 1.5, length(spoke) / uRadius)
      // past the names is the rest of the page, and it stays as it is too
      * (1. - smoothstep(3.4, 4., length(spoke) / uRadius));
    // behind the globe there are no names to smear
    if (strength <= 0. || abs(angle) > 2.5) return fringed(px);
    vec4 sum = vec4(0.);
    for (int i = 0; i < ${EDGE.taps}; i++) {
      // each sample is from nearer the middle of the wheel, and a little nearer the globe
      float back = strength * ${EDGE.reach} * (.35 + .65 * (float(i) + .5) / ${EDGE.taps}.) * sign(angle);
      vec3 turn = back * vec3(1.14, 1., .86);
      vec3 c = cos(turn), s = sin(turn);
      vec2 inward = spoke * (1. - strength * .1);
      vec4 red = picture(uHub + mirror * vec2(inward.x * c.r + inward.y * s.r, inward.y * c.r - inward.x * s.r));
      vec4 green = picture(uHub + mirror * vec2(inward.x * c.g + inward.y * s.g, inward.y * c.g - inward.x * s.g));
      vec4 blue = picture(uHub + mirror * vec2(inward.x * c.b + inward.y * s.b, inward.y * c.b - inward.x * s.b));
      sum += vec4(red.r, green.g, blue.b, (red.a + green.a + blue.a) / 3.);
    }
    return sum / ${EDGE.taps}.;
  }

  // the light of the room in a direction: one small hard light, one wide soft light on the
  // side of the names, and a little light from above
  float room(vec3 d) {
    float spot = pow(max(dot(d, normalize(vec3(.25, -.55, .8))), 0.), 220.);
    float soft = pow(max(dot(d, normalize(vec3(-.45, .7, .55))), 0.), 14.);
    float fill = pow(max(dot(d, normalize(vec3(-.8, -.2, .55))), 0.), 3.);
    return spot * 8. + soft * 1.1 + fill * .3 + max(d.y, 0.) * .08;
  }

  // the light that one color gets from a point of the glass. index is how much the glass
  // bends this color
  float glassLight(vec3 n, float index) {
    vec3 eye = vec3(0., 0., -1.);
    // clear glass reflects little where it faces the eye, and much at its rim
    float edge = pow(1. - max(n.z, 0.), 4.);
    // light that goes through a ball of glass comes out on the other side, upside down
    vec3 through = -refract(eye, n, 1. / index);
    // the last part is a thin line of light on the rim
    return room(reflect(eye, n)) * (.12 + .88 * edge) + room(through) * .4 * (1. - edge)
      + edge * .3 + pow(1. - max(n.z, 0.), 14.) * .8;
  }

  // how much land is under a direction from the center of the globe, from 0 to 1
  // uYaw turns the globe, so the active city comes to the side of the names
  float land(vec3 d, vec3 axis, vec3 side, vec3 front) {
    float latitude = asin(clamp(dot(d, axis), -1., 1.));
    float longitude = atan(dot(d, side), dot(d, front)) - uYaw;
    return texture2D(uLand, vec2(longitude / 6.2832 + .5, latitude / 3.1416 + .5)).r;
  }

  // a globe with this center and this radius, as premultiplied color. the big globe has
  // the names of the cities in its glass, and the small one does not
  vec4 globe(vec2 px, vec2 center, float radius, bool hasNames) {
    vec2 p = (px - center) / radius;
    float far = length(p);
    if (far >= 1.) return vec4(0.);
    vec3 n = vec3(p, sqrt(1. - far * far));
    // the globe leans a little, north to the reader
    vec3 axis = normalize(vec3(-.22, .92, .32));
    vec3 side = normalize(cross(axis, vec3(0., 0., 1.)));
    vec3 front = cross(side, axis);
    vec3 light = vec3(
      glassLight(n, 1.3 - ${GLASS.split}),
      glassLight(n, 1.3),
      glassLight(n, 1.3 + ${GLASS.split})
    );
    // the glass is clear, with very little green
    vec3 color = light * vec3(.95, 1., .97) + vec3(.012, .018, .016);

    // a thick ball of clear glass has these four marks. the light is up and to the left
    // where p is in the direction of the light, from 0 to 1, and the other way
    vec2 from = normalize(vec2(-.5, .86));
    float lit = dot(p / max(far, .001), from);
    // a long soft line of light that follows the rim on the side of the light
    color += vec3(.92, 1., .97) * exp(-pow((far - .8) / .05, 2.)) * smoothstep(.45, .95, lit) * .5;
    // the light that goes through the ball comes together on the other side
    color += vec3(.8, 1., .9) * exp(-pow((far - .72) / .14, 2.)) * smoothstep(.2, .95, -lit) * .2;
    // a dark ring inside the rim, where the glass shows the dark around it
    color *= 1. - .3 * smoothstep(.76, .9, far) * (1. - smoothstep(.9, .985, far));
    // a soft round light on the front of the glass, on the side of the light
    color += vec3(.95, 1., .98) * pow(max(dot(n, normalize(vec3(-.42, .62, .66))), 0.), 70.) * .45;
    // a soft shade over the low side gives the ball its weight
    color *= .78 + .22 * smoothstep(-1., .4, lit);

    // the land, on the near side and, dimmer, on the far side of the ball in the glass
    // the glass is a lens, so the middle of the ball in it looks bigger than its sides
    vec2 q = p / ${CORE} * mix(.84, 1., far * far);
    float inside = dot(q, q);
    if (inside < 1.) {
      vec3 near = vec3(q, sqrt(1. - inside));
      float lit = .45 + .55 * max(dot(near, normalize(vec3(-.5, .45, .74))), 0.);
      float shown = land(near, axis, side, front) * lit
        + land(vec3(q, -near.z), axis, side, front) * .07;
      // the ball has a soft edge, so it reads as a shape in the glass and not as a disk
      float body = smoothstep(1., .72, inside);
      color += vec3(.62, .95, .78) * shown * .4 * body;

      // the active city is a light on the ball: a small orange center in a wide blue glow
      float turn = uCity.y + uYaw;
      vec3 place = cos(uCity.x) * (sin(turn) * side + cos(turn) * front) + sin(uCity.x) * axis;
      float away = 1. - dot(near, place);
      float center = exp(-away * 200.);
      // the blue stays out of the center, so the center is orange and not white
      color += (vec3(1., .46, .08) * center * 1.25 + vec3(.16, .38, 1.) * exp(-away * 26.) * (1. - center) * .8)
        * uGlow * body;
    }

    // the start of each name shows in the glass at its rim, the wrong way around, as soft
    // light. a name goes around the ball, so it gets thin toward the rim and the rest of it
    // is on the back. lean is the angle on the ball from the rim to this point
    float lean = acos(far);
    if (hasNames && lean < ${(MIRROR.depth + 0.2).toFixed(3)}) {
      // the names are on the left of the globe, so the angle is from there
      float around = atan(p.y, -p.x) * ${MIRROR.squeeze.toFixed(3)};
      vec2 toward = vec2(-cos(around), sin(around)) * uRadius;
      float reach = ${(MIRROR.start - MIRROR.tip).toFixed(4)} + ${(MIRROR.tip / MIRROR.depth).toFixed(4)} * lean;
      vec2 at = uHub + toward * reach;
      vec2 apart = toward * reach * ${MIRROR.split.toFixed(3)};
      vec3 names = vec3(picture(at + apart).r, picture(at).g, picture(at - apart).b);
      color += names * ${MIRROR.strength.toFixed(3)} * smoothstep(1., .985, far);
    }

    float cover = smoothstep(1., 1. - 2. / radius, far);
    return vec4(color * cover, cover);
  }

  void main() {
    vec2 px = vUv * uResolution;
    vec4 ink = wheel(px);
    vec3 color = vec3(${PAPER.map((part) => (part / 255).toFixed(3)).join(', ')}) * (1. - ink.a) + ink.rgb;
    vec4 glass = globe(px, uHub, uRadius, true);
    color = color * (1. - glass.a) + glass.rgb;
    // the call to action has a small copy of the globe
    vec4 small = globe(px, uSmall.xy, uSmall.z, false) * uSmallOpacity;
    color = color * (1. - small.a) + small.rgb;
    // grain in cells of 1.5 CSS pixels. it does not move: grain that moves reads as snow
    // the two globes have no grain, so the glass stays clean
    color += (hash(floor(px / (uRatio * 1.5))) - .5) * ${GRAIN} * (1. - glass.a) * (1. - small.a);
    // the corners of the screen are darker
    color *= 1. - .45 * pow(length(vUv - .5) * 1.25, 3.);
    gl_FragColor = vec4(color, 1.);
  }
`

// shows a 2D picture on the canvas as a tube screen, with the glass globe on it. returns null where WebGL is not available
// the lines of the screen are not here: style.css draws them over the canvas and the page text
export const createCrt = (canvas) => {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
  if (!gl) return null

  const program = gl.createProgram()
  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
    gl.attachShader(program, shader)
  }
  gl.bindAttribLocation(program, 0, 'aPosition')
  gl.linkProgram(program)
  gl.useProgram(program)

  // one triangle that is bigger than the screen covers it with no seam
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  // a 2D canvas has its first row at the top and its colors multiplied by their alpha
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)

  const at = (name) => gl.getUniformLocation(program, name)
  const uniforms = {
    resolution: at('uResolution'),
    hub: at('uHub'),
    small: at('uSmall'),
    smallOpacity: at('uSmallOpacity'),
    radius: at('uRadius'),
    ratio: at('uRatio'),
    yaw: at('uYaw'),
    city: at('uCity'),
    glow: at('uGlow'),
  }

  // the map of the land is the second texture. it is black, for no land, until setLand
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  // the map goes around the globe, so its two sides join
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
  gl.activeTexture(gl.TEXTURE0)
  gl.uniform1i(at('uLand'), 1)

  // hub is the center of the wheel and radius the radius of its globe, in pixels of the picture
  // small is the center and the radius of the small globe, and its opacity, 1 if not given
  // city is the latitude and the longitude of the active city in radians, and glow is how
  // strong its light is, from 0 to 1
  const draw = ({ picture, hub, radius, small, ratio, yaw, city, glow }) => {
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, picture)
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
    gl.uniform2f(uniforms.hub, hub.x, canvas.height - hub.y)
    gl.uniform1f(uniforms.radius, radius)
    gl.uniform3f(uniforms.small, small.x, canvas.height - small.y, small.radius)
    gl.uniform1f(uniforms.smallOpacity, small.opacity ?? 1)
    gl.uniform1f(uniforms.ratio, ratio)
    gl.uniform1f(uniforms.yaw, yaw)
    gl.uniform2f(uniforms.city, ...city)
    gl.uniform1f(uniforms.glow, glow)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  // the map has longitude across and latitude down, white for land. its width and its
  // height must be powers of two, or its two sides can not join
  const setLand = (map) => {
    gl.activeTexture(gl.TEXTURE1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map)
    gl.activeTexture(gl.TEXTURE0)
  }

  return { draw, setLand }
}
