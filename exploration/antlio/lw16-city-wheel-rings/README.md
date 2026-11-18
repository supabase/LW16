# HackDay city wheel, rings

Open `/lw16-city-wheel-rings/`. This is a variant of `../lw16-city-wheel-line/`. The line of city names is copied into four rings, one inside the other, with wide gaps between them, and the rings make the globe.

- **The rings are a ball seen from a pole.** Near the rim the rings are close together and their letters are less high, the way the lines of latitude of a globe look from above a pole. Toward the center they are full height. The light comes from the top left, so the bottom right of the ball is dark.
- **Every next ring turns the other way.** A turn of the wheel moves the outer ring by one name, the next ring by one name the other way, and so on to the center. Each ring starts a few names after the one outside it, so the names do not line up.
- **The outer ring is the one you read.** It is full height, the active city on it is white, and the cells of the city are beside it. A click on a name of the outer ring brings that city to the middle.
- **The icon of the call to action** is a small copy of the rings: four rings of dashes that turn the two ways.

Only `wheel.js` is new. The page loads the style, the mark, the sound and the tube screen pass of `../lw16-city-wheel/`. That screen pass draws two glass globes and bends the two ends of the wheel; this page gives them no size, so none of them shows.

Tuning values at the top of `wheel.js`: `RINGS` (the space between rings, the hole at the center, and how flat the rim is), `STAGGER`, `LIGHT`, `GAP` and `LABEL`.

Checked in headless Chromium at 1440 x 900 and 390 x 844: at rest, a fast turn with the arrow keys, a turn past the last city, and a click on a name. No console errors.
