// Combat: the pistol on foot, drive-by shots from the car, and police
// return fire. Bullets are plain data; collisions are circle tests
// against peds, cops, traffic and the player.

export function createBullets() {
  return [];
}

export function fireBullet(bullets, x, y, angle, speed, from, damage) {
  bullets.push({
    x: x + Math.cos(angle) * 22,
    y: y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.9,
    from, damage,
  });
}

// Step every bullet; returns hit events for the caller to score.
// onHit({ kind: 'ped'|'cop'|'traffic'|'player', target, damage })
export function updateBullets(bullets, state, dt, onHit) {
  const { city, peds, police, traffic, player } = state;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Buildings stop bullets.
      const probe = { x: b.x, y: b.y, radius: 4 };
      // Cheap building test: reuse the city's list directly.
      for (const bd of city.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from !== 'player') {
      const d = Math.hypot(player.x - b.x, player.y - b.y);
      if (d < 16) {
        dead = true;
        onHit({ kind: 'player', target: player, damage: b.damage });
      }
    }
    if (!dead && b.from === 'player') {
      for (const ped of peds) {
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          dead = true;
          onHit({ kind: 'ped', target: ped, damage: b.damage });
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const cop of police.cars) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 24) {
          dead = true;
          onHit({ kind: 'cop', target: cop, damage: b.damage });
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const car of traffic) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
          dead = true;
          onHit({ kind: 'traffic', target: car, damage: b.damage });
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

// Police at 3+ stars shoot at the player when close and roughly in front.
export function policeFire(police, player, bullets, dt) {
  if (police.wanted < 3) return;
  for (const cop of police.cars) {
    if (cop.shootTimer > 0) continue;
    const dist = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (dist > 420) continue;
    cop.shootTimer = 1.4;
    const angle = Math.atan2(player.y - cop.y, player.x - cop.x) + (Math.random() - 0.5) * 0.22;
    fireBullet(bullets, cop.x, cop.y, angle, 640, 'cop', 9);
  }
}
