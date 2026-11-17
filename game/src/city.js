// Solara Bay's map: a seeded grid city on a coast. Roads run on a 400 px
// grid; the blocks between them hold buildings, parks and parking lots.
// The south edge is a beach and sea, the east edge a harbor with docks,
// the north-east corner an airstrip, the north-west hills. The safehouse
// sits downtown. Everything a system needs — roads, buildings, ramps,
// sun coins, pickups, spawn points — comes out of one seeded build.

import { WORLD } from './config.js';

export const ROAD_W = 72;
export const GRID = 400;

export function createCity(rng) {
  const roadsV = [];
  const roadsH = [];
  for (let x = 200; x < WORLD.width - 100; x += GRID) roadsV.push(x);
  for (let y = 200; y < WORLD.height - 100; y += GRID) roadsH.push(y);

  const buildings = [];
  const parks = [];
  const lots = [];
  for (let gx = 0; gx < roadsV.length - 1; gx += 1) {
    for (let gy = 0; gy < roadsH.length - 1; gy += 1) {
      const x0 = roadsV[gx] + ROAD_W / 2 + 14;
      const y0 = roadsH[gy] + ROAD_W / 2 + 14;
      const x1 = roadsV[gx + 1] - ROAD_W / 2 - 14;
      const y1 = roadsH[gy + 1] - ROAD_W / 2 - 14;
      // Keep the airstrip corner and the harbor clear of buildings.
      if (x0 > 2350 && y0 < 420) continue;
      if (x0 > 2750) continue;
      if (y0 > 2050) continue; // beachfront stays open
      const roll = rng.next();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      if (roll < 0.28) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // One or two buildings per block, with a seeded height and colour.
      const split = rng.next() < 0.5;
      const bw = x1 - x0;
      const bh = y1 - y0;
      const first = {
        x: x0, y: y0,
        w: split ? bw * 0.55 : bw,
        h: split ? bh : bh * 0.55,
        height: rng.int(1, 9),
        tone: rng.int(0, 2),
      };
      buildings.push(first);
      if (split) {
        buildings.push({
          x: x0 + bw * 0.55 + 12, y: y0 + bh * 0.55 + 12,
          w: bw * 0.45 - 12, h: bh * 0.45 - 12,
          height: rng.int(1, 6), tone: rng.int(0, 2),
        });
      } else {
        buildings.push({
          x: x0, y: y0 + bh * 0.55 + 12,
          w: bw, h: bh * 0.45 - 12,
          height: rng.int(1, 6), tone: rng.int(0, 2),
        });
      }
    }
  }

  // Stunt jump ramps: a ramp on a long straight, a beach ramp, a harbor ramp.
  const ramps = [
    { x: 1000, y: 596, angle: 0, name: 'Downtown jump' },
    { x: 2200, y: 1996, angle: Math.PI / 2, name: 'Beach jump' },
    { x: 2900, y: 1400, angle: Math.PI, name: 'Harbor jump' },
  ];

  // Twelve hidden sun coins, scattered on roads, beach and harbor.
  const coins = [];
  const coinSpots = [
    [600, 200], [1800, 600], [2600, 1000], [400, 1400], [1400, 1800],
    [2200, 600], [1000, 2200], [2900, 1800], [200, 600], [2600, 200],
    [1800, 1400], [600, 1000],
  ];
  for (const [x, y] of coinSpots) coins.push({ x, y, taken: false });

  // Health and armor pickups: clinics downtown, harbor and beach.
  const pickups = [
    { x: 620, y: 620, kind: 'health', taken: false, respawn: 0 },
    { x: 1820, y: 1020, kind: 'armor', taken: false, respawn: 0 },
    { x: 2620, y: 1620, kind: 'health', taken: false, respawn: 0 },
    { x: 1020, y: 2180, kind: 'armor', taken: false, respawn: 0 },
    { x: 2220, y: 220, kind: 'health', taken: false, respawn: 0 },
  ];

  return {
    roadsV, roadsH, buildings, parks, lots, ramps, coins, pickups,
    safehouse: { x: 600, y: 600 },
    airstrip: { x: 2400, y: 120, w: 700, h: 190 },
    harbor: { x: 2780, y: 900, w: 420, h: 1300 },
    beach: { y: 2120 },
    sea: { y: 2260 },
    spawn: { x: 600, y: 640 },
  };
}

// Is this point on a road (plus a small shoulder)?
export function onRoad(city, x, y) {
  for (const rx of city.roadsV) if (Math.abs(x - rx) < ROAD_W / 2 + 10) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) < ROAD_W / 2 + 10) return true;
  return false;
}

// Nearest road coordinate on one axis, for traffic lane keeping.
export function nearestRoadV(city, x) {
  let best = city.roadsV[0];
  for (const rx of city.roadsV) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
export function nearestRoadH(city, y) {
  let best = city.roadsH[0];
  for (const ry of city.roadsH) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

// Push a circle out of every building it overlaps. Returns true on a hit.
export function collideBuildings(city, body) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    const r = body.radius ?? 20;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * r;
        body.y = cy + (dy / d) * r;
      } else {
        body.x += r;
      }
    }
  }
  return hit;
}

// A point on the drivable land: inside the world, not in the sea, not
// inside a building. Used to drop parked cars and pedestrians.
export function freeSpot(city, rng) {
  for (let tries = 0; tries < 40; tries += 1) {
    const x = rng.range(120, WORLD.width - 120);
    const y = rng.range(120, WORLD.height - 260);
    if (y > city.beach.y + 40 && x < 2700) continue; // beach sand, keep clear
    if (x > 2780) continue; // harbor water
    const probe = { x, y, radius: 24 };
    if (collideBuildings(city, probe)) continue;
    return { x, y };
  }
  return { x: 600, y: 640 };
}
