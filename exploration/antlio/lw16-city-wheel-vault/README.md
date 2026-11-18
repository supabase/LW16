# HackDay city wheel, vault

Open `/lw16-city-wheel-vault/`. This is a variant of `../lw16-city-wheel-rings/`. The rings are like the dials of a combination lock. From the outside in: the cities, a dial of ticks, the days (01 to 31), a dial, the months, a dial, and a glass ball at the center.

- **Each ring of words turns on its own.** A drag or the mouse wheel over a ring turns that ring. A click on a word brings it to the middle. The arrow keys turn the cities.
- **The cities ring is the one you read.** The active city is white, the cells of the city are beside it, and the call to action follows it.
- **The dials connect the rings.** When all the rings are at rest, the ticks of the first dial light up from the city to the day, and then the ticks of the second dial light up from the day down to the month. Each dial turns the other way from the ring outside it.
- **The date of the event is the secret combination.** Turn the days to 11 and the months to Dec, and the glass ball fills with a green, iridescent fluid. A screen reader hears "You found the combination". No text on the page gives the combination, but the date is in the call to action.

The page loads the style, the mark, the sound and the tube screen pass of `../lw16-city-wheel/`. The glass ball is the small globe of that screen pass, at a lower opacity. `crt.js` now takes an optional `small.opacity` for this, and other pages leave it at 1. The fluid is drawn under the glass, so it shows through.

Tuning values at the top of `wheel.js`: `SECRET`, `RINGS`, `DIAL`, `PATH`, `GLASS` (the size, the opacity and how high the fluid goes), `FLUID`, `GAP` and `LABEL`.

Checked in headless Chromium at 1440 x 900 and 390 x 844: at rest, the combination 11 Dec (the fluid fills and the status text is set), and a click on a city. No console errors.
