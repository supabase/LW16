# LW16 exploration gallery

Open `/lw16-explorations/` to browse the eleven selected studies. The folder root sends you to this gallery.

Each card has a captured image, a short name, a native preview button, and an icon link to the full page. Category pills cover spatial studies, globes, and posters. The visible interface contains only the page heading, filter labels, and eleven study names. Selecting a preview opens the actual study in a native dialog. Only one iframe is mounted at a time, and closing the dialog removes it. Previous and next controls follow the current category. Escape closes the dialog and returns focus to its originating card.

The category and selected preview are reflected in `?group=` and `?study=`.

`studies.js` is the catalog. Preview images live in `previews/`. The gallery itself uses no graphics runtime. The images load lazily, and a live study starts only when its preview opens.

Verified the eleven selected page and image paths, distinct thumbnails, category counts, interactive preview controls, switching between studies, iframe removal, Escape focus return, and desktop and mobile layouts. JavaScript syntax and browser errors were checked.

The dark surfaces, rounded cards, compact labels, and pill filters follow the supplied [library reference](https://transitions.dev/library.html). The preview dialog uses the Transitions.dev modal transition with a reduced-motion fallback.

The Card globe study uses the supplied multi-row card reference with convex curvature. Its center projects toward the viewer and its outer cards recede around a spherical surface. Posters now has no captions beneath its sheets.

S helix compares a circular opening with a Supabase-shaped opening inside a helical fin arrangement. Its outer geometry is identical in both states.

Table globe wraps a launch week timetable around a globe, one row for each time zone. Scrolling unrolls it into the flat table.

Crescent shows a part of a large globe of small squares, lit from behind in Supabase green, with no glow around it.

City wheel turns a wheel of the ten HackDay cities around a glass globe on a tube screen. Its own README is in `../lw16-city-wheel/`.

City rings copies the line of city names into four rings that make a ball seen from a pole. Its own README is in `../lw16-city-wheel-rings/`.

City vault turns the rings like the dials of a combination lock, and the date of the event opens it. Its own README is in `../lw16-city-wheel-vault/`.

Ticket scroll is the landing journey: everyone's tickets as a spine, rings and a prism of the five launch days. It loads the ticket of `../lw16-card-flow/`.

Tickets, Glyphs and Table globe have no text on the page, only the drawing.
