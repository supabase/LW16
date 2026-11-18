# LW16 card globe

Open `/lw16-card-wall/`. This is a separate exploration based on the supplied screenshot of a multi-row mint card wall. The graphic proportions and colors are estimates from that image. Its original source and animation were not supplied.

The page keeps the dense rows, mint paper, geometric drawings, white gutters, and floating ticket button. There are 24 original procedural card designs, including torus meshes, helices, cube lattices, point clouds, stacked planes, orbit lines, columns, and ribbons. The drawings and grain are stable. No external artwork or generated image is used.

## Curvature and motion

The wall curves outward into a convex globe. Its center is closest to the camera. The left, right, top, and bottom edges recede from the viewer. This reverses the earlier concave corridor, with a broad continuous curve across the page.

`layout.js` maps each vertex to a sphere using longitude and latitude. Each card has 48 horizontal and 12 vertical subdivisions, so both its surface and its outline bend. The projected sphere radius scales with the viewport width. This retains the rounded silhouette on a phone.

All rows share the same longitude offset. A card keeps its latitude during horizontal rotation. There is no independent animated vertical offset, bobbing, or per-card floating motion. Perspective compresses the outer cards as they recede. The cards wrap only beyond the offscreen ends.

The default motion advances sideways at 0.095 card widths per second. Dragging or scrolling rotates the entire arrangement, with a short inertial settle. Automatic movement waits briefly after input. The pause button stops automatic travel while retaining manual navigation. Reduced motion starts paused and applies direct input without spring settling. Rendering stops while hidden, outside the viewport, or inspecting a card.

## Interaction

Click a card to inspect its artwork. Escape closes it and returns focus to the globe. Left and right keys move one column. Up and down select a row. Enter opens the selected card. Space toggles motion and Home resets the globe. A focus outline marks the keyboard selection.

The floating ticket button and the inspection button open the ticket claim study in `../lw16-card-flow/`. They do not register a real ticket or contact a service.

## Verification

Run `node lw16-card-wall/layout.test.mjs` from the folder that holds the studies for the convex spherical surface, receding edges, fixed latitude, symmetry, and wrapping checks at 1280 × 720, 1821 × 1344, and 390 × 844.

Browser checks covered desktop and 390 px layouts, horizontal dragging, clicking a card after movement, pause and play, keyboard selection, Escape and focus return, and the ticket destination. The browser reported no page errors during those checks.
