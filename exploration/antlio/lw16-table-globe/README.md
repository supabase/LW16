# LW16 table globe

Open `/lw16-table-globe/`. This study tries one animation: a globe made of a timetable, which unrolls into the flat table as you scroll. The table follows a supplied screenshot of a timeline with one row for each time zone. It does not copy its details.

All places, times and dates are made up.

## What you see

- **Globe.** The table is a sheet that goes once around a globe. Its ten rows are bands of latitude and its hour columns are meridians, so a session that starts later in the day sits further around the globe. The far side shows through, dimmer. The globe turns slowly. It is big, cut by the screen, and seen from above, so its pole shows.
- **Satellites.** Three satellites go around the globe, each a bright point with a short tail. Each path is a line of very small letters, drawn with the glyph renderer of `../lw16-ticket-globe/`.
- **Unroll.** The scroll makes the globe bigger until its surface is flat. The sheet opens like a label that comes off a bottle, and its middle row does not stretch. The turn slows down and the sheet goes to the nearest whole turn, so the table always opens with its seam at the two ends.
- **Table.** Ten rows on a 24 hour timeline. Each row has the time of its session and a start time in the right column. The text of the table comes from the satellite paths: each text starts as letters on a path, and the letters go to their places in the table as the globe unrolls. The paths and the satellites go away at the same time, so the table has no lines from them.

Reduced motion stops the turn. The scroll still unrolls the globe.

## How it is built

- `unroll.js` holds the math: one function that gives a point of the sheet at any step between globe and table. `node unroll.test.mjs` checks that every point is on the globe at the start, in its table place at the end, and has no jump between.
- `table.js` builds the lines and text of the sheet once, and draws them on a 2D canvas each frame. Lines are cut into short steps so they bend with the globe.

Tuning values are at the top of `table.js`: the rows (`OFFSETS`), the parts of the sheet (`HEADER`, `TIMELINE`, `INFO`), `TURN_SECONDS` and `CAMERA`.

## Verification

Checked in headless Chromium at 1440 x 900 and 390 x 844: the globe, the unroll, the flat table, reduced motion, and the gallery entry. No console errors.

Not checked: Safari and Firefox. On a phone the whole table fits the width, so its text is very small.
