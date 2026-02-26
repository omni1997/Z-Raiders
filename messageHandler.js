const { randomUUID } = require('crypto');
const { clients, projectiles, scores } = require('./state');
const { randomPosition, broadcast } = require('./utils');
const { WEAPONS } = require('./config');

function handleMessage(ws, data) {
  const msg = JSON.parse(data);
  const client = clients.get(ws);
  if (!client) return;

  // Pseudo registration
  if (msg.type === 'pseudo') {
    client.pseudo = msg.pseudo;
    client.weapon = 'gun';       // arme par défaut
    client.lastShotAt = 0;
    scores.set(client.id, { zombiesKilled: 0, playersKilled: 0 });
    ws.send(JSON.stringify({ type: 'confirm', pseudo: client.pseudo }));
    ws.send(JSON.stringify({ type: 'respawn', id: client.id, x: client.x, y: client.y }));
    // Informer le client de son arme de départ
    ws.send(JSON.stringify({ type: 'weapon_equipped', weaponType: client.weapon }));
    console.log(`Connected: ${client.pseudo} (${client.id})`);
  }

  // Chat
  if (msg.type === 'chat' && client.pseudo) {
    broadcast({ type: 'chat', pseudo: client.pseudo, color: client.color, message: msg.message });
  }

  // Movement
  if (msg.type === 'move' && client.pseudo) {
    client.x = msg.x;
    client.y = msg.y;
    // On transmet aussi l'angle du viseur pour afficher l'arme orientée
    client.aimAngle = msg.aimAngle ?? 0;
    broadcast({ type: 'move', id: client.id, x: client.x, y: client.y, color: client.color, aimAngle: client.aimAngle });
  }

  // Shooting
  if (msg.type === 'shoot' && client.pseudo) {
    const weaponDef = WEAPONS[client.weapon] || WEAPONS['gun'];
    const now = Date.now();

    if (now - client.lastShotAt < weaponDef.fireRate) return;
    client.lastShotAt = now;

    for (let i = 0; i < weaponDef.bulletsPerShot; i++) {
      const spreadOffset = (Math.random() - 0.5) * 2 * weaponDef.spread;
      const finalAngle = msg.angle + spreadOffset;

      const idProj = 'p-' + randomUUID();
      const projectile = {
        id: idProj,
        from: client.id,
        x: msg.x,
        y: msg.y,
        angle: finalAngle,
        speed: weaponDef.projectileSpeed,
        lifetime: weaponDef.projectileLifetime,
        createdAt: now,
      };
      projectiles.set(idProj, projectile);
      broadcast({
        type: 'projectile',
        id: projectile.id,
        from: projectile.from,
        x: projectile.x,
        y: projectile.y,
        angle: finalAngle,
        speed: weaponDef.projectileSpeed,
        lifetime: weaponDef.projectileLifetime,
        weaponType: client.weapon,
      });
      setTimeout(() => projectiles.delete(idProj), weaponDef.projectileLifetime);
    }
  }
}

module.exports = { handleMessage };