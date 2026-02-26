module.exports = {
  MAP_WIDTH: 2000,
  MAP_HEIGHT: 2000,
  PLAYER_RADIUS: 20,
  PROJECTILE_RADIUS: 4,
  ZOMBIE_SPEED: 80,
  ZOMBIE_SPAWN_INTERVAL: 5,
  ZOMBIE_RADIUS: 18,

  WEAPON_SPAWN_INTERVAL: 8,   // seconde
  MAX_WEAPONS_ON_MAP: 12,

  WEAPONS: {
    gun: {
      name: 'gun',
      fireRate: 400,          // ms
      projectileSpeed: 800,
      projectileLifetime: 1500,
      spread: 0.05,           // radians
      bulletsPerShot: 1,
    },
    rifle: {
      name: 'rifle',
      fireRate: 150,
      projectileSpeed: 1200,
      projectileLifetime: 2200,
      spread: 0.02,
      bulletsPerShot: 1,
    },
    shotgun: {
      name: 'shotgun',
      fireRate: 900,
      projectileSpeed: 650,
      projectileLifetime: 700,
      spread: 0.15,
      bulletsPerShot: 6,
    },
    sniper: {
      name: 'sniper',
      fireRate: 1200,
      projectileSpeed: 2200,
      projectileLifetime: 3000,
      spread: 0,
      bulletsPerShot: 1,
    },
  },
};