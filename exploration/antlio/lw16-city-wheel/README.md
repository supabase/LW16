# HackDay city wheel

Open `/lw16-city-wheel/`. This study puts three things together: the city names of the HackDay hero, a globe, and the wheel of text from a supplied video (a discarded brand study, where a list of names turns around a picture like the spokes of a wheel). It shows on a tube screen.

The ten cities come from the HackDay mockup. The times, the people counts and the states are made up.

## What you see

- **The globe is the hub, on the right.** Its center is on the right edge of the screen, so one half of it shows, and it is big. It is a thick ball of clear glass, with very little green. It has the marks of real glass: a thin line of light on its rim, a dark ring inside the rim, a long soft line of light and a soft round light on the side of the light, and a pale glow on the other side where the light comes together. In the glass is a smaller ball with the land of the earth on it, as soft pale shapes. The glass is a lens, so the middle of that ball looks bigger. The land of the far side shows through, much dimmer.
- **The land follows the city.** The globe turns until the longitude of the active city is on the side of the names, so Berlin shows Europe and Africa, and Sydney shows Australia and Asia. The globe leans a little, north to the reader, so cities in the south sit low on it.
- **The names in the glass.** The glass shows the names of the cities at its very rim, the wrong way around, as faint, soft, spread light with slight color edges. Each name goes around the ball: only its first letters show, thin and bent at the rim, and the rest is on the back of the globe. They move in the glass as the wheel turns. `wheel.js` draws a small, soft copy of the names for this, where the globe hides it.
- **The click.** The wheel clicks each time a name passes the middle, like a small metal switch: a very short snap and the short ring of its spring, made with Web Audio in `click.js`. Fast clicks are a run, and each click of a run is a little higher, up to one octave. A pause brings the pitch back. A browser starts sound only after a press or a key, so a turn with the mouse wheel is silent until the first click, tap or key.
- **The sound of the status.** When the wheel stops on a city, a short note gives its status: two notes up for open, one note for nearing capacity, and two low, dull notes down for the waiting list.
- **The light of the city.** The active city is a light on the ball in the glass: a small orange center in a wide blue glow. It gets slowly stronger and weaker, about once in 5 seconds. It goes out while the wheel turns, and comes back at the new city.
- **The names are the spokes, on the left.** The ten city names go out from the globe, 10 degrees apart, and the list goes around again after the last one. The name that points to the left is the active one. It is white and moves out a little.
- **The wheel turns without end.** The mouse wheel or the trackpad, a drag up or down, and the arrow keys turn it one name at a time, with a short ease. After the last city comes the first one, in the two directions. A click on a name brings that city to the middle. A fast turn leaves a smear behind the names. The globe turns with the wheel. The page is one screen and does not scroll, so it has no scrollbar.
- **The cells of the city.** Before the active name comes a row of three table cells: the session in local time, the people count, and the state. A long name leaves room for one column of cells. On a narrow screen the cells go under the wordmark.
- **The two ends of the wheel.** They do what the screen edges do in `../lw16-landing/`: a name that comes near an end is pulled around the wheel, smeared, and split into colors. On a wide screen the wheel is bigger than the screen, so the start of this shows and the rest goes off the top and the bottom.

## The mark

The top left has a small HackDay mark in the manner of a micrographic: a globe of lines of light, on a grid of pixels, with the word HACK over it in small, heavy pixel letters that lean. The lines of the globe are smooth: three ovals, one upright line and three lines across. They stop one cell from the letters, so the word reads. It is white with a blue glow. `mark.js` builds it as one SVG, 45 by 21 cells, at two pixels for each cell of the letters. It is the heading of the page, and its name for a screen reader is "HackDay".

## The call to action

The bottom left has the one link of the page. It is a small glass globe with words, not a button.

- **Its words follow the city.** "Join in Berlin" for a city that is open or near capacity, and "Join the waiting list in Singapore" for a city that is full. The date is under it. The link goes to `#berlin`: this study has no city pages.
- **The small globe.** A small copy of the glass globe, from the same drawing, with the same land and the same light of the city. It turns with the big globe as the wheel turns, and it gets a little bigger when the pointer or the keyboard focus is on the link.
- It is a plain link in the page, with underlined words, so the keyboard and a screen reader get it as any other link. The tube screen pass draws the small globe at its place.

## The cells and accessibility

- The cells are a description list in the page, not canvas text. Each cell has a label for screen readers: city, session, people, status.
- A state never reads by color only. It has its words and its own shape, a ring that fills up: empty for open, half for nearing capacity, full for the waiting list.
- Open is a light green cell and nearing capacity a light orange cell, with dark text at a contrast of 7 to 1 or more. The waiting list is a plain cell with a border, and a colored cell has no border.
- The cells sit over the lines of the tube screen and have no color step, so the small text stays sharp.
- The arrow keys turn the wheel. A screen reader hears the new city after the wheel comes to rest, and gets all ten cities from the table.
- A name on the wheel is a part of the picture, not a button, so the keyboard can not go to one name. It goes through the cities with the arrow keys.

## The tube screen

- Lines across the screen, one dark line in each 3 pixels. The two globes have no lines, so the glass stays clean.
- A small step between the red and the blue of the picture and of the page text.
- Grain that does not move, and darker corners. The two globes have no grain.

Nothing in the background moves. The light of the city is the only thing that moves when the page is at rest.

Reduced motion takes the ease, the smear of a fast turn and the slow change of the light of the city away. The wheel still turns.

## How it is built

- `wheel.js` draws the names on a 2D canvas that is not on the page. The cities are a list at the top of the file.
- `crt.js` shows that picture on the page through one WebGL pass: the bend at the two ends of the wheel, the color step, the grain and the dark corners. The same pass draws the two glass globes, for each pixel, from the shape of the ball, a made-up room of lights and a map of the land. `wheel.js` makes that map from the points of land of `../lw16-ticket-globe/` (Natural Earth, public domain). If the points do not load, the globe is glass only. Without WebGL the 2D picture goes on the page as it is, with no globe.
- `style.css` draws the lines of the screen over the canvas and the page text, and gives the page text its color step.
- The mark, the call to action and the cells are page content. A table of all ten cities is in the page for screen readers.

Tuning values: `HUB` (size and place of the globe), `STEP`, `LABEL` and `NAME_FADE` at the top of `wheel.js`, and `EDGE`, `FRINGE`, `GRAIN` and `GLASS` (the color edges of the globe), `CORE` (the ball of land) and `MIRROR` (the names in the glass) at the top of `crt.js`.

## Verification

Checked in headless Chromium at 1440 x 900 and 390 x 844: the mouse wheel, the arrow keys, a drag, a click on a name, the turn from the first city back to the last, and reduced motion. No console errors.

Not checked: Safari and Firefox, a real trackpad and a real touch screen, a real screen reader, and the page without WebGL.
