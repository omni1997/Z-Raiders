const clients = new Map();      // ws → { id, color, pseudo, x, y, weapon, lastShotAt }
const projectiles = new Map();  // id → projectile
const zombies = new Map();      // id → zombie
const weaponsOnMap = new Map(); // id → { id, x, y, type }
const scores = new Map();       // playerId → { zombiesKilled, playersKilled }
const walls = new Map(); // id → { id, x, y }
const globalStats = { zombiesKilled: 0, playersKilled: 0 }; // all-time totals, shown on the login screen

module.exports = { clients, projectiles, zombies, weaponsOnMap, scores, walls, globalStats };