// The law: wanted stars 0–5 drive an escalating response. Patrol cars
// cruise the grid; when the player is wanted they chase, ram and (at 3+)
// shoot. At 3 stars roadblocks appear ahead of the player; at 4–5 a
// helicopter circles overhead and spots the player, blocking the wanted
// decay. Out of every cop's sight for a while, stars fall one by one.
// Cops drive the same streets as everyone else: buildings block them
// too, so they cannot cut straight through a block to catch you.

import { WORLD } from './config.js';
import { collideBuildings } from './city.js';

const COP_COLOR = '#1f3a93';

export function createPolice() {
  return {
    cars: [],
    heli: null,
    roadblocks: [],
    wanted: 0,
    seenTimer: 0,   // time since any cop last saw the player
    decayTimer: 0,
    spawnTimer: 0,
  };
}

function copCountFor(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted] ?? 0;
}

function spawnCop(police, x, y, angle) {
  police.cars.push({
    x, y, angle,
    speed: 0,
    maxSpeed: 300,
    health: 60,
    siren: Math.random() * Math.PI * 2,
    shootTimer: 1,
    lastSeen: null,   // last place the player was actually seen
    searchTimer: 0,
    wanderTimer: 0,
    wanderAngle: angle,
  });
}

// Line of sight: is the straight segment between two points clear of
// every building? Sampled — cheap, and exact enough for a chase.
function hasLineOfSight(city, x0, y0, x1, y1) {
  if (!city) return true;
  const steps = 16;
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + (x1 - x0) * (i / steps);
    const y = y0 + (y1 - y0) * (i / steps);
    for (const b of city.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
    }
  }
  return true;
}

export function setWanted(police, level) {
  police.wanted = Math.max(0, Math.min(5, level));
  police.seenTimer = 0;
  police.decayTimer = 0;
}

export function addWanted(police, amount) {
  setWanted(police, police.wanted + amount);
}

export function updatePolice(police, player, dt, time, rng, city) {
  const wanted = police.wanted;
  const px = player.x;
  const py = player.y;

  // How many patrol cars the heat calls for.
  const want = copCountFor(wanted);
  police.spawnTimer -= dt;
  if (police.cars.length < want && police.spawnTimer <= 0) {
    police.spawnTimer = 2.5;
    const angle = rng.range(0, Math.PI * 2);
    const d = 620;
    spawnCop(police,
      Math.max(120, Math.min(WORLD.width - 120, px + Math.cos(angle) * d)),
      Math.max(120, Math.min(WORLD.height - 120, py + Math.sin(angle) * d)),
      angle + Math.PI);
    // The call that sent them: the suspect was last seen right here.
    police.cars[police.cars.length - 1].lastSeen = { x: px, y: py };
  }
  while (police.cars.length > want && police.cars.length > 0) police.cars.pop();

  let anySees = false;
  for (const cop of police.cars) {
    const dx = px - cop.x;
    const dy = py - cop.y;
    const dist = Math.hypot(dx, dy);
    // A cop only sees the player with a clear line of sight. Break
    // it — turn a corner, duck behind a block — and the cop drives to
    // where you were last seen instead of homing in on you forever.
    const sees = dist < 560 && hasLineOfSight(city, cop.x, cop.y, px, py);
    if (sees) {
      anySees = true;
      cop.lastSeen = { x: px, y: py };
      cop.searchTimer = 0;
    }
    let tx = px;
    let ty = py;
    if (!sees && cop.lastSeen) {
      tx = cop.lastSeen.x;
      ty = cop.lastSeen.y;
      // Reached the last seen spot and nobody is here: the trail is cold.
      if (Math.hypot(tx - cop.x, ty - cop.y) < 70) {
        cop.searchTimer += dt;
        if (cop.searchTimer > 3) {
          cop.lastSeen = null;
          cop.searchTimer = 0;
        }
      }
    }
    if (!sees && !cop.lastSeen) {
      // No trail at all: cruise the streets instead of piling up.
      cop.wanderTimer -= dt;
      if (cop.wanderTimer <= 0) {
        cop.wanderTimer = rng.range(3, 7);
        cop.wanderAngle = rng.range(0, Math.PI * 2);
      }
      tx = cop.x + Math.cos(cop.wanderAngle) * 200;
      ty = cop.y + Math.sin(cop.wanderAngle) * 200;
    }
    const tdx = tx - cop.x;
    const tdy = ty - cop.y;
    const wantAngle = Math.atan2(tdy, tdx);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    // A hard turn scrubs a cop's speed, so a driver who turns sharply
    // and floors it can break away — the tail is beatable, not glued on.
    const turnPenalty = 1 - Math.min(0.4, Math.abs(diff) * 0.25);
    const cruise = cop.lastSeen || sees ? 1 : 0.35;
    const target = Math.min(300 + wanted * 45, 520) * turnPenalty * cruise;
    cop.speed += Math.max(-400 * dt, Math.min(300 * dt, target - cop.speed));
    // Ram: if close, push in hard; if far, cruise.
    if (sees && dist < 60) cop.speed = Math.max(cop.speed, 340);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = Math.max(40, Math.min(WORLD.width - 40, cop.x));
    cop.y = Math.max(40, Math.min(WORLD.height - 40, cop.y));
    // Buildings block cops too — they must go around the block.
    if (city) collideBuildings(city, cop);
    cop.siren += dt * 6;
    cop.shootTimer -= dt;
  }

  // Roadblocks at 3+ stars: two parked interceptors across the road ahead.
  if (wanted >= 3 && police.roadblocks.length === 0) {
    const angle = player.angle ?? 0;
    const bx = px + Math.cos(angle) * 520;
    const by = py + Math.sin(angle) * 520;
    police.roadblocks.push(
      { x: bx, y: by - 34, angle: angle + Math.PI / 2 },
      { x: bx, y: by + 34, angle: angle + Math.PI / 2 },
    );
  }
  if (wanted < 3) police.roadblocks = [];

  // Helicopter at 4–5 stars: circles the player and keeps them spotted.
  if (wanted >= 4 && !police.heli) {
    police.heli = { angle: 0, radius: 190, x: px, y: py };
  }
  if (wanted < 4) police.heli = null;
  if (police.heli) {
    police.heli.angle += dt * 0.55;
    police.heli.x = px + Math.cos(police.heli.angle) * police.heli.radius;
    police.heli.y = py + Math.sin(police.heli.angle) * police.heli.radius;
    anySees = true;
  }

  // Wanted decay: only when nobody can see the player.
  if (wanted > 0) {
    if (anySees) {
      police.seenTimer = 0;
      police.decayTimer = 0;
    } else {
      police.seenTimer += dt;
      if (police.seenTimer > 6) {
        police.decayTimer += dt;
        if (police.decayTimer > 5) {
          police.decayTimer = 0;
          setWanted(police, wanted - 1);
        }
      }
    }
  }
  return { anySees };
}

export function copColor() {
  return COP_COLOR;
}
