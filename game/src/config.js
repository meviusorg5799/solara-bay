// Solara Bay — every tuning number and colour in one place.
// The world is a 3200x2400 coastal city; the camera shows a 1280x720
// window of it. Nothing here depends on the screen size.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 260,
  health: 100,
  armor: 0,
  pistolDamage: 34,
  fireInterval: 0.28,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 420,
  brake: 620,
  reverseAccel: 220,
  maxSpeed: 520,
  maxReverse: 160,
  steer: 2.6,
  grip: 3.2,
  health: 100,
};

export const WANTED = {
  max: 5,
  decayDelay: 6,      // seconds out of police sight before stars start falling
  decayInterval: 5,   // seconds per star lost while hidden
  steal: 1,
  shoot: 1,
  hitPed: 2,
  killCop: 2,
};

export const MONEY = {
  start: 120,
  repairCost: 50,
  engineCost: 300,
  armorCost: 200,
  taxiFare: 45,
  stuntBonus: 25,
  sunCoin: 50,
};

export const SAVE_KEY = 'solara-bay.save.v1';

export const PALETTE = {
  // day
  grass: '#5d8a4a',
  grassDark: '#527c42',
  road: '#3a3f46',
  roadLine: '#c8b45a',
  sidewalk: '#8d8578',
  building: '#b08968',
  building2: '#7d8aa0',
  building3: '#a06a6a',
  beach: '#e0c98f',
  water: '#2f7fa8',
  waterDeep: '#1f5f86',
  harbor: '#6b6f75',
  runway: '#4a4d52',
  park: '#4e7d3c',
  // dusk / night tints are applied by the renderer over the same map
  text: '#f2ede4',
  muted: '#b9b2a4',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4fc3f7',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
