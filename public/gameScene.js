import { socket } from './socket.js';
import * as state from './state.js';
import {
  players, zombies, weaponsOnMap,
  pseudo, id, MAP_WIDTH, MAP_HEIGHT,
  setGameScene,
} from './state.js';

const WEAPON_OFFSET_X = 18;
const WEAPON_OFFSET_Y = 5;
const KNIFE_RANGE     = 50;
const PLAYER_MAX_HP   = 100;
const BAR_WIDTH       = 40;
const BAR_HEIGHT      = 5;
const BAR_OFFSET_Y    = 28;

const LASER_CONFIG = {
  gun:     { length: 150, color: 0xff4444, alpha: 0.55, width: 1.5 },
  rifle:   { length: 280, color: 0xffff00, alpha: 0.65, width: 1.2 },
  shotgun: { length:  90, color: 0xff8800, alpha: 0.50, width: 2.5 },
  sniper:  { length: 600, color: 0x00ffff, alpha: 0.80, width: 1.0 },
  knife:   { length:  50, color: 0xffffff, alpha: 0.30, width: 1.0 },
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
    setGameScene(this);
    this.aimAngle = 0;
  }

  preload() {
    this.load.image('map',     'assets/map.png');
    this.load.image('sight',   'assets/sight.png');
    this.load.image('gun',     'assets/guns/gun.png');
    this.load.image('rifle',   'assets/guns/rifle.png');
    this.load.image('shotgun', 'assets/guns/shotgun.png');
    this.load.image('sniper',  'assets/guns/sniper.png');
    this.load.image('knife',   'assets/guns/knife.png');
    this.load.image('wall1',   'assets/building/wall1.png');
  }

  spawnWall(wallId, x, y) {
    const sprite = this.physics.add.staticImage(x, y, 'wall1')
      .setDisplaySize(32, 32).setDepth(3);
    sprite.refreshBody();
    this.wallGroup.add(sprite);
    this.walls = this.walls || {};
    this.walls[wallId] = sprite;
    for (const entry of Object.values(players)) {
      if (entry?.sprite) this.physics.add.collider(entry.sprite, this.wallGroup);
    }
  }

  create() {
    this.add.image(0, 0, 'map').setOrigin(0).setDepth(-1).setDisplaySize(MAP_WIDTH, MAP_HEIGHT);
    this.wallGroup = this.physics.add.staticGroup();
    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cursors     = this.input.keyboard.createCursorKeys();
    this.projectiles = this.add.group();

    this.laserGraphics = this.add.graphics().setDepth(6);
    this.hpGraphics    = this.add.graphics().setDepth(8);
    this.swingGraphics = this.add.graphics().setDepth(7);

    this.sight = this.add.image(0, 0, 'sight').setDepth(10).setScale(0.5);
    this.input.setDefaultCursor('none');

    // Molette → switch slot
    this.input.on('wheel', () => {
      if (!pseudo) return;
      socket.send(JSON.stringify({ type: 'switch_slot' }));
    });

    this.input.on('pointermove', pointer => {
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.sight.setPosition(wp.x, wp.y);
      if (this.player) {
        this.aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, wp.x, wp.y);
        this._updateLocalWeaponSprite();
      }
    });

    this.input.on('pointerdown', this._onPointerDown, this);
  }

  _onPointerDown(pointer) {
    if (!pointer.leftButtonDown() || !this.player) return;

    // Lire activeSlot DEPUIS state directement (pas depuis l'import primitif)
    if (state.activeSlot === 'ranged') {
      socket.send(JSON.stringify({
        type: 'shoot', x: this.player.x, y: this.player.y, angle: this.aimAngle,
      }));
    } else {
      this._doMeleeAttack();
    }
  }

  _doMeleeAttack() {
    const hitIds = [];

    // Détecter joueurs dans la portée
    for (const [pid, entry] of Object.entries(players)) {
      if (pid === id || !entry?.sprite) continue;
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        entry.sprite.x, entry.sprite.y
      );
      if (d <= KNIFE_RANGE) hitIds.push(pid);
    }

    // Détecter zombies dans la portée
    // Les zombies sont des sprites Phaser — on lit .x .y directement sur le sprite
    for (const [zid, zombieSprite] of Object.entries(zombies)) {
      if (!zombieSprite) continue;
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        zombieSprite.x, zombieSprite.y
      );
      if (d <= KNIFE_RANGE) {
        hitIds.push(zid);
      }
    }

    console.debug('[melee] hitIds:', hitIds, '| activeSlot:', state.activeSlot);

    socket.send(JSON.stringify({
      type: 'melee_hit',
      x: this.player.x,
      y: this.player.y,
      angle: this.aimAngle,
      hitIds,
    }));

    // Animation swing locale
    this._drawSwingArc(this.player.x, this.player.y, this.aimAngle, 180);
  }

  _drawSwingArc(x, y, angle, durationMs) {
    this.swingGraphics.clear();
    const ARC = Math.PI / 2.5;
    this.swingGraphics.lineStyle(3, 0xffffff, 0.75);
    this.swingGraphics.beginPath();
    this.swingGraphics.arc(x, y, KNIFE_RANGE, angle - ARC / 2, angle + ARC / 2, false);
    this.swingGraphics.strokePath();
    this.time.delayedCall(durationMs, () => this.swingGraphics.clear());
  }

  playMeleeSwing(fromId, x, y, angle) {
    if (fromId === id) return;
    this._drawSwingArc(x, y, angle, 180);
  }

  _updateLocalWeaponSprite() {
    const entry = players[id];
    if (!entry?.weaponSprite) return;
    this._positionWeaponSprite(entry.sprite, entry.weaponSprite, this.aimAngle);
  }

  _positionWeaponSprite(playerSprite, weaponSprite, angle) {
    const ox = Math.cos(angle) * WEAPON_OFFSET_X - Math.sin(angle) * WEAPON_OFFSET_Y;
    const oy = Math.sin(angle) * WEAPON_OFFSET_X + Math.cos(angle) * WEAPON_OFFSET_Y;
    weaponSprite.setPosition(playerSprite.x + ox, playerSprite.y + oy);
    weaponSprite.setRotation(angle + Math.PI / 2);
  }

  _drawLaser() {
    this.laserGraphics.clear();
    const entry = players[id];
    if (!entry?.weaponSprite || !this.player) return;

    // Lire activeSlot depuis state directement
    const currentWeaponKey = state.activeSlot === 'melee' ? 'knife' : (entry.weaponType || 'gun');
    const cfg = LASER_CONFIG[currentWeaponKey] || LASER_CONFIG.gun;

    const ox = Math.cos(this.aimAngle) * WEAPON_OFFSET_X - Math.sin(this.aimAngle) * WEAPON_OFFSET_Y;
    const oy = Math.sin(this.aimAngle) * WEAPON_OFFSET_X + Math.cos(this.aimAngle) * WEAPON_OFFSET_Y;
    const sx = this.player.x + ox, sy = this.player.y + oy;
    const ex = sx + Math.cos(this.aimAngle) * cfg.length;
    const ey = sy + Math.sin(this.aimAngle) * cfg.length;

    this.laserGraphics.lineStyle(cfg.width * 4, cfg.color, cfg.alpha * 0.18);
    this.laserGraphics.beginPath();
    this.laserGraphics.moveTo(sx, sy); this.laserGraphics.lineTo(ex, ey);
    this.laserGraphics.strokePath();

    this.laserGraphics.lineStyle(cfg.width, cfg.color, cfg.alpha);
    this.laserGraphics.beginPath();
    this.laserGraphics.moveTo(sx, sy); this.laserGraphics.lineTo(ex, ey);
    this.laserGraphics.strokePath();

    this.laserGraphics.fillStyle(cfg.color, cfg.alpha);
    this.laserGraphics.fillCircle(ex, ey, cfg.width * 2);
  }

  _drawAllHpBars() {
    this.hpGraphics.clear();
    for (const entry of Object.values(players)) {
      if (!entry?.sprite) continue;
      const hp    = entry.hp    ?? PLAYER_MAX_HP;
      const maxHp = entry.maxHp ?? PLAYER_MAX_HP;
      const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
      const sx    = entry.sprite.x - BAR_WIDTH / 2;
      const sy    = entry.sprite.y - BAR_OFFSET_Y;

      this.hpGraphics.fillStyle(0x222222, 0.75);
      this.hpGraphics.fillRect(sx, sy, BAR_WIDTH, BAR_HEIGHT);
      const barColor = ratio > 0.6 ? 0x44ff44 : ratio > 0.3 ? 0xffaa00 : 0xff2222;
      this.hpGraphics.fillStyle(barColor, 1);
      this.hpGraphics.fillRect(sx, sy, BAR_WIDTH * ratio, BAR_HEIGHT);
      this.hpGraphics.lineStyle(1, 0x000000, 0.6);
      this.hpGraphics.strokeRect(sx, sy, BAR_WIDTH, BAR_HEIGHT);
    }
  }

  updateHp(playerId, hp, maxHp) {
    const entry = players[playerId];
    if (!entry) return;
    entry.hp    = hp;
    entry.maxHp = maxHp;
    if (playerId === id) {
      const hud = document.getElementById('hp-display');
      if (hud) {
        const pct = Math.max(0, Math.round((hp / maxHp) * 100));
        hud.innerText = `❤ ${hp} / ${maxHp}`;
        hud.style.color = pct > 60 ? '#44ff44' : pct > 30 ? '#ffaa00' : '#ff2222';
      }
    }
  }

  onSlotsUpdate(data) {
    const entry = players[id];
    if (!entry) return;
    const visibleWeapon = data.activeSlot === 'melee' ? data.meleeWeapon : data.rangedWeapon;
    entry.weaponSprite.setTexture(visibleWeapon);
    entry.weaponType = visibleWeapon;
  }

  updatePlayerSlot(playerId, slot, ranged) {
    const entry = players[playerId];
    if (!entry) return;
    const visibleWeapon = slot === 'melee' ? 'knife' : ranged;
    entry.weaponSprite.setTexture(visibleWeapon);
    entry.weaponType = visibleWeapon;
  }

  updateCamera() {
    if (this.player) this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  update() {
    if (!this.player || !pseudo) return;

    let vx = 0, vy = 0;
    const speed = 200;
    if (this.cursors.left.isDown)  vx = -speed;
    if (this.cursors.right.isDown) vx =  speed;
    if (this.cursors.up.isDown)    vy = -speed;
    if (this.cursors.down.isDown)  vy =  speed;
    this.player.body.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      socket.send(JSON.stringify({
        type: 'move', x: this.player.x, y: this.player.y, aimAngle: this.aimAngle,
      }));
    }

    const pointer    = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.sight.setPosition(worldPoint.x, worldPoint.y);
    this.aimAngle = Phaser.Math.Angle.Between(
      this.player.x, this.player.y, worldPoint.x, worldPoint.y
    );
    this._updateLocalWeaponSprite();
    this._drawLaser();
    this._drawAllHpBars();
    this.updateCamera();
  }

  spawnPlayer(playerId, playerColor, x = 100, y = 100, weaponType = 'gun') {
    if (players[playerId]) {
      players[playerId].sprite.setPosition(x, y);
      return;
    }
    const sprite = this.add.rectangle(x, y, 40, 40,
      Phaser.Display.Color.HexStringToColor(playerColor).color);
    this.physics.add.existing(sprite);
    sprite.body.setCollideWorldBounds(true);

    const weaponSprite = this.add.image(x, y, weaponType)
      .setScale(5).setDepth(5).setOrigin(0.2, 0.5);

    players[playerId] = {
      sprite, weaponSprite, aimAngle: 0, weaponType,
      hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP,
    };
    if (playerId === id) this.player = sprite;
    if (this.wallGroup) this.physics.add.collider(sprite, this.wallGroup);
  }

  updateRemotePlayer(playerId, x, y, playerColor, aimAngle) {
    if (playerId === id) return;
    const entry = players[playerId];
    if (!entry) { this.spawnPlayer(playerId, playerColor || '#ffffff', x, y); return; }
    entry.sprite.setPosition(x, y);
    entry.aimAngle = aimAngle ?? entry.aimAngle;
    if (entry.weaponSprite) this._positionWeaponSprite(entry.sprite, entry.weaponSprite, entry.aimAngle);
  }

  updatePlayerWeapon(playerId, weaponType) {
    const entry = players[playerId];
    if (!entry) return;
    entry.weaponSprite.setTexture(weaponType);
    entry.weaponType = weaponType;
  }

  spawnProjectile(data) {
    const speed    = data.speed    || 800;
    const lifetime = data.lifetime || 1500;
    const bulletConfig = {
      gun:     { r: 4, color: 0xffffff },
      rifle:   { r: 3, color: 0xffff00 },
      shotgun: { r: 5, color: 0xff8800 },
      sniper:  { r: 3, color: 0x00ffff },
    };
    const cfg    = bulletConfig[data.weaponType] || bulletConfig.gun;
    const bullet = this.add.circle(data.x, data.y, cfg.r, cfg.color);
    this.physics.add.existing(bullet);
    bullet.body.setCircle(cfg.r);
    bullet.body.setVelocity(Math.cos(data.angle) * speed, Math.sin(data.angle) * speed);
    this.projectiles.add(bullet);
    this.time.delayedCall(lifetime, () => bullet.destroy());
    if (this.wallGroup) this.physics.add.overlap(bullet, this.wallGroup, () => bullet.destroy());
  }

  spawnZombie(zombieId, x, y) {
    if (zombies[zombieId]) return;
    const zombie = this.add.rectangle(x, y, 30, 30, 0xff0000);
    this.physics.add.existing(zombie);
    zombies[zombieId] = zombie;
  }

  updateZombie(zombieId, x, y) {
    const zombie = zombies[zombieId];
    if (zombie) zombie.setPosition(x, y);
  }

  removeZombie(zombieId) {
    const zombie = zombies[zombieId];
    if (zombie) { zombie.destroy(); delete zombies[zombieId]; }
  }

  spawnWeaponOnMap(weaponId, x, y, weaponType) {
    if (weaponsOnMap[weaponId]) return;
    const sprite = this.add.image(x, y, weaponType).setScale(5).setDepth(2).setAlpha(0.9);
    this.tweens.add({ targets: sprite, y: y - 6, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    weaponsOnMap[weaponId] = sprite;
  }

  removeWeaponOnMap(weaponId) {
    const sprite = weaponsOnMap[weaponId];
    if (sprite) { sprite.destroy(); delete weaponsOnMap[weaponId]; }
  }
}
