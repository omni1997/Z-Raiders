import { socket } from './socket.js';
import { players, zombies, pseudo, id, MAP_WIDTH, MAP_HEIGHT, setGameScene } from './state.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
    setGameScene(this);
    this.aimAngle = 0;
  }

  preload() {
    this.load.image('map', 'assets/map.png');
    this.load.image('player', 'assets/player.png');
  }

  create() {
    const map = this.add.image(0, 0, 'map')
      .setOrigin(0)
      .setDepth(-1)
      .setDisplaySize(MAP_WIDTH, MAP_HEIGHT);

    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.graphics = this.add.graphics();
    this.projectiles = this.add.group();

    this.input.on('pointermove', pointer => {
      if (this.player) {
        this.aimAngle = Phaser.Math.Angle.Between(
          this.player.x, this.player.y,
          pointer.worldX, pointer.worldY
        );
      }
    });

    this.input.on('pointerdown', this.shoot, this);
  }

  updateCamera() {
    if (this.player) this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  update() {
    if (!this.player || !pseudo) return;

    let vx = 0, vy = 0;
    const speed = 200;

    if (this.cursors.left.isDown) vx = -speed;
    if (this.cursors.right.isDown) vx = speed;
    if (this.cursors.up.isDown) vy = -speed;
    if (this.cursors.down.isDown) vy = speed;

    this.player.body.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      socket.send(JSON.stringify({
        type: 'move',
        x: this.player.x,
        y: this.player.y,
      }));
    }

    if (this.player && this.input.activePointer) {
      const pointer = this.input.activePointer;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      const startX = this.player.x;
      const startY = this.player.y;
      const dx = worldPoint.x - startX;
      const dy = worldPoint.y - startY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const maxLength = 100;
      const ratio = Math.min(maxLength / length, 1);

      const endX = startX + dx * ratio;
      const endY = startY + dy * ratio;

      this.graphics.clear();
      this.graphics.lineStyle(4, 0xff0000, 1);
      this.graphics.beginPath();
      this.graphics.moveTo(startX, startY);
      this.graphics.lineTo(endX, endY);
      this.graphics.strokePath();
    }

    this.updateCamera();
  }

  spawnPlayer(playerId, playerColor, x = 100, y = 100) {
    const sprite = this.add.rectangle(x, y, 40, 40, Phaser.Display.Color.HexStringToColor(playerColor).color);
    this.physics.add.existing(sprite);
    sprite.body.setCollideWorldBounds(true);
    players[playerId] = sprite;
    if (playerId === id) this.player = sprite;
  }

  updateRemotePlayer(playerId, x, y, playerColor) {
    if (playerId === id) return;
    let sprite = players[playerId];
    if (!sprite) {
      sprite = this.add.rectangle(x, y, 40, 40, Phaser.Display.Color.HexStringToColor(playerColor || '#000000').color);
      this.physics.add.existing(sprite);
      players[playerId] = sprite;
    } else {
      sprite.setPosition(x, y);
    }
  }

  shoot(pointer) {
    if (pointer.leftButtonDown() && this.player) {
      socket.send(JSON.stringify({
        type: 'shoot',
        x: this.player.x,
        y: this.player.y,
        angle: this.aimAngle
      }));
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
    if (zombie) {
      zombie.destroy();
      delete zombies[zombieId];
    }
  }
}