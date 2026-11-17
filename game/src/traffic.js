// Traffic: civilian cars that follow the road grid, keep to their lane,
// stop at red lights and honk when something blocks them. They slow for
// the car ahead and swerve around a stopped player car, so a chase
// through downtown really has traffic to dodge.

import { WORLD } from './config.js';
import { GRID, ROAD_W, nearestRoadV, nearestRoadH } from './city.js';

const COLORS = ['#c0392b', '#2e86c1', '#e67e22', '#7d3c98', '#16a085', '#b7950b', '#839192', '#f5f5f5'];

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const vertical = rng.next() < 0.5;
    const road = vertical
      ? city.roadsV[Math.floor(rng.next() * city.roadsV.length)]
      : city.roadsH[Math.floor(rng.next() * city.roadsH.length)];
    const dir = rng.next() < 0.5 ? 1 : -1;
    const lane = (ROAD_W / 4) * dir;
    cars.push({
      x: vertical ? road + lane : rng.range(200, WORLD.width - 200),
      y: vertical ? rng.range(200, WORLD.height - 200) : road + lane,
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      vertical, dir, road,
      speed: rng.range(90, 150),
      cruise: rng.range(90, 150),
      color: COLORS[Math.floor(rng.next() * COLORS.length)],
      honk: 0,
      stopped: false,
      offset: 0, // lateral pull-over when a fast car comes up behind
      yielding: false,
    });
  }
  return cars;
}

// Traffic lights: each intersection cycles green/red on a shared clock.
function lightIsGreen(time, roadIndex) {
  const phase = Math.floor(time / 6 + roadIndex) % 2;
  return phase === 0;
}

export function updateTraffic(city, cars, playerCar, dt, time) {
  for (const car of cars) {
    // Car ahead on the same road and lane: slow down, honk if stuck.
    let ahead = Infinity;
    for (const other of cars) {
      if (other === car || other.vertical !== car.vertical || other.road !== car.road) continue;
      const along = car.vertical ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
      const side = car.vertical ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
      if (along > 0 && along < ahead && side < 30) ahead = along;
    }
    if (playerCar) {
      const along = car.vertical ? (playerCar.y - car.y) * car.dir : (playerCar.x - car.x) * car.dir;
      const side = car.vertical ? Math.abs(playerCar.x - car.x) : Math.abs(playerCar.y - car.y);
      if (along > 0 && along < ahead && side < 32) ahead = along;
    }
    let target = car.cruise;
    if (ahead < 90) target = ahead < 55 ? 0 : car.cruise * 0.35;
    // Yield: a fast car right behind makes this one pull to the side
    // of the road, so a getaway driver can thread through traffic.
    // Hysteresis: once it starts pulling over it stays over until the
    // fast car has passed, instead of flicking back and forth.
    let yieldOffset = 0;
    if (playerCar) {
      const behind = car.vertical ? (playerCar.y - car.y) * car.dir : (playerCar.x - car.x) * car.dir;
      const side = car.vertical ? Math.abs(playerCar.x - car.x) : Math.abs(playerCar.y - car.y);
      const playerSpeed = Math.abs(playerCar.speed ?? 0);
      if (!car.yielding && behind < 0 && behind > -170 && side < 46 && playerSpeed > 200) car.yielding = true;
      if (car.yielding && (behind > 10 || behind < -220 || playerSpeed <= 150)) car.yielding = false;
      if (car.yielding) yieldOffset = car.vertical ? -car.dir * 40 : car.dir * 40;
    }
    car.offset += Math.max(-60 * dt, Math.min(60 * dt, yieldOffset - car.offset));
    if (car.vertical) car.x = car.road + (ROAD_W / 4) * car.dir + car.offset;
    else car.y = car.road + (ROAD_W / 4) * car.dir + car.offset;
    // Stop at a red light when approaching an intersection.
    const pos = car.vertical ? car.y : car.x;
    const nextCross = Math.ceil((pos * car.dir) / GRID) * GRID * car.dir;
    const dist = (nextCross - pos) * car.dir;
    if (dist > 0 && dist < 70) {
      const idx = Math.round(nextCross / GRID);
      if (!lightIsGreen(time, idx)) target = 0;
    }
    car.speed += Math.max(-260 * dt, Math.min(160 * dt, target - car.speed));
    if (car.speed < 1 && ahead < 55) car.honk = Math.max(car.honk, 0.4);
    car.honk = Math.max(0, car.honk - dt);
    const step = car.speed * dt * car.dir;
    if (car.vertical) car.y += step;
    else car.x += step;
    // Wrap around the world edge so traffic never runs out.
    if (car.vertical && (car.y < 100 || car.y > WORLD.height - 100)) {
      car.y = car.dir > 0 ? 120 : WORLD.height - 120;
      car.x = nearestRoadV(city, car.x) + (ROAD_W / 4) * car.dir;
    }
    if (!car.vertical && (car.x < 100 || car.x > WORLD.width - 100)) {
      car.x = car.dir > 0 ? 120 : WORLD.width - 120;
      car.y = nearestRoadH(city, car.y) + (ROAD_W / 4) * car.dir;
    }
  }
}
