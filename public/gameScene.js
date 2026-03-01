import { socket } from './socket.js';
import { players, zombies, weaponsOnMap, pseudo, id, MAP_WIDTH, MAP_HEIGHT, setGameScene, currentWeapon } from './state.js';

const WEAPON_OFFSET_X = 18;
const WEAPON_OFFSET_Y = 5;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
    setGameScene(this);
    this.aimAngle = 0;
  }

  preload() {
    this.load.image('map',     'assets/map.png');
    //this.load.image('player',  'assets/player.png');
    this.load.image('sight',   'assets/sight.png');
    this.load.image('gun',     'assets/guns/gun.png');
    this.load.image('rifle',   'assets/guns/rifle.png');
    this.load.image('shotgun', 'assets/guns/shotgun.png');
    this.load.image('sniper',  'assets/guns/sniper.png');
    this.load.image('wall1',   'assets/building/wall1.png');
  }

  spawnWall(wallId, x, y) {
    const sprite = this.physics.add.staticImage(x, y, 'wall1')
      .setDisplaySize(32, 32)
      .setDepth(3);
    sprite.refreshBody();
    this.wallGroup.add(sprite);
    this.walls = this.walls || {};
    this.walls[wallId] = sprite;

    // Ajouter collider avec tous les joueurs déjà spawned
    for (const entry of Object.values(players)) {
      if (entry && entry.sprite) {
        this.physics.add.collider(entry.sprite, this.wallGroup);
      }
    }
  }

  create() {
    this.add.image(0, 0, 'map')
      .setOrigin(0)
      .setDepth(-1)
      .setDisplaySize(MAP_WIDTH, MAP_HEIGHT);
    this.wallGroup = this.physics.add.staticGroup();
    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.projectiles = this.add.group();

    this.sight = this.add.image(0, 0, 'sight').setDepth(10).setScale(0.5);
    this.input.setDefaultCursor('none');

    this.input.on('pointermove', pointer => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.sight.setPosition(worldPoint.x, worldPoint.y);
      if (this.player) {
        this.aimAngle = Phaser.Math.Angle.Between(
          this.player.x, this.player.y,
          worldPoint.x, worldPoint.y
        );
        this._updateLocalWeaponSprite();
      }
    });

    this.input.on('pointerdown', this.shoot, this);
  }

  _updateLocalWeaponSprite() {
    const entry = players[id];
    if (!entry || !entry.weaponSprite) return;
    this._positionWeaponSprite(entry.sprite, entry.weaponSprite, this.aimAngle);
  }

  _positionWeaponSprite(playerSprite, weaponSprite, angle) {
    // Placer l'arme à côté du joueur dans la direction du viseur
    const offsetX = Math.cos(angle) * WEAPON_OFFSET_X - Math.sin(angle) * WEAPON_OFFSET_Y;
    const offsetY = Math.sin(angle) * WEAPON_OFFSET_X + Math.cos(angle) * WEAPON_OFFSET_Y;
    weaponSprite.setPosition(playerSprite.x + offsetX, playerSprite.y + offsetY);
    weaponSprite.setRotation(angle + Math.PI / 2);
  }

  updateCamera() {
    if (this.player) this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  update() {
    if (!this.player || !pseudo) return;

    let vx = 0, vy = 0;
    const speed = 200;
    if (this.cursors.left.isDown)  vx = -speed;
    if (this.cursors.right.isDown) vx = speed;
    if (this.cursors.up.isDown)    vy = -speed;
    if (this.cursors.down.isDown)  vy = speed;
    this.player.body.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      socket.send(JSON.stringify({
        type: 'move',
        x: this.player.x,
        y: this.player.y,
        aimAngle: this.aimAngle,
      }));
    }

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.sight.setPosition(worldPoint.x, worldPoint.y);
    this.aimAngle = Phaser.Math.Angle.Between(
      this.player.x, this.player.y,
      worldPoint.x, worldPoint.y
    );
    this._updateLocalWeaponSprite();
    this.updateCamera();
  }

  spawnPlayer(playerId, playerColor, x = 100, y = 100, weaponType = 'gun') {
    // Si déjà existant, juste repositionner
    if (players[playerId]) {
      players[playerId].sprite.setPosition(x, y);
      return;
    }

    const sprite = this.add.rectangle(x, y, 40, 40, Phaser.Display.Color.HexStringToColor(playerColor).color);
    this.physics.add.existing(sprite);
    sprite.body.setCollideWorldBounds(true);

    const weaponSprite = this.add.image(x, y, weaponType)
      .setScale(5)
      .setDepth(5)
      .setOrigin(0.2, 0.5); // origine décalée pour que l'arme parte du côté du joueur

    players[playerId] = { sprite, weaponSprite, aimAngle: 0, weaponType };

    if (playerId === id) this.player = sprite;

    if (this.wallGroup) {
      this.physics.add.collider(sprite, this.wallGroup);
    }
  }

  updateRemotePlayer(playerId, x, y, playerColor, aimAngle) {
    if (playerId === id) return;
    const entry = players[playerId];
    if (!entry) {
      this.spawnPlayer(playerId, playerColor || '#ffffff', x, y);
      return;
    }
    entry.sprite.setPosition(x, y);
    entry.aimAngle = aimAngle ?? entry.aimAngle;
    if (entry.weaponSprite) {
      this._positionWeaponSprite(entry.sprite, entry.weaponSprite, entry.aimAngle);
    }
  }

  updatePlayerWeapon(playerId, weaponType) {
    const entry = players[playerId];
    if (!entry) return;
    entry.weaponSprite.setTexture(weaponType);
    entry.weaponType = weaponType;
  }

  shoot(pointer) {
    if (pointer.leftButtonDown() && this.player) {
      socket.send(JSON.stringify({
        type: 'shoot',
        x: this.player.x,
        y: this.player.y,
        angle: this.aimAngle,
      }));
    }
  }

  spawnProjectile(data) {
    const speed    = data.speed    || 800;
    const lifetime = data.lifetime || 1500;

    const bulletConfig = {
      gun:     { r: 4,  color: 0xffffff },
      rifle:   { r: 3,  color: 0xffff00 },
      shotgun: { r: 5,  color: 0xff8800 },
      sniper:  { r: 3,  color: 0x00ffff },
    };
    const cfg = bulletConfig[data.weaponType] || bulletConfig.gun;

    const bullet = this.add.circle(data.x, data.y, cfg.r, cfg.color);
    this.physics.add.existing(bullet);
    bullet.body.setCircle(cfg.r);
    bullet.body.setVelocity(
      Math.cos(data.angle) * speed,
      Math.sin(data.angle) * speed
    );
    this.projectiles.add(bullet);
    this.time.delayedCall(lifetime, () => bullet.destroy());

    if (this.wallGroup) {
      this.physics.add.overlap(bullet, this.wallGroup, () => {
        bullet.destroy();
      });
    }
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
    const sprite = this.add.image(x, y, weaponType)
      .setScale(5)
      .setDepth(2)
      .setAlpha(0.9);
    // Petite animation de flottement
    this.tweens.add({
      targets: sprite,
      y: y - 6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    weaponsOnMap[weaponId] = sprite;
  }

  removeWeaponOnMap(weaponId) {
    const sprite = weaponsOnMap[weaponId];
    if (sprite) { sprite.destroy(); delete weaponsOnMap[weaponId]; }
  }
}