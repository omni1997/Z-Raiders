const { randomUUID } = require('crypto');
const { clients, projectiles, scores, walls, zombies } = require('./state');
const { randomPosition, broadcast, getTopPlayers } = require('./utils');
const { WEAPONS, MELEE, PLAYER_MAX_HP, ZOMBIE_MAX_HP } = require('./config');
const { getScore, saveScore, getTopPlayers: getPersistedTopPlayers } = require('./scoreStore');
const { getAccount, pseudoTaken, createAccount, checkLogin, normalizeEmail } = require('./accountStore');
const { createToken } = require('./resetTokens');
const { sendPasswordResetEmail } = require('./mailer');
const log = require('./logger');

// Emplace the player in the world once their account is verified — used by
// both signup and login so they share the exact same join sequence.
function beginSession(client, ws, pseudo) {
  client.pseudo     = pseudo;
  client.hp         = PLAYER_MAX_HP;
  client.lastShotAt = 0;
  client.rangedWeapon = 'gun';
  client.meleeWeapon  = 'knife';
  client.activeSlot   = 'ranged';
  client.ammo         = WEAPONS[client.rangedWeapon].magazineSize;
  client.reloading    = false;

  // Reprend le score personnel persisté pour ce pseudo, s'il existe
  scores.set(client.id, getScore(client.pseudo));

  ws.send(JSON.stringify({ type: 'confirm', pseudo: client.pseudo }));
  ws.send(JSON.stringify({ type: 'score_update', playerId: client.id, ...scores.get(client.id), topPlayers: getTopPlayers() }));
  ws.send(JSON.stringify({ type: 'respawn', id: client.id, x: client.x, y: client.y }));
  ws.send(JSON.stringify({
    type: 'slots_update',
    rangedWeapon: client.rangedWeapon,
    meleeWeapon:  client.meleeWeapon,
    activeSlot:   client.activeSlot,
  }));
  ws.send(JSON.stringify({ type: 'hp_update', id: client.id, hp: client.hp, maxHp: PLAYER_MAX_HP }));
  ws.send(JSON.stringify({
    type: 'ammo_update', ammo: client.ammo, magazineSize: WEAPONS[client.rangedWeapon].magazineSize, reloading: false,
  }));

  for (const wall of walls.values()) {
    ws.send(JSON.stringify({ type: 'wall_spawn', id: wall.id, x: wall.x, y: wall.y }));
  }
  log.info(`Connected: ${client.pseudo} (${client.id})`);
}

// Unlimited magazines, limited bullets per magazine: refills client.ammo to
// the current weapon's magazineSize after reloadTime. Guards against the
// client switching weapons or disconnecting mid-reload.
function startReload(client, ws) {
  const weaponName = client.rangedWeapon;
  const weaponDef  = WEAPONS[weaponName] || WEAPONS['gun'];

  client.reloading = true;
  ws.send(JSON.stringify({
    type: 'ammo_update', ammo: client.ammo ?? 0, magazineSize: weaponDef.magazineSize, reloading: true,
  }));

  setTimeout(() => {
    if (!clients.has(ws) || client.rangedWeapon !== weaponName) return;
    client.reloading = false;
    client.ammo = weaponDef.magazineSize;
    ws.send(JSON.stringify({
      type: 'ammo_update', ammo: client.ammo, magazineSize: weaponDef.magazineSize, reloading: false,
    }));
  }, weaponDef.reloadTime);
}

