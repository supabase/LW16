# LW16 card flow

Open `/lw16-card-flow/`. This study covers the ticket claim flow only: an empty card, a name, the engraving, and your reflection in the metal. The spine of attendee tickets is not part of it.

All data is local. The ticket number is a fixed demo value and no registration happens.

## The flow

1. **Idle.** An empty case: a blank label at the top and a clean pane below.
2. **Name form.** One field. Letters, numbers, dots, dashes and underscores.
3. **Engraving.** A laser line scans the plate only. It writes the handle, the card number, the barcode and the QR code, with a hot trail. The pane stays clean.
4. **Ready.** The card spins once. Drag to tilt, drag far to flip, click to tap it.
5. **Stamping a day.** Each launch day the laser adds one large stamp to the pane. Five stamps fill the card.
6. **Mirror.** Optional. The camera feeds the reflection on the case. No face is drawn on the card. You see yourself faintly, the way you would in a sheet of plastic or polished metal, mixed with the studio light.

The card is built like a graded collectible: a case with a rim, a label at the top, and the pane below it as the art. `?stamps=3` opens a card with three stamps done. The feature named for each day in `stamps.js` is a placeholder.

## Art in the pane

The Art control at the bottom switches what fills the pane over the week, also as `?art=stamps|quadtree`:

- **stamps** is the default: five large round stamps, one for each launch day.
- **quadtree** grows a tree from the handle and number. Each launch day splits some cells into four, each day's icon sits in a cell that stays whole, and on the glass cases every leaf is its own small pane with the lens rim. `quadtree.js` grows the tree and `node quadtree.test.mjs` checks that the leaves of each day cover the pane with no gap and no overlap.

## The code and real size

The QR code on the plate holds a link to this page for that card (`?c=handle.number.stamps`). The link opens the card alone, at its real size of 63 × 94.5 mm.

A browser does not tell the real size of a screen, so `realsize.js` works it out three ways:

- iPhones are known by their screen size in CSS pixels, so they are exact.
- Other phones get the usual 160 pixels per inch, and desktops 96. This can be off by 10% or more.
- "Wrong size?" shows the outline of a bank card. Hold a real one on it, drag until they match, and the page keeps that scale.

The code holds the address the page was opened with. To scan it from a phone, open the page on the computer by its network address, not `localhost`.

## State switcher

The dark list on the left sets `?__state=`, so every state is a link. Arrow keys step through the states. `H` hides the list for screenshots.

A state opened from the list plays once and holds. The flow advances by itself only when you drive it from the page buttons.

`Live reflection` asks for the real camera. If the camera is not available, it shows a drawn stand-in and names the cause. `Asking for camera` and `Camera blocked` hold their screens without a prompt.

## Materials

`?material=smoke|chrome` and `?theme=light|dark`, or the controls at the bottom.

- **Smoke.** The default. A see-through gray case, like a graded-card slab. Its rim shows a thin bright line at the edge. The label is a white insert, and the laser marks are frosted white. The back of the case shows through the front.
- **Chrome.** Mirror metal with a matte label plate.

Drop any image on the page to use it as the surface texture of the chrome card. `Clear texture` removes it.

## Reflection

`mirror.js` opens the front camera at 640 × 480. MediaPipe FaceDetector (loaded from a CDN on first use) finds the face, and the shader keeps it centered in the open field of the ticket. If the detector does not load, the reflection still works without the centering.

The video never leaves the page. Leaving the mirror states stops the camera.

The camera needs a secure origin. `localhost` works over HTTP. Any other host needs HTTPS.

Tuning values are at the top of `ticket.js`: `REFLECTION_STRENGTH`, `FACE_FILL` (zoom) and `TILT_DAMP` (how far a tilt moves the reflection).

## Sound

`sound.js` synthesizes every sound with Web Audio. There are no audio files.

- Hover tick (three variations) and a soft pop on press.
- Engrave: a buzz whose loudness follows how much metal the laser cuts on each row.
- Ready: a bell chord.
- Tap: a dry knock on the smoke case, a metal ring on chrome.
- Flip whoosh and a two-note cue when the mirror turns on.

Sound starts after the first click or key press. Reduced motion skips the engrave animation and its sound.

## Files

- `flow.js` holds the states and transitions. `node flow.test.mjs` checks them.
- `backdrop.js` holds the rim of the glass.
- `ticket.js` draws the card: geometry, the design canvas and the shaders. The QR code comes from `../shared/uqr`, a copy of the `uqr` package this repository already installs.
- `main.js` wires the flow, the switcher and the controls.

## Verification

Checked in headless Chromium: every state from the switcher, the full flow from the buttons, both materials in both themes, phone width, reduced motion, name validation, keyboard stepping and hide, drag to flip, texture drop, the blocked camera path, and the camera path with Chromium's fake camera device (the face detector loaded and ran). No console errors.

The real-size link was opened at an iPhone 15 screen size (393 × 852 at 3x): the page worked out 6.06 pixels per mm and drew the card 63 mm wide.

Not checked: a real face in front of a real camera, a phone camera reading the QR code off a screen, the real size on a real phone, how the sounds feel by ear, Safari and Firefox.
