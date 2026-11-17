// Story: Mara "Rook" Voss, retired getaway driver, pulled back for one
// last job. Five missions, each a small state machine with an objective
// line, a map blip and a payout. Side work — taxi fares — runs alongside.

export const MISSIONS = [
  {
    name: 'Wheels',
    briefing: 'Steal a car and lose the 1-star tail. The crew is waiting.',
    payout: 250,
    objective: 'Steal a car (walk up and press E)',
  },
  {
    name: 'The Pickup',
    briefing: 'Drive the client across town before the clock runs out.',
    payout: 400,
    objective: 'Reach the client, then the drop-off',
  },
  {
    name: 'The Harbor Job',
    briefing: 'Grab the cargo at the harbor, then break the roadblock.',
    payout: 700,
    objective: 'Take the cargo, then reach the safehouse',
  },
  {
    name: 'Clean Getaway',
    briefing: 'A 4-star manhunt. Shake every last cop.',
    payout: 900,
    objective: 'Lose the heat — get wanted to 0',
  },
  {
    name: 'One Last Getaway',
    briefing: 'Five stars. Reach the airstrip and fly out of Solara Bay.',
    payout: 1500,
    objective: 'Reach the airstrip alive',
  },
];

export function createMissionState() {
  return {
    index: 0,          // which mission is active (0..4), 5 = all done
    stage: 0,          // step inside the mission
    timer: 0,          // mission clock (0 = no limit)
    blip: null,        // {x, y} map marker
    text: MISSIONS[0].objective,
    fare: null,        // active taxi fare {from, to, timer, ped}
    fareCooldown: 4,
  };
}

// Where the current objective points. Called once per frame by main.
export function missionBlip(ms, city) {
  if (ms.index >= MISSIONS.length) return city.safehouse;
  const m = ms.index;
  if (m === 0) return ms.stage === 0 ? null : city.safehouse;
  if (m === 1) return ms.stage === 0 ? { x: 1800, y: 600 } : { x: 600, y: 1800 };
  if (m === 2) return ms.stage === 0 ? { x: 2900, y: 1200 } : city.safehouse;
  if (m === 3) return null;
  if (m === 4) return { x: city.airstrip.x + 350, y: city.airstrip.y + 95 };
  return city.safehouse;
}

// Advance the story. `ctx` carries the live world: player, police, cash.
// Returns events: [{type:'complete'|'fail'|'stage', ...}]
export function updateMissions(ms, ctx, dt) {
  const events = [];
  const { player, police, city } = ctx;
  if (ms.index >= MISSIONS.length) return events;
  const m = ms.index;

  if (m === 0) {
    if (ms.stage === 0 && player.inCar) {
      ms.stage = 1;
      ms.text = 'Lose the 1-star tail — get wanted to 0, then reach the safehouse';
      events.push({ type: 'stage', text: ms.text });
    } else if (ms.stage === 1 && police.wanted === 0) {
      const d = Math.hypot(player.x - city.safehouse.x, player.y - city.safehouse.y);
      if (d < 120) events.push({ type: 'complete', payout: MISSIONS[0].payout });
    }
  } else if (m === 1) {
    if (ms.stage === 0) {
      ms.timer = ms.timer || 150;
      ms.timer -= dt;
      const d = Math.hypot(player.x - 1800, player.y - 600);
      if (d < 110) {
        ms.stage = 1;
        ms.timer = 150;
        ms.text = 'Client aboard — drive to the drop-off downtown';
        events.push({ type: 'stage', text: ms.text });
      } else if (ms.timer <= 0) {
        events.push({ type: 'fail', reason: 'The client left. Try again.' });
      }
    } else {
      ms.timer -= dt;
      const d = Math.hypot(player.x - 600, player.y - 1800);
      if (d < 110) events.push({ type: 'complete', payout: MISSIONS[1].payout });
      else if (ms.timer <= 0) events.push({ type: 'fail', reason: 'Out of time. The client walked.' });
    }
  } else if (m === 2) {
    if (ms.stage === 0) {
      const d = Math.hypot(player.x - 2900, player.y - 1200);
      if (d < 130) {
        ms.stage = 1;
        ms.text = 'Cargo grabbed — 3 stars! Break through and reach the safehouse';
        events.push({ type: 'stage', text: ms.text });
      }
    } else if (ms.stage === 1) {
      const d = Math.hypot(player.x - city.safehouse.x, player.y - city.safehouse.y);
      if (d < 130 && police.wanted <= 3) {
        events.push({ type: 'complete', payout: MISSIONS[2].payout });
      }
    }
  } else if (m === 3) {
    if (ms.stage === 0) {
      ms.stage = 1;
      ms.text = '4 stars! Shake every cop until the heat dies';
      events.push({ type: 'stage', text: ms.text });
    } else if (police.wanted === 0) {
      events.push({ type: 'complete', payout: MISSIONS[3].payout });
    }
  } else if (m === 4) {
    const d = Math.hypot(player.x - (city.airstrip.x + 350), player.y - (city.airstrip.y + 95));
    if (d < 180) events.push({ type: 'complete', payout: MISSIONS[4].payout });
  }
  return events;
}

export function completeMission(ms) {
  ms.index += 1;
  ms.stage = 0;
  ms.timer = 0;
  ms.text = ms.index < MISSIONS.length ? MISSIONS[ms.index].objective : 'All missions done — Solara Bay is yours.';
}

export function failMission(ms) {
  ms.stage = 0;
  ms.timer = 0;
  ms.text = MISSIONS[ms.index].objective;
}
