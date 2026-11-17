// Boot and the one loop: input every frame, the world in fixed 1/60 s
// steps, the renderer painting what is there. Screens: title, play,
// paused, wasted, busted, win.
//
// ?seed=N fixes the city. ?shot=chase|foot|harbor|night (with &seed=N)
// stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.

import { STEP, VIEW, WORLD, CAR, PLAYER, MONEY, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createCity, collideBuildings, onRoad, freeSpot } from './city.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds, nearestTaxiPed } from './peds.js';
import { createPolice, setWanted, addWanted, updatePolice } from './police.js';
import { createBullets, fireBullet, updateBullets, policeFire } from './combat.js';
import { MISSIONS, createMissionState, updateMissions, completeMission, failMission, missionBlip } from './missions.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_BUSTED, SCREEN_WIN } from './render.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_STEAL, ACTION_REPAIR, ACTION_TAXI, createInput } from './input.js';
import { stageShot } from './shots.js';
import { loadSave, writeSave } from './save.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

export function createState(rng, timeOfDay, rain) {
  const city = createCity(rng);
  const parked = [];
  const carColors = ['#c0392b', '#2e86c1', '#e67e22', '#16a085', '#b7950b', '#839192'];
  for (let i = 0; i < 26; i += 1) {
    const spot = freeSpot(city, rng);
    parked.push({
      x: spot.x, y: spot.y, angle: rng.range(0, Math.PI * 2),
      speed: 0, health: 100, color: carColors[i % carColors.length],
      engine: 0, armor: 0, parked: true,
    });
  }
  // A few parked cars right by the spawn, on the road, so mission 1 starts fast.
  parked[0].x = city.spawn.x + 60;
  parked[0].y = 600;
  parked[0].angle = 0;
  parked[1].x = city.spawn.x - 60;
  parked[1].y = 600;
  parked[1].angle = Math.PI;

  const saved = loadSave();
  const state = {
    rng, city, timeOfDay, rain,
    time: 0,
    cash: saved ? saved.cash : MONEY.start,
    coinsCollected: saved ? saved.coins : 0,
    bestScore: saved ? saved.bestScore : 0,
    missionsDone: saved ? saved.missionsDone : 0,
    player: {
      x: city.spawn.x, y: city.spawn.y, angle: -Math.PI / 2, radius: PLAYER.radius,
      health: PLAYER.health, armor: PLAYER.armor,
      inCar: false, car: null, fireTimer: 0, airTime: 0,
    },
    parked,
    traffic: spawnTraffic(city, rng, 22),
    peds: spawnPeds(city, rng, 34),
    police: createPolice(),
    bullets: createBullets(),
    mission: createMissionState(),
    missionName: MISSIONS[0].name,
    objectiveText: MISSIONS[0].objective,
    missionBlip: null,
    toast: '', toastTimer: 0,
    nearCar: null,
    fare: null,
    score: 0,
  };
  state.mission.index = Math.min(state.missionsDone, MISSIONS.length);
  if (state.mission.index < MISSIONS.length) {
    state.missionName = MISSIONS[state.mission.index].name;
    state.objectiveText = MISSIONS[state.mission.index].objective;
  }
  // Restore already-collected sun coins.
  for (let i = 0; i < state.coinsCollected && i < city.coins.length; i += 1) {
    city.coins[i].taken = true;
  }
  return state;
}

function toast(state, text, seconds) {
  state.toast = text;
  state.toastTimer = seconds || 3;
}

