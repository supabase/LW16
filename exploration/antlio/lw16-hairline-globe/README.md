# Abstract globe with glyph orbits

A blend of the Medusa hero's large, cropped planetary framing and Hairline's fine monochrome construction. The sphere is abstract: its surface is a uniform spherical point field with no geography, map mask, or stand.

## Rendering split

- Sphere: a shaded canvas disk, ordinary point marks, and 0.9 px vector meridians and silhouette
- Satellite paths: 2.2 px repeating monospace glyphs, using the brand and KB glyph-line technique
- Satellites: ordinary solid point marks

The page has no text: only the globe, with a status line for screen readers.

## Supabase glyph sources

The standalone renderer in `../lw16-ticket-globe/glyph-path.js` is adapted from `apps/kb/src/lib/ascii/glyph-path.ts` and `packages/ui-patterns/src/GlyphLines/index.tsx`.

It preserves upright characters, direction-dependent spacing, spacing carried across segments, opaque background cells at crossings, and distinct text offsets on neighboring paths. A selected orbit carries a 140 px glyph pulse moving at 380 px per second. The rendering remains monochrome.

## Motion and composition

The [Medusa Search hero](https://medusajs.com/search) informs the framing, depth fade, radius, slow rotation, drag sensitivity, and three orbital paths. [Hairline](https://github.com/lucasmarkes/hairline) informs the subdued stroke hierarchy and pointer response on a spring with stiffness 100, damping 18, and mass 1.

Far orbital paths paint first. The opaque shaded sphere hides their interior segments. Ordinary meridians, surface dots, and the silhouette paint next, then the near glyph paths and satellite markers.

The tour pauses for pointer or keyboard interaction. At rest, offscreen, and in hidden tabs the loop sleeps. Reduced motion stops the tour while keeping pointer and keyboard interaction. Painting runs at 30 fps while springs update at display rate.

## Preview

Serve the parent folder and open `/lw16-hairline-globe/`.
