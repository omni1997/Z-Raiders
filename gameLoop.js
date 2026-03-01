const { randomUUID } = require('crypto');
const { clients, projectiles, zombies, weaponsOnMap, scores, walls } = require('./state');
const { distance, randomPosition, getTopPlayers, broadcast } = require('./utils');
const {
  PROJECTILE_RADIUS,
  PLAYER_RADIUS,
  ZOMBIE_RADIUS,
  ZOMBIE_SPEED,
  ZOMBIE_SPAWN_INTERVAL,
  WEAPON_SPAWN_INTERVAL,
  MAX_WEAPONS_ON_MAP,
  WEAPONS,
} = require('./config');

const WALL_SIZE = 32;
const WEAPON_TYPES = Object.keys(WEAPONS);
const WEAPON_PICKUP_RADIUS = 25;

function wallCollision(obj, wall) {
  return (
    obj.x > wall.x - WALL_SIZE / 2 &&
    obj.x < wall.x + WALL_SIZE / 2 &&
    obj.y > wall.y - WALL_SIZE / 2 &&
    obj.y < wall.y + WALL_SIZE / 2
  );
}

function startGameLoop() {

  // Spawn walls
  for (let i = 0; i < 5; i++) {
    const id = 'wall-' + i;
    const pos = randomPosition();
    walls.set(id, { id, x: pos.x, y: pos.y });
  }

  // Spawn zombies
  setInterval(() => {
    const id = 'z-' + randomUUID();
    const pos = randomPosition();
    const zombie = { id, x: pos.x, y: pos.y, targetId: null };
    zombies.set(id, zombie);
    broadcast({ type: 'zombie_spawn', id: zombie.id, x: zombie.x, y: zombie.y });
  }, ZOMBIE_SPAWN_INTERVAL * 1000);

  // Spawn weapons
  setInterval(() => {
    if (weaponsOnMap.size >= MAX_WEAPONS_ON_MAP) return;
    const id = 'w-' + randomUUID();
    const pos = randomPosition();
    const type = WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)];
    const weapon = { id, x: pos.x, y: pos.y, type };
    weaponsOnMap.set(id, weapon);
    broadcast({ type: 'weapon_spawn', id, x: weapon.x, y: weapon.y, weaponType: type });
    console.log(`Weapon spawned: ${type} at (${weapon.x}, ${weapon.y})`);
  }, WEAPON_SPAWN_INTERVAL * 1000);

  setInterval(() => {
    const now = Date.now();

    // --- Projectiles ---
    for (const [idProj, proj] of projectiles) {
      const speed = proj.speed || 800;
      proj.x += Math.cos(proj.angle) * speed / 60;
      proj.y += Math.sin(proj.angle) * speed / 60;

      let collided = false;

      // Collide wall
      for (const wall of walls.values()) {
        if (wallCollision(proj, wall)) {
          collided = true;
          break;
        }
      }
      if (collided) { projectiles.delete(idProj); continue; }

      // Collide player
      for (const client of clients.values()) {
        if (client.id === proj.from || !client.pseudo) continue;
        if (distance(proj, client) < PLAYER_RADIUS + PROJECTILE_RADIUS) {
          const killerScore = scores.get(proj.from) || { zombiesKilled: 0, playersKilled: 0 };
          killerScore.playersKilled += 1;
          scores.set(proj.from, killerScore);
          const newPos = randomPosition();
          client.x = newPos.x;
          client.y = newPos.y;
          broadcast({ type: 'score_update', playerId: proj.from, ...killerScore, topPlayers: getTopPlayers() });
          broadcast({ type: 'respawn', id: client.id, x: client.x, y: client.y });
          collided = true;
          break;
        }
      }
      if (collided) { projectiles.delete(idProj); continue; }

      // Collide zombie
      for (const [zId, zombie] of zombies) {
        if (distance(proj, zombie) < ZOMBIE_RADIUS + PROJECTILE_RADIUS) {
          zombies.delete(zId);
          const killerScore = scores.get(proj.from) || { zombiesKilled: 0, playersKilled: 0 };
          killerScore.zombiesKilled += 1;
          scores.set(proj.from, killerScore);
          broadcast({ type: 'score_update', playerId: proj.from, ...killerScore, topPlayers: getTopPlayers() });
          broadcast({ type: 'zombie_remove', id: zId });
          collided = true;
          break;
        }
      }
      if (collided) { projectiles.delete(idProj); continue; }

      // Lifetime expiration
      if (now - proj.createdAt > (proj.lifetime || 1500)) {
        projectiles.delete(idProj);
      }
    }

    // --- Zombies ---
    for (const zombie of zombies.values()) {
      if (!zombie.targetId || ![...clients.values()].find(c => c.id === zombie.targetId)) {
        let closest = null, minDist = Infinity;
        for (const client of clients.values()) {
          if (!client.pseudo) continue;
          const d = distance(zombie, client);
          if (d < minDist) { minDist = d; closest = client.id; }
        }
        zombie.targetId = closest;
      }

      const target = [...clients.values()].find(c => c.id === zombie.targetId);
      if (!target) continue;

      const dx = target.x - zombie.x;
      const dy = target.y - zombie.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 0) {
        const nextX = zombie.x + (dx / len) * (ZOMBIE_SPEED / 60);
        const nextY = zombie.y + (dy / len) * (ZOMBIE_SPEED / 60);

        let blockedX = false;
        let blockedY = false;

        for (const wall of walls.values()) {
          if (wallCollision({ x: nextX, y: zombie.y }, wall)) blockedX = true;
          if (wallCollision({ x: zombie.x, y: nextY }, wall)) blockedY = true;
        }

        if (!blockedX) zombie.x = nextX;
        if (!blockedY) zombie.y = nextY;
      }

      broadcast({ type: 'zombie_move', id: zombie.id, x: zombie.x, y: zombie.y });

      // Collision with player
      for (const client of clients.values()) {
        if (!client.pseudo) continue;
        if (distance(zombie, client) < PLAYER_RADIUS + ZOMBIE_RADIUS) {
          const newPos = randomPosition();
          client.x = newPos.x;
          client.y = newPos.y;
          broadcast({ type: 'respawn', id: client.id, x: client.x, y: client.y });
        }
      }
    }

    // --- Pickup armes ---
    for (const [wId, weapon] of weaponsOnMap) {
      for (const [ws, client] of clients) {
        if (!client.pseudo) continue;
        if (distance(weapon, client) < WEAPON_PICKUP_RADIUS) {
          const oldWeapon = client.weapon;
          client.weapon = weapon.type;
          client.lastShotAt = 0;
          weaponsOnMap.delete(wId);
          broadcast({ type: 'weapon_remove', id: wId });
          ws.send(JSON.stringify({
            type: 'weapon_equipped',
            weaponType: client.weapon,
            previousWeapon: oldWeapon,
          }));
          broadcast({
            type: 'player_weapon',
            playerId: client.id,
            weaponType: client.weapon,
          });
          console.log(`${client.pseudo} picked up ${weapon.type}`);
          break;
        }
      }
    }

  }, 1000 / 60);
}

module.exports = { startGameLoop };