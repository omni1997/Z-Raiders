const clients = new Map();      // ws → { id, color, pseudo, x, y }
const projectiles = new Map();  // id → projectile
const zombies = new Map();      // id → zombie
const scores = new Map();       // playerId → { zombiesKilled, playersKilled }

module.exports = { clients, projectiles, zombies, scores };