function handleMessage(ws, data) {
  const msg = JSON.parse(data);
  const client = clients.get(ws);
  if (!client) return;

  // ---------- Création de compte ----------
  if (msg.type === 'signup') {
    const email    = normalizeEmail(msg.email);
    const password = msg.password || '';
    const pseudo   = (msg.pseudo || '').trim();

    if (!email.includes('@')) return ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid email.' }));
    if (password.length < 6) return ws.send(JSON.stringify({ type: 'auth_error', message: 'Password must be at least 6 characters.' }));
    if (!pseudo) return ws.send(JSON.stringify({ type: 'auth_error', message: 'Callsign required.' }));
    if (getAccount(email)) return ws.send(JSON.stringify({ type: 'auth_error', message: 'An account already exists for this email.' }));
    if (pseudoTaken(pseudo)) return ws.send(JSON.stringify({ type: 'auth_error', message: 'Callsign already taken.' }));

    createAccount(email, password, pseudo);
    beginSession(client, ws, pseudo);
  }

  // ---------- Connexion à un compte existant ----------
  if (msg.type === 'login') {
    const email    = normalizeEmail(msg.email);
    const password = msg.password || '';

    const account = checkLogin(email, password);
    if (!account) return ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid email or password.' }));

    beginSession(client, ws, account.pseudo);
  }

  // ---------- Mot de passe oublié ----------
  if (msg.type === 'forgot_password') {
    const email = normalizeEmail(msg.email);
    const account = getAccount(email);
    if (account) {
      const token = createToken(email);
      const resetUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/reset.html?token=${token}`;
      sendPasswordResetEmail(email, resetUrl).catch((err) => log.error(`Failed to send reset email: ${err.message}`));
    }
    // Réponse identique que le compte existe ou non, pour ne pas révéler les emails inscrits
    ws.send(JSON.stringify({ type: 'forgot_password_sent' }));
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

  // ---------- Rechargement manuel (arme à distance) ----------
  if (msg.type === 'reload' && client.pseudo && client.activeSlot === 'ranged') {
    const weaponDef = WEAPONS[client.rangedWeapon] || WEAPONS['gun'];
    if (client.reloading) return;
    if ((client.ammo ?? weaponDef.magazineSize) >= weaponDef.magazineSize) return;
    startReload(client, ws);
  }

  // ---------- Tir (arme à distance) ----------
  if (msg.type === 'shoot' && client.pseudo && client.activeSlot === 'ranged') {
    const weaponDef = WEAPONS[client.rangedWeapon] || WEAPONS['gun'];

    if (client.reloading) return;
    if ((client.ammo ?? weaponDef.magazineSize) <= 0) {
      startReload(client, ws);
      return;
    }

    const now = Date.now();
    if (now - client.lastShotAt < weaponDef.fireRate) return;
    client.lastShotAt = now;
    client.ammo -= 1;

    ws.send(JSON.stringify({
      type: 'ammo_update', ammo: client.ammo, magazineSize: weaponDef.magazineSize, reloading: false,
    }));

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
          saveScore(client.pseudo, ks);
          broadcast({ type: 'login_top_players', topPlayers: getPersistedTopPlayers() });
          const newPos = randomPosition();
          targetClient.x = newPos.x; targetClient.y = newPos.y; targetClient.hp = PLAYER_MAX_HP;
          broadcast({ type: 'respawn', id: targetClient.id, x: targetClient.x, y: targetClient.y });
          broadcast({ type: 'hp_update', id: targetClient.id, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP });
        }
        continue;
      }

      // --- Zombie touché ---
      const targetZombie = zombies.get(targetId);
      if (targetZombie) {
        targetZombie.hp = (targetZombie.hp ?? ZOMBIE_MAX_HP) - meleeDef.damage;
        broadcast({ type: 'zombie_hp_update', id: targetId, hp: targetZombie.hp, maxHp: targetZombie.maxHp });
        if (targetZombie.hp <= 0) {
          zombies.delete(targetId);
          log.debug(`killed zombie ${targetId}`);
          const ks = scores.get(client.id) || { zombiesKilled: 0, playersKilled: 0 };
          ks.zombiesKilled += 1;
          scores.set(client.id, ks);
          broadcast({ type: 'score_update', playerId: client.id, ...ks, topPlayers: getTopPlayers() });
          saveScore(client.pseudo, ks);
          broadcast({ type: 'login_top_players', topPlayers: getPersistedTopPlayers() });
          broadcast({ type: 'zombie_remove', id: targetId });
        }
      }
    }

    // Animation swing pour les autres joueurs
    broadcast({ type: 'melee_swing', from: client.id, x: msg.x, y: msg.y, angle: msg.angle });
  }
}

module.exports = { handleMessage };
