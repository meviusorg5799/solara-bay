// The screenshot scenes behind ?shot=chase|foot|harbor|night. Each one
// plays the real rules forward from a fresh seeded world, steered by a
// simple autopilot (drive toward the mission blip, stay on the road,
// brake for nothing), so the frame is what a short game really looks
// like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createState, stepWorld } from './main.js';
import { createRenderer, SCREEN_PLAY } from './render.js';
import { setWanted } from './police.js';

const canvas = document.getElementById('game');

// A fake input the autopilot steers with: same shape as the real one.
function fakeInput(drive) {
  return {
    held: new Set(),
    mouse: { x: 640, y: 360, down: false },
    axis() {
      return drive;
    },
    takeActions() {
      return 0;
    },
  };
}

// Steer the player's car toward a world point, staying roughly on roads.
function driveToward(state, tx, ty) {
  const p = state.player;
  const want = Math.atan2(ty - p.y, tx - p.x);
  let diff = want - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { x: diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0, y: -1 };
}

function putPlayerInCar(state, x, y, angle) {
  const car = state.parked[0];
  state.parked = state.parked.filter((c) => c !== car);
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 220;
  car.parked = false;
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
}

function runFor(state, seconds, steer) {
  const input = fakeInput({ x: 0, y: -1 });
  for (let i = 0; i < seconds / STEP; i += 1) {
    // No steering function means stand still (the foot scene), not walk.
    const drive = steer ? steer(state) : { x: 0, y: 0 };
    input.axis = () => drive;
    stepWorld(state, input, STEP);
    if (state.dead || state.busted) break;
  }
}

/**
 * Stage the named scene and return the renderer, the state and the
 * screen to draw over it. Unknown names fall back to the foot scene.
 */
export function stageShot(name, seed) {
  const renderer = createRenderer(canvas);
  let state;
  let screen = SCREEN_PLAY;

  if (name === 'chase') {
    // COVER: dusk chase, 3 stars, two police cars closing in behind.
    state = createState(createRandom(seed), 'dusk', false);
    putPlayerInCar(state, 700, 1000, 0);
    setWanted(state.police, 3);
    state.mission.stage = 1; // already in the car: no stage-0 event
    state.missionBlip = state.city.safehouse;
    // Short run east along the y=1000 road: still at full speed, the
    // tail right behind, no turnaround yet.
    runFor(state, 4.5, (s) => driveToward(s, 3000, 1000));
    state.objectiveText = 'Lose the heat — reach the safehouse';
  } else if (name === 'harbor') {
    // Harbor Job escape: roadblock ahead, 4 stars, helicopter overhead.
    state = createState(createRandom(seed), 'day', false);
    putPlayerInCar(state, 1800, 1000, 0);
    setWanted(state.police, 4);
    state.mission.index = 2;
    state.mission.stage = 1;
    state.missionName = 'The Harbor Job';
    state.missionBlip = state.city.safehouse;
    // East along the y=1000 road, through the roadblock at the harbor.
    // The target sits past the run's end so the car never turns around.
    runFor(state, 3.5, (s) => driveToward(s, 3150, 1000));
    state.objectiveText = 'Cargo grabbed — break the roadblock, reach the safehouse';
  } else if (name === 'night') {
    // Night neon coastal-highway drive in the rain.
    state = createState(createRandom(seed), 'night', true);
    putPlayerInCar(state, 1000, 1800, 0);
    state.cash = 1840;
    state.mission.stage = 1;
    state.missionBlip = { x: 2600, y: 1800 };
    // East along the coastal highway, y=1800, still at speed.
    // The target sits past the run's end so the car never turns around.
    runFor(state, 3.5, (s) => driveToward(s, 3150, 1800));
    state.coinsCollected = 7;
    state.objectiveText = 'Cruise the coast — find a sun coin (7/12)';
  } else {
    // On foot downtown: pedestrians, traffic, "Press E to steal".
    state = createState(createRandom(seed), 'day', false);
    state.player.x = state.city.spawn.x + 20;
    state.player.y = state.city.spawn.y;
    runFor(state, 6, null);
    state.nearCar = state.parked[0];
  }
  // A toast from the run (a coin, a stunt) would print across the
  // frame: clear it so the screenshot shows the scene, not the popup.
  state.toast = '';
  state.toastTimer = 0;
  return { renderer, state, screen };
}
