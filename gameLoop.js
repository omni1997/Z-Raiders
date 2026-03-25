const { randomUUID } = require('crypto');
const { clients, projectiles, zombies, weaponsOnMap, scores, walls } = require('./state');
const { distance, randomPosition, getTopPlayers, broadcast } = require('./utils');
const log = require('./logger');
const {
  PROJECTILE_RADIUS,
  PLAYER_RADIUS,
  ZOMBIE_RADIUS,
  ZOMBIE_SPEED,
  ZOMBIE_SPAWN_INTERVAL,
  ZOMBIE_DAMAGE,
  WEAPON_SPAWN_INTERVAL,
  MAX_WEAPONS_ON_MAP,
  PLAYER_MAX_HP,
  WEAPONS,
} = require('./config');
const { generateBuildings } = require('./buildingLoader');

const WALL_SIZE = 64;
const WEAPON_TYPES = Object.keys(WEAPONS);
const WEAPON_PICKUP_RADIUS = 25;

// Dimensions du monde — à ajuster selon votre config
const WORLD_W = 2000;
const WORLD_H = 2000;

function wallCollision(obj, wall) {
  return (
    obj.x > wall.x - WALL_SIZE / 2 &&
    obj.x < wall.x + WALL_SIZE / 2 &&
    obj.y > wall.y - WALL_SIZE / 2 &&
    obj.y < wall.y + WALL_SIZE / 2
  );
}

function respawnClient(client) {
  const newPos = randomPosition();
  client.x  = newPos.x;
  client.y  = newPos.y;
  client.hp = PLAYER_MAX_HP;
  broadcast({ type: 'respawn', id: client.id, x: client.x, y: client.y });
  broadcast({ type: 'hp_update', id: client.id, hp: client.hp, maxHp: PLAYER_MAX_HP });
}

