// The painter: a top-down canvas view of Solara Bay. Day, dusk and night
// are the same map under different light; rain and the helicopter
// spotlight are drawn on top. HUD, minimap and every screen live here
// too, so a screenshot always shows the whole game at a glance.

import { VIEW, WORLD, FONT, PALETTE } from './config.js';
import { ROAD_W } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

const SKY = {
  day: { top: '#8ec9e8', tint: 'rgba(255,255,255,0)', sun: '#fff3b0' },
  dusk: { top: '#e8935a', tint: 'rgba(232,120,60,0.26)', sun: '#ff9a3c' },
  night: { top: '#0d1526', tint: 'rgba(10,16,40,0.42)', sun: '#e8ecff' },
};

function drawCar(ctx, x, y, angle, color, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-24, -12, 48, 26);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-23, -11, 46, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,28,38,0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -9, 16, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(20, -9, 3, 5);
  ctx.fillRect(20, 4, 3, 5);
  ctx.fillStyle = '#e5534b';
  ctx.fillRect(-23, -9, 3, 5);
  ctx.fillRect(-23, 4, 3, 5);
  if (opts.taxi) {
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(-4, -12, 10, 5);
  }
  if (opts.police) {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-6, -11, 12, 22);
    ctx.fillStyle = '#1f3a93';
    ctx.fillRect(-6, -11, 12, 6);
    ctx.fillStyle = opts.sirenOn ? '#e5534b' : '#4fc3f7';
    ctx.fillRect(-2, -13, 5, 4);
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  const bob = Math.sin(ped.walkPhase) * 2;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.4);
  ctx.rotate(ped.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(6, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (ped.taxi) {
    ctx.fillStyle = '#f2c94c';
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('$', ped.x, ped.y - 14);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  function drawMap(state) {
    const { city, timeOfDay } = state;
    const sky = SKY[timeOfDay];
    // Ground: grass base, then districts.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Hills, north-west.
    ctx.fillStyle = '#6d8a52';
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(160 + i * 170, 130 + (i % 2) * 60, 130, 0, Math.PI * 2);
      ctx.fill();
    }
    // Beach + sea, south.
    ctx.fillStyle = PALETTE.beach;
    ctx.fillRect(0, city.beach.y, WORLD.width, 160);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, city.sea.y, WORLD.width, WORLD.height - city.sea.y);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = 60; x < WORLD.width; x += 260) {
      ctx.beginPath();
      ctx.ellipse(x, city.sea.y + 60, 90, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Harbor, east.
    ctx.fillStyle = PALETTE.harbor;
    ctx.fillRect(city.harbor.x, city.harbor.y, city.harbor.w, city.harbor.h);
    ctx.fillStyle = '#3f6d8a';
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(city.harbor.x + 20, city.harbor.y + 60 + i * 300, 160, 40);
    }
    ctx.fillStyle = '#8a6f4d';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(city.harbor.x + 60, city.harbor.y + 220 + i * 320, 90, 60);
    }
    // Airstrip, north-east.
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(city.airstrip.x, city.airstrip.y, city.airstrip.w, city.airstrip.h);
    ctx.fillStyle = '#e8e8e8';
    for (let x = city.airstrip.x + 40; x < city.airstrip.x + city.airstrip.w - 20; x += 90) {
      ctx.fillRect(x, city.airstrip.y + 88, 44, 6);
    }
    ctx.fillStyle = '#c0392b';
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText('SOLARA AIRFIELD', city.airstrip.x + 180, city.airstrip.y + 150);
    // Parks and lots.
    for (const p of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#3c6b2f';
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(p.x + 30 + i * 60, p.y + 30 + (i % 2) * 50, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const l of city.lots) {
      ctx.fillStyle = '#55504a';
      ctx.fillRect(l.x, l.y, l.w, l.h);
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of city.roadsV) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of city.roadsH) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of city.roadsV) {
      for (let y = 40; y < WORLD.height; y += 64) ctx.fillRect(rx - 2, y, 4, 28);
    }
    for (const ry of city.roadsH) {
      for (let x = 40; x < WORLD.width; x += 64) ctx.fillRect(x, ry - 2, 28, 4);
    }
    // Buildings, with lit windows at night.
    for (const b of city.buildings) {
      ctx.fillStyle = b.tone === 0 ? PALETTE.building : b.tone === 1 ? PALETTE.building2 : PALETTE.building3;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
      if (timeOfDay !== 'day') {
        ctx.fillStyle = timeOfDay === 'night' ? '#ffd76a' : '#ffca7a';
        for (let wx = b.x + 10; wx < b.x + b.w - 12; wx += 26) {
          for (let wy = b.y + 10; wy < b.y + b.h - 12; wy += 26) {
            if ((wx + wy) % 52 === 0) ctx.fillRect(wx, wy, 10, 12);
          }
        }
      }
    }
    // Safehouse marker.
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(city.safehouse.x, city.safehouse.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d3b1e';
    ctx.font = 'bold 22px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('H', city.safehouse.x, city.safehouse.y + 8);
    // Ramps.
    for (const r of city.ramps) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.moveTo(-26, 12);
      ctx.lineTo(26, 12);
      ctx.lineTo(14, -14);
      ctx.lineTo(-14, -14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Sun coins.
    for (const c of city.coins) {
      if (c.taken) continue;
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pickups.
    for (const p of city.pickups) {
      if (p.taken) continue;
      ctx.fillStyle = p.kind === 'health' ? '#e5534b' : '#4fc3f7';
      ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px ' + FONT;
      ctx.fillText(p.kind === 'health' ? '+' : 'A', p.x, p.y + 6);
    }
  }

  function drawMinimap(state, camX, camY) {
    const mw = 210;
    const mh = 158;
    const mx = VIEW.width - mw - 16;
    const my = 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#10151d';
    ctx.beginPath();
    ctx.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 10);
    ctx.fill();
    ctx.strokeStyle = '#3a4556';
    ctx.stroke();
    ctx.fillStyle = '#2c4a63';
    ctx.fillRect(mx, my + mh * 0.88, mw, mh * 0.12);
    ctx.strokeStyle = '#5a6472';
    ctx.lineWidth = 1;
    for (const rx of state.city.roadsV) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + mh);
      ctx.stroke();
    }
    for (const ry of state.city.roadsH) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + mw, my + ry * sy);
      ctx.stroke();
    }
    // View window.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeRect(mx + camX * sx, my + camY * sy, VIEW.width * sx, VIEW.height * sy);
    // Mission blip.
    if (state.missionBlip) {
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(mx + state.missionBlip.x * sx, my + state.missionBlip.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police blips.
    ctx.fillStyle = '#4fc3f7';
    for (const cop of state.police.cars) {
      ctx.beginPath();
      ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    ctx.fillStyle = '#fff';
    ctx.save();
    ctx.translate(mx + state.player.x * sx, my + state.player.y * sy);
    ctx.rotate(state.player.angle);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawHUD(state) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    ctx.fillRect(14, 14, 300, 108);
    ctx.fillStyle = '#7ee787';
    ctx.fillText('$' + Math.round(state.cash), 28, 48);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px ' + FONT;
    ctx.fillText('HP ' + Math.round(state.player.health) + '  ARMOR ' + Math.round(state.player.armor), 28, 76);
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.police.wanted ? '#f2c94c' : 'rgba(255,255,255,0.25)';
      ctx.font = '24px ' + FONT;
      ctx.fillText('★', 28 + i * 26, 106);
    }
    // Speed + car health when driving.
    if (state.player.inCar && state.player.car) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px ' + FONT;
      ctx.fillText(Math.round(Math.abs(state.player.car.speed) * 0.12) + ' mph', 28, 142);
      ctx.font = '14px ' + FONT;
      ctx.fillText('CAR ' + Math.round(state.player.car.health) + '%', 130, 142);
    }
    // Objective banner.
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    const obj = state.objectiveText || '';
    ctx.font = '17px ' + FONT;
    const w = ctx.measureText(obj).width + 32;
    ctx.fillRect((VIEW.width - w) / 2, VIEW.height - 52, w, 34);
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'center';
    ctx.fillText(obj, VIEW.width / 2, VIEW.height - 29);
    // Mission + coins line.
    ctx.textAlign = 'left';
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    const mname = state.missionName || '';
    ctx.fillText(mname + '   ☀ ' + state.coinsCollected + '/12   Missions ' + state.missionsDone + '/5', 16, VIEW.height - 62);
    // Toast.
    if (state.toast && state.toastTimer > 0) {
      ctx.font = 'bold 20px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(state.toast, VIEW.width / 2, 120);
    }
    ctx.restore();
  }

  function drawScreens(state, screen) {
    ctx.save();
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(8,12,20,0.72)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f2c94c';
      ctx.font = 'bold 64px ' + FONT;
      ctx.fillText('SOLARA BAY', VIEW.width / 2, 220);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '28px ' + FONT;
      ctx.fillText('One Last Getaway', VIEW.width / 2, 266);
      ctx.font = '18px ' + FONT;
      ctx.fillStyle = '#cfc8b8';
      ctx.fillText('Mara "Rook" Voss is back for one last job. Steal a car, lose the heat,', VIEW.width / 2, 330);
      ctx.fillText('run five missions across the city — and fly out of Solara Bay.', VIEW.width / 2, 356);
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 22px ' + FONT;
      ctx.fillText('Press SPACE or click to start', VIEW.width / 2, 430);
      ctx.font = '16px ' + FONT;
      ctx.fillStyle = '#b9b2a4';
      ctx.fillText('WASD drive / walk · E steal car · SPACE shoot · SHIFT sprint · P pause · M mute', VIEW.width / 2, 480);
      ctx.fillText('T taxi fare · R repair at safehouse ($50) · U upgrade at safehouse', VIEW.width / 2, 506);
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,12,20,0.66)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 44px ' + FONT;
      ctx.fillText('PAUSED', VIEW.width / 2, 340);
      ctx.font = '18px ' + FONT;
      ctx.fillText('Press P or ESC to keep driving', VIEW.width / 2, 386);
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(40,6,6,0.72)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff8a7a';
      ctx.font = 'bold 52px ' + FONT;
      ctx.fillText('WASTED', VIEW.width / 2, 320);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '20px ' + FONT;
      ctx.fillText('Mara went down in Solara Bay. Cash kept: $' + Math.round(state.cash), VIEW.width / 2, 370);
      ctx.fillText('Press SPACE to try again', VIEW.width / 2, 420);
    } else if (screen === SCREEN_BUSTED) {
      ctx.fillStyle = 'rgba(6,10,40,0.72)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8ab8ff';
      ctx.font = 'bold 52px ' + FONT;
      ctx.fillText('BUSTED', VIEW.width / 2, 320);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '20px ' + FONT;
      ctx.fillText('The Solara Bay PD caught up with Rook.', VIEW.width / 2, 370);
      ctx.fillText('Press SPACE to try again', VIEW.width / 2, 420);
    } else if (screen === SCREEN_WIN) {
      ctx.fillStyle = 'rgba(8,20,12,0.72)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7ee787';
      ctx.font = 'bold 48px ' + FONT;
      ctx.fillText('ONE LAST GETAWAY', VIEW.width / 2, 300);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '20px ' + FONT;
      ctx.fillText('Mara flew out of Solara Bay with $' + Math.round(state.cash) + ' and the cargo.', VIEW.width / 2, 350);
      ctx.fillText('All 5 missions complete. Press SPACE to play again.', VIEW.width / 2, 384);
    }
    ctx.restore();
  }

  function draw(state, screen) {
    const sky = SKY[state.timeOfDay];
    const px = state.player.x;
    const py = state.player.y;
    const camX = Math.max(0, Math.min(WORLD.width - VIEW.width, px - VIEW.width / 2));
    const camY = Math.max(0, Math.min(WORLD.height - VIEW.height, py - VIEW.height / 2));
    ctx.save();
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    ctx.translate(-camX, -camY);
    drawMap(state);
    // Parked cars.
    for (const car of state.parked) {
      drawCar(ctx, car.x, car.y, car.angle, car.color);
    }
    // Traffic.
    for (const car of state.traffic) {
      drawCar(ctx, car.x, car.y, car.angle, car.color, { taxi: car.taxi });
      if (car.honk > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('!', car.x, car.y - 26);
      }
    }
    // Roadblocks.
    for (const rb of state.police.roadblocks) {
      drawCar(ctx, rb.x, rb.y, rb.angle, '#1f3a93', { police: true, sirenOn: true });
    }
    // Police cars.
    for (const cop of state.police.cars) {
      drawCar(ctx, cop.x, cop.y, cop.angle, '#1f3a93', { police: true, sirenOn: Math.sin(cop.siren) > 0 });
    }
    // Peds.
    for (const ped of state.peds) drawPed(ctx, ped);
    // Bullets.
    ctx.fillStyle = '#ffe9a8';
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player car or player on foot.
    if (state.player.inCar && state.player.car) {
      const car = state.player.car;
      drawCar(ctx, car.x, car.y, car.angle, car.color);
    } else {
      const p = state.player;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 3, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d94f3d';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(6, -3, 8, 6);
      ctx.restore();
      if (state.nearCar) {
        ctx.fillStyle = '#ffd76a';
        ctx.font = 'bold 16px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('Press E to steal', p.x, p.y - 26);
      }
    }
    // Helicopter + spotlight.
    if (state.police.heli) {
      const h = state.police.heli;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.fillStyle = 'rgba(255,255,220,0.10)';
      ctx.beginPath();
      ctx.arc(0, 0, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 12, h.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();
      ctx.restore();
    }
    // Mission blip beacon.
    if (state.missionBlip) {
      const b = state.missionBlip;
      const pulse = 18 + Math.sin(state.time * 4) * 5;
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Light tint + rain over everything.
    ctx.fillStyle = sky.tint;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (state.timeOfDay === 'dusk') {
      // Low sun, setting over the bay.
      ctx.fillStyle = 'rgba(255,154,60,0.85)';
      ctx.beginPath();
      ctx.arc(150, 110, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,154,60,0.25)';
      ctx.beginPath();
      ctx.arc(150, 110, 70, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.timeOfDay === 'night') {
      ctx.fillStyle = 'rgba(255,240,180,0.05)';
      ctx.beginPath();
      ctx.arc(1100, 90, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.rain) {
      ctx.strokeStyle = 'rgba(180,200,230,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 90; i += 1) {
        const rx = (i * 173 + state.time * 900) % VIEW.width;
        const ry = (i * 97 + state.time * 1400) % VIEW.height;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 6, ry + 16);
        ctx.stroke();
      }
    }
    drawHUD(state);
    drawMinimap(state, camX, camY);
    if (screen !== SCREEN_PLAY) drawScreens(state, screen);
  }

  return { draw };
}
