"""Sample a grain-like land swarm from public-domain Natural Earth geometry."""
import json
import math
import random
import sys
from pathlib import Path

source = json.loads(Path(sys.argv[1]).read_text())
polygons = []
for feature in source['features']:
    geometry = feature['geometry']
    parts = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    for rings in parts:
        outer = rings[0]
        bounds = (min(p[0] for p in outer), min(p[1] for p in outer),
                  max(p[0] for p in outer), max(p[1] for p in outer))
        polygons.append((bounds, rings))


def contains(x, y, ring):
    inside = False
    previous = ring[-1]
    for current in ring:
        ax, ay = current[:2]
        bx, by = previous[:2]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            inside = not inside
        previous = current
    return inside


def is_land(lon, lat):
    for (west, south, east, north), rings in polygons:
        if west <= lon <= east and south <= lat <= north:
            if contains(lon, lat, rings[0]) and not any(contains(lon, lat, hole) for hole in rings[1:]):
                return True
    return False


# Uniform area sampling avoids dense polar bands and visible latitude rows.
rng = random.Random(16)
points = []
for _ in range(110_000):
    phi = math.asin(rng.uniform(-1, 1))
    theta = rng.uniform(-math.pi, math.pi)
    if not is_land(math.degrees(theta), math.degrees(phi)):
        continue
    points.append([round(math.cos(phi) * math.sin(theta), 5),
                   round(math.sin(phi), 5),
                   round(math.cos(phi) * math.cos(theta), 5)])

assert is_land(-.13, 51.51), 'London must be land'
assert not is_land(-30, 0), 'The mid-Atlantic must be ocean'
assert all(abs(sum(n * n for n in point) - 1) < .00003 for point in points)
Path(__file__).with_name('land-particles.json').write_text(json.dumps(points, separators=(',', ':')) + '\n')
print(f'{len(points):,} land particles')
