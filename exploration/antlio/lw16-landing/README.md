# LW16 landing

Open `/lw16-landing/`. This study shows how the launch week page can look when every attendee ticket is on it. The structure follows [inkwell.tech](https://inkwell.tech/): a scroll-led 3D journey. The page is that journey from top to bottom: it ends on the launch cards and the claim button.

All 280 tickets are fictional. The handles, the ticket numbers and the feature named for each day are placeholders.

## The journey

The page is 800vh and pins one screen: 500vh of scroll for the tickets, then 200vh for the launch cards and the closing line. Scroll position drives everything, so the page never moves without you, and the pointer does not move the scene.

The tickets are smoke glass, the default case of the claim flow.

1. **Spine.** A long row of tickets that fans open and shut and drifts sideways. On load each ticket drops into its slot, in a wave from left to right.
2. **Ring.** The tickets shrink and the row splits into three rows. The rows bend down into rings that are much bigger than the screen, so the two ends of each row meet far below it and no gap shows. Then the closed rings get small and come into view.
3. **Arc.** The camera moves into the top of the rings. Large tickets pass in three lanes as you scroll.
4. **One ticket.** A blank `@your_name` ticket slides out of its lane and comes forward with the claim button. The others frame the corners.
5. **Five tickets.** The far tickets leave into the fog. Four of them come back along one line, in order, behind the blank ticket, which turns to the front: five tickets with room between them. The other tickets stay in the fog.
6. **Roll.** The five tickets roll twice on their upright axis and open into a prism with five faces, one ticket on each. The prism opens from the first step of the roll, so the tickets never close up into one block. In the second half of the roll each of the five tickets changes into a day card while it is edge-on to the eye, so the change is never seen. The prism of tickets is the carousel.

## The screen edges

The top and bottom of the screen act as the rim of one big pane of glass. Tickets that come near them are pulled to the edge, smeared, and split into colors. It is the same lens idea as the ticket rim, applied to the finished picture: the scene draws into a buffer, and one more pass bends that buffer within 20% of each edge. `EDGE` in `crowd.js` holds the band, the reach and the number of samples.

The captions are page content, so the edge does not bend them.

## The launch cards

After the roll, the pinned screen holds the prism of five day cards, one for each launch day. Each card is a ticket: `DAY 1` to `DAY 5` on the plate, and in its window the stamps of the days up to its own. The scroll rolls the prism from day 1 to day 5, with a rest on each card. One line under the prism says the launch and the status of the card at the front. There are no buttons.

A day is locked until its date: a locked card has no stamps, and its line says the date, not the launch. `?today=2026-12-08` shows the week as it is on that day.

At the end of the scroll the closing line and the claim button take the place of the heading above the prism. Every claim button opens `../lw16-card-flow/` on the name form.

## How it is built

- `crowd.js` draws all tickets as one instanced mesh. 48 designs are drawn once into a texture atlas with the same drawing code as the card flow, so a change to the ticket shows up here too: 43 tickets of people and the 5 day cards. Every ticket is smoke glass with the rim from the card flow. The tickets draw from far to near each frame so they blend right, and the depth buffer keeps the nearer of two crossing tickets on top.
- `layouts.js` holds the choreography. Each stage is a function that gives one ticket its position, rotation and scale at a point of the scroll. The moves between stages are ordered, not random, so no ticket passes through another: tickets stay parallel to their neighbors, slide in their own plane, or hand over inside the fog.
- `node layouts.test.mjs` checks that. It boxes every ticket at 1,100 points of the journey and fails if two boxes overlap. The check stops where the roll starts, because the roll puts every ticket on five faces on purpose.
- `landing.js` reads the scroll, fades the captions (`data-range` on each caption is its scroll window), gives the day cards to `crowd.js`, and turns the prism in the tail. The days are also a list in the page for a screen reader, and the visible list without WebGL.
- The scroll after the roll is the tail. `TAIL` in `landing.js` says where each part of it starts and ends.
- `week.js` holds the lock rule, and `node week.test.mjs` checks it.

Without WebGL the journey becomes a plain stack of its captions.

## Verification

Checked in headless Chromium at 1440 x 900 and 390 x 844: the ring as it closes, the pile, the roll into the day cards, the carousel, the closing line, reduced motion, and the claim link. No console errors.

Not checked: frame rate on a real phone, Safari and Firefox, and the page without WebGL.
