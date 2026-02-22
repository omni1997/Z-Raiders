const { randomUUID } = require('crypto');
const { clients, projectiles, zombies, scores } = require('./state');
const { distance, randomPosition, getTopPlayers, broadcast } = require('./utils');
const {
  PROJECTILE_SPEED,
  PROJECTILE_LIFETIME,
  PROJECTILE_RADIUS,
  PLAYER_RADIUS,
  ZOMBIE_RADIUS,
  ZOMBIE_SPEED,
  ZOMBIE_SPAWN_INTERVAL,
} = require('./config');

function startGameLoop() {
  // Spawn zombies
  setInterval(() => {
    const id = 'z-' + randomUUID();
    const pos = randomPosition();
    const zombie = { id, x: pos.x, y: pos.y, targetId: null };
    zombies.set(id, zombie);
    broadcast({ type: 'zombie_spawn', id: zombie.id, x: zombie.x, y: zombie.y });
    console.log(`Zombie spawned: ${id}`);
  }, ZOMBIE_SPAWN_INTERVAL * 1000);

  // Server tick (60 FPS)
  setInterval(() => {
    const now = Date.now();

    // --- Projectiles ---
    for (const [idProj, proj] of projectiles) {
      proj.x += Math.cos(proj.angle) * PROJECTILE_SPEED / 60;
      proj.y += Math.sin(proj.angle) * PROJECTILE_SPEED / 60;

      let collided = false;

      // Player collision
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

      // Zombie collision
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
      if (now - proj.createdAt > PROJECTILE_LIFETIME) {
        projectiles.delete(idProj);
      }
    }

    // --- Zombies ---
    for (const zombie of zombies.values()) {
      // Find closest player
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
        zombie.x += (dx / len) * (ZOMBIE_SPEED / 60);
        zombie.y += (dy / len) * (ZOMBIE_SPEED / 60);
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
          console.log(`${client.pseudo} was caught by zombie ${zombie.id}`);
        }
      }
    }
  }, 1000 / 60);
}

module.exports = { startGameLoop };