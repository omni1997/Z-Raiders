const { randomUUID } = require('crypto');
const { clients, projectiles, scores, walls, zombies } = require('./state');
const { randomPosition, broadcast, getTopPlayers } = require('./utils');
const { WEAPONS, MELEE, PLAYER_MAX_HP } = require('./config');
const log = require('./logger');

function handleMessage(ws, data) {
  const msg = JSON.parse(data);
  const client = clients.get(ws);
  if (!client) return;

  // ---------- Connexion ----------
  if (msg.type === 'pseudo') {
    client.pseudo     = msg.pseudo;
    client.hp         = PLAYER_MAX_HP;
    client.lastShotAt = 0;
    client.rangedWeapon = 'gun';
    client.meleeWeapon  = 'knife';
    client.activeSlot   = 'ranged';

    scores.set(client.id, { zombiesKilled: 0, playersKilled: 0 });

    ws.send(JSON.stringify({ type: 'confirm', pseudo: client.pseudo }));
    ws.send(JSON.stringify({ type: 'respawn', id: client.id, x: client.x, y: client.y }));
    ws.send(JSON.stringify({
      type: 'slots_update',
      rangedWeapon: client.rangedWeapon,
      meleeWeapon:  client.meleeWeapon,
      activeSlot:   client.activeSlot,
    }));
    ws.send(JSON.stringify({ type: 'hp_update', id: client.id, hp: client.hp, maxHp: PLAYER_MAX_HP }));

    for (const wall of walls.values()) {
      ws.send(JSON.stringify({ type: 'wall_spawn', id: wall.id, x: wall.x, y: wall.y }));
    }
    log.info(`Connected: ${client.pseudo} (${client.id})`);
  }

  // ---------- Chat ----------
  if (msg.type === 'chat' && client.pseudo) {
    broadcast({ type: 'chat', pseudo: client.pseudo, color: client.color, message: msg.message });
  }

  // ---------- Mouvement ----------
  if (msg.type === 'move' && client.pseudo) {
    client.x        = msg.x;
    client.y        = msg.y;
    client.aimAngle = msg.aimAngle ?? 0;
    broadcast({
      type: 'move',
      id: client.id, x: client.x, y: client.y,
      color: client.color, aimAngle: client.aimAngle,
      activeSlot: client.activeSlot,
    });
  }

  // ---------- Switch slot ----------
  if (msg.type === 'switch_slot' && client.pseudo) {
    client.activeSlot = client.activeSlot === 'ranged' ? 'melee' : 'ranged';
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
  }

  // ---------- Tir (arme à distance) ----------
  if (msg.type === 'shoot' && client.pseudo && client.activeSlot === 'ranged') {
    const weaponDef = WEAPONS[client.rangedWeapon] || WEAPONS['gun'];
    const now = Date.now();
    if (now - client.lastShotAt < weaponDef.fireRate) return;
    client.lastShotAt = now;

    for (let i = 0; i < weaponDef.bulletsPerShot; i++) {
      const spreadOffset = (Math.random() - 0.5) * 2 * weaponDef.spread;
      const finalAngle   = msg.angle + spreadOffset;
      const idProj       = 'p-' + randomUUID();

      const projectile = {
        id: idProj, from: client.id,
        x: msg.x, y: msg.y,
        angle: finalAngle,
        speed: weaponDef.projectileSpeed,
        lifetime: weaponDef.projectileLifetime,
        damage: weaponDef.damage,
        createdAt: now,
      };
      projectiles.set(idProj, projectile);
      broadcast({
        type: 'projectile',
        id: projectile.id, from: projectile.from,
        x: projectile.x, y: projectile.y,
        angle: finalAngle,
        speed: weaponDef.projectileSpeed,
        lifetime: weaponDef.projectileLifetime,
        weaponType: client.rangedWeapon,
      });
      setTimeout(() => projectiles.delete(idProj), weaponDef.projectileLifetime);
    }
  }

  // ---------- Coup de couteau ----------
  // Pas de vérification activeSlot côté serveur : on fait confiance au client
  // (le client n'envoie melee_hit que quand il est en slot melee)
  if (msg.type === 'melee_hit' && client.pseudo) {
    const meleeDef = MELEE['knife'];
    const now = Date.now();
    if (now - client.lastShotAt < meleeDef.fireRate) return;
    client.lastShotAt = now;

    const hitIds = Array.isArray(msg.hitIds) ? msg.hitIds : [];
    log.debug(`${client.pseudo} hits: [${hitIds.join(', ')}]`);

    for (const targetId of hitIds) {

      // --- Joueur touché ---
      const targetClient = [...clients.values()].find(c => c.id === targetId);
      if (targetClient && targetClient.pseudo) {
        targetClient.hp = (targetClient.hp ?? PLAYER_MAX_HP) - meleeDef.damage;
        broadcast({ type: 'hp_update', id: targetClient.id, hp: targetClient.hp, maxHp: PLAYER_MAX_HP });
        log.debug(`hit player ${targetClient.pseudo} → ${targetClient.hp} HP`);
        if (targetClient.hp <= 0) {
          const ks = scores.get(client.id) || { zombiesKilled: 0, playersKilled: 0 };
          ks.playersKilled += 1;
          scores.set(client.id, ks);
          broadcast({ type: 'score_update', playerId: client.id, ...ks, topPlayers: getTopPlayers() });
          const newPos = randomPosition();
          targetClient.x = newPos.x; targetClient.y = newPos.y; targetClient.hp = PLAYER_MAX_HP;
          broadcast({ type: 'respawn', id: targetClient.id, x: targetClient.x, y: targetClient.y });
          broadcast({ type: 'hp_update', id: targetClient.id, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP });
        }
        continue;
      }

      // --- Zombie touché ---
      if (zombies.has(targetId)) {
        zombies.delete(targetId);
        log.debug(`killed zombie ${targetId}`);
        const ks = scores.get(client.id) || { zombiesKilled: 0, playersKilled: 0 };
        ks.zombiesKilled += 1;
        scores.set(client.id, ks);
        broadcast({ type: 'score_update', playerId: client.id, ...ks, topPlayers: getTopPlayers() });
        broadcast({ type: 'zombie_remove', id: targetId });
      }
    }

    // Animation swing pour les autres joueurs
    broadcast({ type: 'melee_swing', from: client.id, x: msg.x, y: msg.y, angle: msg.angle });
  }
}

module.exports = { handleMessage };
