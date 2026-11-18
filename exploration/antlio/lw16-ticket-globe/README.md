# Ticket globe exploration

A standalone study combining continent-shaped monochrome particle swarms, glyph satellite paths, and city ticket beacons. The ticket counts are fictional demo data. City counts vary so the density treatment can be compared. No registration, location lookup, geolocation request, database access, or network broadcast occurs.

The page has no text: only the globe, with a status line for screen readers. Move the pointer to aim, drag to turn, and use the arrow keys to rotate. Escape resets the view.

## Graphic treatment

The continents are sampled from the public-domain [Natural Earth 1:110m land dataset](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson). Points use uniform random surface-area sampling rather than latitude rows, creating irregular grain that still reads as a geographic map. No coastline outlines or solid land fills are drawn.

Land particles have varied brightness and size, a slight radial depth, and restrained luminance movement. A sparse, faint ambient field spans the oceans. All particles use the same neutral foreground color in twelve luminance buckets, retaining the duotone appearance. Glyphs remain confined to satellite orbit lines.

To rebuild the local particle map, run `python3 build-particle-map.py /path/to/ne_110m_land.geojson`. The builder checks that London is land, the mid-Atlantic is ocean, and every particle sits on the unit sphere. No map API is used at runtime.

## Radial density beacons

Cities with four or more demo tickets emit slim beacons along the surface normal at their latitude and longitude. Logarithmic count scaling controls their height and number, so sparse and popular locations remain distinguishable without the tallest columns dominating the globe. Each root is a point on the unit sphere, and each tip is that point scaled outward before projection. The beams therefore fan outward with the globe, changing their screen angle and foreshortening as it rotates. Neighboring columns use nearby tangent offsets and their own surface normals. A narrow shimmer travels along the projected root-to-tip direction.

Reduced motion retains only the static columns. The demo has 73 tickets across ten cities.

## Connecting actual registrations

The existing Launch Week ticket pages already read a `location` field from the ticket view. Relevant code includes `apps/www/pages/launch-week/tickets/[username].tsx` and the registration hooks under `apps/www/components/LaunchWeek/15/`.

For a live implementation:

1. After issuing the ticket, let the person choose whether to appear publicly and confirm their city.
2. Resolve that city to a city center. Keep the map position at city-level precision.
3. Provide a public attendee feed containing only the fields used by the globe: ticket identifier, chosen display name, public handle/avatar, city, country, and city-center coordinates. Private registration fields do not belong in that feed.
4. Aggregate markers by city, then cluster nearby city markers as registrations grow. Fetch the city list and page its attendee cards on demand.
5. Broadcast newly public tickets to the globe. Update the city count and show a brief arrival pulse. A ticket without an optional public city can still be registered without appearing on the globe.
6. Link individual ticket cards to the actual existing share page when integrating the new launch.

This study demonstrates the visual states only. It does not implement those backend steps.

## Preview

Serve the parent folder and open `/lw16-ticket-globe/`.

Checked in the browser: the globe, its beacons, pointer and keyboard turns, and reduced motion. The JavaScript syntax checks pass.
