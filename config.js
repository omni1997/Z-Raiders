module.exports = {
  MAP_WIDTH: 2000,
  MAP_HEIGHT: 2000,
  PLAYER_RADIUS: 20,
  PROJECTILE_RADIUS: 4,
  ZOMBIE_SPEED: 80,
  ZOMBIE_SPAWN_INTERVAL: 5,
  ZOMBIE_RADIUS: 18,
  ZOMBIE_DAMAGE: 34,         // dégâts par contact (cooldown 1s)

  PLAYER_MAX_HP: 100,

  WEAPON_SPAWN_INTERVAL: 8,
  MAX_WEAPONS_ON_MAP: 12,

  // Armes à distance ramassables sur la map
  WEAPONS: {
    gun: {
      name: 'gun',
      type: 'ranged',
      damage: 30,
      fireRate: 400,
      projectileSpeed: 800,
      projectileLifetime: 1500,
      spread: 0.05,
      bulletsPerShot: 1,
    },
    rifle: {
      name: 'rifle',
      type: 'ranged',
      damage: 20,
      fireRate: 150,
      projectileSpeed: 1200,
      projectileLifetime: 2200,
      spread: 0.02,
      bulletsPerShot: 1,
    },
    shotgun: {
      name: 'shotgun',
      type: 'ranged',
      damage: 50,
      fireRate: 900,
      projectileSpeed: 650,
      projectileLifetime: 700,
      spread: 0.15,
      bulletsPerShot: 6,
    },
    sniper: {
      name: 'sniper',
      type: 'ranged',
      damage: 100,
      fireRate: 1200,
      projectileSpeed: 2200,
      projectileLifetime: 3000,
      spread: 0,
      bulletsPerShot: 1,
    },
  },

  // Arme mêlée permanente (slot 2)
  MELEE: {
    knife: {
      name: 'knife',
      type: 'melee',
      damage: 45,
      fireRate: 600,       
      range: 65,           // Not used, client send who is hit. Need to be update. 
    },
  },
};
