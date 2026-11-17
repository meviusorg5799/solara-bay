// Pedestrians: they stroll the sidewalks, cross at intersections, and
// run away from crashes, gunfire and speeding cars. A few wait at taxi
// stands — flag one down and a fare appears.

import { WORLD } from './config.js';
import { freeSpot } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22', '#2ecc71'];

export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const spot = freeSpot(city, rng);
    peds.push({
      x: spot.x, y: spot.y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 52),
      shirt: SHIRTS[Math.floor(rng.next() * SHIRTS.length)],
      panic: 0,
      taxi: rng.next() < 0.18,
      walkPhase: rng.range(0, Math.PI * 2),
      retarget: rng.range(1, 4),
    });
  }
  return peds;
}

export function updatePeds(city, peds, danger, dt, rng) {
  for (const ped of peds) {
    // Flee: if danger is close, run directly away from it.
    let dx = 0;
    let dy = 0;
    if (danger) {
      const ddx = ped.x - danger.x;
      const ddy = ped.y - danger.y;
      const d = Math.hypot(ddx, ddy);
      if (d < 260) {
        ped.panic = 1.6;
        dx = ddx / (d || 1);
        dy = ddy / (d || 1);
      }
    }
    ped.panic = Math.max(0, ped.panic - dt);
    if (ped.panic > 0) {
      ped.angle = Math.atan2(dy, dx);
      const s = 150 * dt;
      ped.x += Math.cos(ped.angle) * s;
      ped.y += Math.sin(ped.angle) * s;
    } else {
      ped.retarget -= dt;
      if (ped.retarget <= 0) {
        ped.retarget = rng.range(2, 6);
        ped.angle = rng.range(0, Math.PI * 2);
      }
      const s = ped.speed * dt;
      ped.x += Math.cos(ped.angle) * s;
      ped.y += Math.sin(ped.angle) * s;
    }
    ped.walkPhase += dt * (ped.panic > 0 ? 14 : 7);
    ped.x = Math.max(60, Math.min(WORLD.width - 60, ped.x));
    ped.y = Math.max(60, Math.min(WORLD.height - 160, ped.y));
  }
}

// The nearest waiting taxi customer within range, if any.
export function nearestTaxiPed(peds, x, y, range) {
  let best = null;
  let bestD = range;
  for (const ped of peds) {
    if (!ped.taxi) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}
