# LW16 crescent

Open `/lw16-dot-globe/`. This study shows a part of a large globe made of small squares, one at each point of an even field of dots. Light comes over its edge from behind, so only a crescent of squares is lit: pale green next to the edge, then Supabase green, then dark. It follows a supplied picture, which is orange and has a glow around the globe. This study is green and has no glow. The page is black except for the squares and one thin line of light on the edge.

## What you see

- The globe is bigger than the screen. Its top is near the top left, and its edge crosses the screen as one long arc.
- The squares are even over the globe, in rows that lean, so they cross the screen at an angle and get close together near the edge. A square in more light is bigger. The squares stay upright and do not turn with the globe.
- The globe turns very slowly, so the squares move through the light.
- The pointer moves the light. Across the screen makes the crescent thin or wide, and up and down moves it along the edge.

Reduced motion stops the turn. The pointer still moves the light.

## How it is built

- `lattice.js` places the dots. `node lattice.test.mjs` checks that every dot is on the globe and that the dots are even.
- `globe.js` turns and lights the dots and draws each as a square on a 2D canvas. The number of dots follows the screen size, about 12 pixels from one dot to the next.

Tuning values are at the top of `globe.js`: `GLOBE` (size and place), `DOT_GAP`, `LEAN`, `LIGHT` and the three colors.

## Verification

Checked in headless Chromium at 1440 x 900 and 390 x 844, with the light in three places, and with reduced motion. It drew 120 frames in one second there. No console errors.

Not checked: Safari and Firefox, and frame rate on a real phone.