function nearestParked(state, range) {
  let best = null;
  let bestD = range;
  for (const car of state.parked) {
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function damagePlayer(state, amount) {
  const p = state.player;
  const absorbed = Math.min(p.armor, amount);
  p.armor -= absorbed;
  p.health -= (amount - absorbed);
  if (p.health <= 0) {
    p.health = 0;
    return true;
  }
  return false;
}

export function stepWorld(state, input, dt, actionsIn) {
  const p = state.player;
  const axis = input.axis();
  state.time += dt;
  state.toastTimer = Math.max(0, state.toastTimer - dt);

  // --- Player movement ---
  if (p.inCar && p.car) {
    const car = p.car;
    const forward = axis.y < 0;
    const back = axis.y > 0;
    const steer = axis.x;
    const engine = 1 + car.engine * 0.35;
    if (forward) car.speed += CAR.accel * engine * dt;
    else if (back) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
    const maxF = CAR.maxSpeed * engine;
    car.speed = Math.max(-CAR.maxReverse, Math.min(maxF, car.speed));
    const grip = onRoad(state.city, car.x, car.y) ? 1 : 0.55;
    car.angle += steer * CAR.steer * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120) * grip;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
    // Buildings push the car itself out (the body passed in is moved) and
    // dent it once per bump, not once per frame while it scrapes along.
    car.bumpCool = Math.max(0, (car.bumpCool || 0) - dt);
    if (collideBuildings(state.city, car) && car.bumpCool <= 0) {
      car.bumpCool = 0.5;
      car.speed *= -0.3;
      car.health -= 2;
      audio.crash();
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Stunt jumps: a ramp at speed launches the car.
    for (const r of state.city.ramps) {
      if (Math.hypot(car.x - r.x, car.y - r.y) < 30 && Math.abs(car.speed) > 260 && p.airTime <= 0) {
        p.airTime = 0.9;
        state.cash += MONEY.stuntBonus;
        toast(state, 'STUNT JUMP! +$' + MONEY.stuntBonus, 2);
        audio.coin();
      }
    }
    if (p.airTime > 0) p.airTime -= dt;
    // Drive-by: SPACE fires sideways from the car.
    p.fireTimer -= dt;
    if (input.held.has('Space') && p.fireTimer <= 0) {
      p.fireTimer = 0.32;
      fireBullet(state.bullets, car.x, car.y, car.angle + Math.PI / 2, 700, 'player', PLAYER.pistolDamage);
      audio.shot();
      addWanted(state.police, 0); // firing alone does not add heat; hits do
    }
    // Roadblocks are solid: hitting one at speed wrecks the car.
    for (const rb of state.police.roadblocks) {
      rb.cool = Math.max(0, (rb.cool || 0) - dt);
      if (rb.cool <= 0 && Math.hypot(rb.x - car.x, rb.y - car.y) < 36 && Math.abs(car.speed) > 60) {
        rb.cool = 0.8;
        car.speed *= 0.5;
        car.health -= 5;
        audio.crash();
        if (car.health <= 0) {
          toast(state, 'Your car is wrecked — get out!', 3);
          exitCar(state);
        }
      }
    }
    // Traffic collisions dent the car — but only once per bump, not per frame.
    for (const t of state.traffic) {
      t.cool = Math.max(0, (t.cool || 0) - dt);
      if (t.cool <= 0 && Math.hypot(t.x - car.x, t.y - car.y) < 34 && Math.abs(car.speed) > 60) {
        t.cool = 0.8;
        car.speed *= 0.75;
        car.health -= 2;
        t.speed = 0;
        audio.crash();
        if (car.health <= 0) {
          toast(state, 'Your car is wrecked — get out!', 3);
          exitCar(state);
        }
      }
    }
    audio.engine(Math.abs(car.speed) / CAR.maxSpeed, true);
  } else {
    const run = input.held.has('ShiftLeft') || input.held.has('ShiftRight');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (axis.x !== 0 || axis.y !== 0) {
      const len = Math.hypot(axis.x, axis.y);
      p.x += (axis.x / len) * speed * dt;
      p.y += (axis.y / len) * speed * dt;
      p.angle = Math.atan2(axis.y, axis.x);
    }
    p.x = Math.max(30, Math.min(WORLD.width - 30, p.x));
    p.y = Math.max(30, Math.min(WORLD.height - 30, p.y));
    collideBuildings(state.city, p); // pushes the player out of buildings
    // Pistol: SPACE fires toward the mouse (screen) direction.
    p.fireTimer -= dt;
    if (input.held.has('Space') && p.fireTimer <= 0) {
      p.fireTimer = PLAYER.fireInterval;
      const rect = canvas.getBoundingClientRect();
      const scaleX = VIEW.width / rect.width;
      const scaleY = VIEW.height / rect.height;
      const camX = Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2));
      const camY = Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2));
      const mx = input.mouse.x * scaleX + camX;
      const my = input.mouse.y * scaleY + camY;
      const angle = Math.atan2(my - p.y, mx - p.x);
      p.angle = angle;
      fireBullet(state.bullets, p.x, p.y, angle, 760, 'player', PLAYER.pistolDamage);
      audio.shot();
    }
    audio.engine(0, false);
  }

  // --- Steal / exit / repair / taxi actions ---
  // One-shot actions arrive from the caller (the frame loop already took
  // them off the queue once); a bare stepWorld call reads the queue itself.
  state.nearCar = p.inCar ? null : nearestParked(state, 70);
  const actions = actionsIn ?? input.takeActions();
  if ((actions & ACTION_STEAL) && !p.inCar && state.nearCar) {
    const car = state.nearCar;
    state.parked = state.parked.filter((c) => c !== car);
    car.parked = false;
    p.inCar = true;
    p.car = car;
    addWanted(state.police, WANTED.steal);
    toast(state, 'Car stolen — the heat is on!', 2.5);
    audio.siren();
  } else if ((actions & ACTION_STEAL) && p.inCar) {
    exitCar(state);
  }
  if (actions & ACTION_REPAIR) {
    const d = Math.hypot(p.x - state.city.safehouse.x, p.y - state.city.safehouse.y);
    if (d < 140 && state.cash >= MONEY.repairCost) {
      state.cash -= MONEY.repairCost;
      p.health = PLAYER.health;
      if (p.car) p.car.health = 100;
      toast(state, 'Patched up at the safehouse. -$' + MONEY.repairCost, 2.5);
    }
  }
  if (actions & ACTION_TAXI && p.inCar && !state.fare) {
    const ped = nearestTaxiPed(state.peds, p.x, p.y, 120);
    if (ped) startFare(state, ped);
  }

  // --- Traffic, peds, police, bullets ---
  updateTraffic(state.city, state.traffic, p.inCar ? p.car : null, dt, state.time);
  const danger = state.bullets.length > 0 ? { x: p.x, y: p.y } : null;
  updatePeds(state.city, state.peds, danger, dt, state.rng);
  const seen = updatePolice(state.police, p, dt, state.time, state.rng, state.city);
  policeFire(state.police, p, state.bullets, dt);
  updateBullets(state.bullets, state, dt, (hit) => {
    if (hit.kind === 'player') {
      if (damagePlayer(state, hit.damage)) state.dead = true;
    } else if (hit.kind === 'ped') {
      hit.target.panic = 2;
      addWanted(state.police, WANTED.hitPed);
      toast(state, 'You hit a pedestrian!', 2);
    } else if (hit.kind === 'cop') {
      hit.target.health -= hit.damage;
      if (hit.target.health <= 0) {
        state.police.cars = state.police.cars.filter((c) => c !== hit.target);
        addWanted(state.police, WANTED.killCop);
      }
    } else if (hit.kind === 'traffic') {
      hit.target.speed = 0;
    }
  });

  // Cop rams hurt — one solid hit at speed, then the cop falls back and
  // has to chase again. The damage scales with the closing speed, so a
  // cop merely keeping pace behind you barely dents the paint.
  for (const cop of state.police.cars) {
    cop.ramTimer = Math.max(0, (cop.ramTimer || 0) - dt);
    if (Math.hypot(cop.x - p.x, cop.y - p.y) < 34 && cop.ramTimer <= 0 && cop.speed > 120) {
      cop.ramTimer = 0.9;
      cop.speed *= 0.4;
      if (p.inCar && p.car) {
        const closing = Math.abs(cop.speed - Math.abs(p.car.speed));
        p.car.health -= Math.max(1, Math.min(5, Math.round(closing / 50)));
        audio.crash();
        if (p.car.health <= 0) {
          toast(state, 'Your car is wrecked — get out!', 3);
          exitCar(state);
        }
      } else if (damagePlayer(state, 12)) {
        state.dead = true;
      }
    }
  }
  // Busted: a cop touches the player on foot while wanted.
  if (!p.inCar && state.police.wanted >= 2) {
    for (const cop of state.police.cars) {
      if (Math.hypot(cop.x - p.x, cop.y - p.y) < 26) state.busted = true;
    }
  }

  // --- Pickups, coins, taxi fare ---
  for (const pk of state.city.pickups) {
    if (pk.taken) {
      // A spent pickup comes back after its respawn timer runs out.
      if (pk.respawn > 0) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) pk.taken = false;
      }
      continue;
    }
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      pk.taken = true;
      pk.respawn = 45;
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 50);
      else p.armor = Math.min(100, p.armor + 50);
      toast(state, pk.kind === 'health' ? 'Health +50' : 'Armor +50', 2);
      audio.coin();
    }
  }
  for (const c of state.city.coins) {
    if (!c.taken && Math.hypot(c.x - p.x, c.y - p.y) < 28) {
      c.taken = true;
      state.coinsCollected += 1;
      state.cash += MONEY.sunCoin;
      toast(state, 'Sun coin! +$' + MONEY.sunCoin + ' (' + state.coinsCollected + '/12)', 2);
      audio.coin();
    }
  }
  if (state.fare) {
    const f = state.fare;
    f.timer -= dt;
    const dest = f.stage === 0 ? f.pickup : f.dropoff;
    if (Math.hypot(p.x - dest.x, p.y - dest.y) < 110) {
      if (f.stage === 0) {
        f.stage = 1;
        f.timer = 120;
        toast(state, 'Passenger aboard — drive to the marker', 2.5);
      } else {
        state.cash += MONEY.taxiFare;
        toast(state, 'Fare complete! +$' + MONEY.taxiFare, 2.5);
        state.fare = null;
        audio.mission();
      }
    } else if (f.timer <= 0) {
      toast(state, 'The fare gave up waiting.', 2);
      state.fare = null;
    }
  }

  // --- Missions ---
  const events = updateMissions(state.mission, { player: p, police: state.police, city: state.city }, dt);
  for (const ev of events) {
    if (ev.type === 'complete') {
      state.cash += ev.payout;
      state.missionsDone += 1;
      state.score += ev.payout;
      toast(state, MISSIONS[state.mission.index].name + ' complete! +$' + ev.payout, 3.5);
      audio.mission();
      completeMission(state.mission);
      if (state.mission.index < MISSIONS.length) {
        state.missionName = MISSIONS[state.mission.index].name;
        state.objectiveText = MISSIONS[state.mission.index].objective;
      } else {
        state.won = true;
      }
      // Mission 3 starts hot, mission 5 starts hottest.
      if (state.mission.index === 3) setWanted(state.police, 4);
      if (state.mission.index === 4) setWanted(state.police, 5);
      writeSave(state);
    } else if (ev.type === 'fail') {
      toast(state, ev.reason, 3);
      failMission(state.mission);
      state.objectiveText = MISSIONS[state.mission.index].objective;
    } else if (ev.type === 'stage') {
      state.objectiveText = ev.text;
      if (state.mission.index === 2 && state.mission.stage === 1) setWanted(state.police, 3);
      audio.mission();
    }
  }
  state.missionBlip = missionBlip(state.mission, state.city);
  if (state.fare && state.fare.stage === 1) state.missionBlip = state.fare.dropoff;
  if (state.mission.index >= MISSIONS.length) {
    state.missionName = 'Free roam';
    state.objectiveText = 'All missions done — cruise Solara Bay';
  }
}

