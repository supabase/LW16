# LW16 poster gallery

A local poster exhibition at `/lw16-hairline-gallery/`. The gallery contains eight printed sheets with large editorial titles, small edition labels, neutral paper texture, and abstract hairline compositions. No pendant or keychain models are loaded by this page.

## Poster series

The layout draws on the earlier collectible-card format: large serif feature titles, restrained technical graphics, and release information at the foot of each sheet. The posters are new procedural compositions rather than imported images from the earlier study.

- LW16: a large typographic invitation and a field growing from one record into many.
- Issues Inbox: incoming sheets and an organized issue field.
- Request Timeline: a glyph-drawn route, event markers, and small branching records.
- Storage Versioning: successive offset planes with a visible version history.
- Warehouse: an isometric modular field expanding from a single dark cell.
- Scoped OAuth apps: open access contours, nested scopes, and glyph paths.
- Sign in with Claude: a dense radial composition of hairlines and microtype.
- Admission: a typographic closing poster with a printed ticket and sample barcode.

`posters.js` draws each edition onto its own high-resolution canvas. The paper grain and print irregularities use fixed seeds. The artwork stays still on the page as the sheet moves through the gallery. The grayscale palette uses paper and ink tones throughout.

Each texture is mounted on a subdivided sheet with a plain paper back. Poster aspect ratios vary. The sheets travel along a continuous U-shaped route with a flat center, rounded corners, and parallel side walls. Each sheet bends across that route vertex by vertex. A centered sheet stays completely flat, while a sheet crossing a corner curves through it. The sheets remain in the scene while navigating, with no selection fade. Only geometry beyond the offscreen ends of the route is clipped.


## Spatial reference

The [reference gallery](https://joshpuckett.me/nyc-moma) was inspected in the browser and through its public scene module. Its paintings and labels bend along a continuous U-shaped route, with momentum on drag release. This interpretation uses its continuous spatial progression, with original poster art and gentle spring centering. `room-path.js` defines the straight sections and quarter-circle corners. `corridor.js` deforms each poster across that path with 96 horizontal subdivisions. No whole-panel rotation approximates the corners. The flat section accommodates the full width of the centered poster, including its inspection enlargement.

The reference artwork, branding, font files, and source implementation are not included. The route and deformation are implemented locally. All runtime imports are existing local dependencies.

Captions below the sheets have been removed. Native, visually hidden exhibit buttons remain for keyboard and screen-reader access. Focusing one centers its poster. The printed titles and release information stay inside each poster.

## Interactions

Drag, swipe, scroll, or focus the canvas and use arrow keys to browse. Touch gestures choose the dominant axis. Click a neighboring poster to center it. Click the centered poster or press Enter to open the announcement preview. The direction controls turn the selected sheet. Escape closes the preview and returns focus.

Home returns to the opening poster. End centers the admission poster. Clicking either centered ticket poster opens that same flow. No live registration is implemented.

Direct poster links use `?exhibit=lw16`, `inbox`, `timeline`, `storage`, `warehouse`, `oauth`, `claude`, or `ticket`.

Reduced motion disables settling and lift animation. The renderer sleeps after input settles and when the page is hidden or outside the viewport.

## Verification

The room path has a focused geometry check for flatness at the center, changing tangents through corners, mirror symmetry, and continuous positions and tangents at every join. Run `node lw16-hairline-gallery/room-path.test.mjs` from the folder that holds the studies.

Browser checks cover desktop and 390 px layouts, dragging, keyboard centering, poster inspection, focus return, and the handoff to the ticket claim study. JavaScript syntax and local assets were checked. Browser error logs were empty.

The posters are launch announcement previews. Release dates and a production reveal schedule are not configured.