function startGameLoop() {

  // --- Génération des bâtiments ---
  const buildingWalls = generateBuildings(WORLD_W, WORLD_H, 3);
  for (const wall of buildingWalls) {
    walls.set(wall.id, wall);
  }
  // Envoyer tous les murs aux clients connectés (si nécessaire au moment du join,
  // pensez aussi à les envoyer dans votre handler 'join' via ws.send)
  broadcast({ type: 'walls_init', walls: buildingWalls });

  // Spawn zombies
  setInterval(() => {
    const id     = 'z-' + randomUUID();
    const pos    = randomPosition();
    const zombie = { id, x: pos.x, y: pos.y, targetId: null };
    zombies.set(id, zombie);
    broadcast({ type: 'zombie_spawn', id: zombie.id, x: zombie.x, y: zombie.y });
  }, ZOMBIE_SPAWN_INTERVAL * 1000);

  // Spawn armes au sol
  setInterval(() => {
    if (weaponsOnMap.size >= MAX_WEAPONS_ON_MAP) return;
    const id     = 'w-' + randomUUID();
    const pos    = randomPosition();
    const type   = WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)];
    const weapon = { id, x: pos.x, y: pos.y, type };
    weaponsOnMap.set(id, weapon);
    broadcast({ type: 'weapon_spawn', id, x: weapon.x, y: weapon.y, weaponType: type });
  }, WEAPON_SPAWN_INTERVAL * 1000);

  setInterval(() => {
    const now = Date.now();

    // --- Projectiles ---
    for (const [idProj, proj] of projectiles) {
      const speed = proj.speed || 800;
      proj.x += Math.cos(proj.angle) * speed / 60;
      proj.y += Math.sin(proj.angle) * speed / 60;

      let collided = false;

      for (const wall of walls.values()) {
        if (wallCollision(proj, wall)) { collided = true; break; }
      }
      if (collided) { projectiles.delete(idProj); continue; }

      for (const client of clients.values()) {
        if (client.id === proj.from || !client.pseudo) continue;
        if (distance(proj, client) < PLAYER_RADIUS + PROJECTILE_RADIUS) {
          client.hp = (client.hp ?? PLAYER_MAX_HP) - (proj.damage || 30);
          broadcast({ type: 'hp_update', id: client.id, hp: client.hp, maxHp: PLAYER_MAX_HP });
          if (client.hp <= 0) {
            const ks = scores.get(proj.from) || { zombiesKilled: 0, playersKilled: 0 };
            ks.playersKilled += 1;
            scores.set(proj.from, ks);
            broadcast({ type: 'score_update', playerId: proj.from, ...ks, topPlayers: getTopPlayers() });
            respawnClient(client);
          }
          collided = true; break;
        }
      }
      if (collided) { projectiles.delete(idProj); continue; }

      for (const [zId, zombie] of zombies) {
        if (distance(proj, zombie) < ZOMBIE_RADIUS + PROJECTILE_RADIUS) {
          zombies.delete(zId);
          const ks = scores.get(proj.from) || { zombiesKilled: 0, playersKilled: 0 };
          ks.zombiesKilled += 1;
          scores.set(proj.from, ks);
          broadcast({ type: 'score_update', playerId: proj.from, ...ks, topPlayers: getTopPlayers() });
          broadcast({ type: 'zombie_remove', id: zId });
          collided = true; break;
        }
      }
      if (collided) { projectiles.delete(idProj); continue; }

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

      const dx  = target.x - zombie.x;
      const dy  = target.y - zombie.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 0) {
        const nextX = zombie.x + (dx / len) * (ZOMBIE_SPEED / 60);
        const nextY = zombie.y + (dy / len) * (ZOMBIE_SPEED / 60);
        let blockedX = false, blockedY = false;
        for (const wall of walls.values()) {
          if (wallCollision({ x: nextX, y: zombie.y }, wall)) blockedX = true;
          if (wallCollision({ x: zombie.x, y: nextY }, wall)) blockedY = true;
        }
        if (!blockedX) zombie.x = nextX;
        if (!blockedY) zombie.y = nextY;
      }

      broadcast({ type: 'zombie_move', id: zombie.id, x: zombie.x, y: zombie.y });

      // Contact zombie → joueur : dégâts/s
      for (const client of clients.values()) {
        if (!client.pseudo) continue;
        if (distance(zombie, client) < PLAYER_RADIUS + ZOMBIE_RADIUS) {
          const now2 = Date.now();
          if (!client.lastZombieDmg || now2 - client.lastZombieDmg > 1000) {
            client.lastZombieDmg = now2;
            client.hp = (client.hp ?? PLAYER_MAX_HP) - ZOMBIE_DAMAGE;
            broadcast({ type: 'hp_update', id: client.id, hp: client.hp, maxHp: PLAYER_MAX_HP });
            if (client.hp <= 0) respawnClient(client);
          }
        }
      }
    }

    // --- Pickup armes (slot ranged uniquement) ---
    for (const [wId, weapon] of weaponsOnMap) {
      for (const [ws, client] of clients) {
        if (!client.pseudo) continue;
        if (distance(weapon, client) < WEAPON_PICKUP_RADIUS) {
          client.rangedWeapon = weapon.type;
          client.lastShotAt   = 0;
          weaponsOnMap.delete(wId);
          broadcast({ type: 'weapon_remove', id: wId });

          ws.send(JSON.stringify({
            type: 'slots_update',
            rangedWeapon: client.rangedWeapon,
            meleeWeapon:  client.meleeWeapon,
            activeSlot:   client.activeSlot,
          }));
          broadcast({
            type: 'player_slot',
            playerId:     client.id,
            activeSlot:   client.activeSlot,
            rangedWeapon: client.rangedWeapon,
          });
          log.debug(`${client.pseudo} picked up ${weapon.type}`);
          break;
        }
      }
    }

  }, 1000 / 60);
}

module.exports = { startGameLoop };