function exitCar(state) {
  const p = state.player;
  if (!p.car) return;
  const car = p.car;
  car.speed = 0;
  state.parked.push(car);
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  p.inCar = false;
  p.car = null;
}

function startFare(state, ped) {
  const rng = state.rng;
  const dest = freeSpot(state.city, rng);
  state.fare = {
    pickup: { x: ped.x, y: ped.y },
    dropoff: dest,
    stage: 0,
    timer: 60,
    ped,
  };
  ped.taxi = false;
  toast(state, 'Fare: pick up the passenger at the marker', 3);
}

function runShot(name) {
  const scene = stageShot(name, seed);
  // Same read-only handle as the live game, for the screenshot script.
  window.__solara = {
    get state() { return scene.state; },
    get screen() { return scene.screen; },
  };
  let painted = 0;
  function paint() {
    scene.renderer.draw(scene.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const renderer = createRenderer(canvas);
  const state = createState(createRandom(seed), 'day', false);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    const fresh = createState(createRandom(seed), 'day', false);
    Object.assign(state, fresh);
    screen = SCREEN_PLAY;
    announce('Playing. Mission: ' + state.missionName);
  }

  function endGame(kind) {
    screen = kind === 'busted' ? SCREEN_BUSTED : SCREEN_OVER;
    state.bestScore = Math.max(state.bestScore, state.score);
    writeSave(state);
    announce(kind === 'busted' ? 'Busted.' : 'Wasted.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED || screen === SCREEN_WIN) {
        startGame();
      }
    }
    if ((actions & ACTION_PAUSE) && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if ((actions & ACTION_PAUSE) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (input.held.has('KeyM')) {
      input.held.delete('KeyM');
      audio.toggleMute();
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // The frame's one-shot actions go to the first step only, so a
      // steal press can never double-fire across catch-up steps.
      let pending = actions;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        if (screen === SCREEN_TITLE) {
          state.time += STEP;
          updateTraffic(state.city, state.traffic, null, STEP, state.time);
          updatePeds(state.city, state.peds, null, STEP, state.rng);
        } else {
          stepWorld(state, input, STEP, pending);
          pending = 0;
          if (state.dead) endGame('wasted');
          else if (state.busted) endGame('busted');
          else if (state.won) screen = SCREEN_WIN;
        }
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });

  // Read-only handle for play-testing and the screenshot autopilot.
  window.__solara = {
    get state() { return state; },
    get screen() { return screen; },
  };

  announce('Solara Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
