const socket = new WebSocket(`ws://${location.host}`);

let id = null;
let color = null;
let pseudo = null;

const players = {};
const zombies = {};
let gameScene = null;

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;

// Phaser Game Scene
class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
    gameScene = this;
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

    this.cursors = this.input.keyboard.createCursorKeys();
    this.graphics = this.add.graphics();
    this.projectiles = this.add.group();

    // Met à jour l'angle de visée quand la souris bouge
    this.input.on('pointermove', pointer => {
      if (this.player) {
        this.aimAngle = Phaser.Math.Angle.Between(
          this.player.x, this.player.y,
          pointer.worldX, pointer.worldY
        );
      }
    });

    // Tir
    this.input.on('pointerdown', this.shoot, this);
  }

  updateCamera() {
    const cam = this.cameras.main;
    if (this.player) cam.centerOn(this.player.x, this.player.y);
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

    // Ligne de visée
    if (this.player) {
      const startX = this.player.x;
      const startY = this.player.y;
      const length = 100;

      const endX = startX + Math.cos(this.aimAngle) * length;
      const endY = startY + Math.sin(this.aimAngle) * length;

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

  spawnZombie(id, x, y) {
    if (zombies[id]) return;
    const zombie = this.add.rectangle(x, y, 30, 30, 0xff0000);
    this.physics.add.existing(zombie);
    zombies[id] = zombie;
  }

  updateZombie(id, x, y) {
    const zombie = zombies[id];
    if (zombie) zombie.setPosition(x, y);
  }

  removeZombie(id) {
    const zombie = zombies[id];
    if (zombie) {
      zombie.destroy();
      delete zombies[id];
    }
  }
}

// Phaser config
const config = {
  type: Phaser.AUTO,
  width: document.getElementById('game-zone').clientWidth,
  height: document.getElementById('game-zone').clientHeight,
  parent: 'game-zone',
  physics: { default: 'arcade' },
  scene: [GameScene],
};
window.addEventListener('load', () => {
  new Phaser.Game(config);
});

// WebSocket message handling
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'init') {
    id = data.id;
    color = data.color;
    document.getElementById('color-box').style.backgroundColor = color;
    document.getElementById('info').innerText = `ID: ${id} | Color: ${color}`;
  }

  if (data.type === 'confirm') {
    pseudo = data.pseudo;
    document.getElementById('pseudo').remove();
    document.getElementById('send').remove();

    const confirmed = document.createElement('div');
    confirmed.innerText = `Username: ${pseudo}`;
    document.getElementById('form').appendChild(confirmed);
    document.getElementById('chat').style.display = 'block';

    if (gameScene) {
      gameScene.spawnPlayer(id, color);
    }
  }

  if (data.type === 'chat') {
    addMessage(data);
  }

  if (data.type === 'move' && gameScene) {
    gameScene.updateRemotePlayer(data.id, data.x, data.y, data.color);
  }

  if (data.type === 'projectile' && gameScene) {
    const bullet = gameScene.add.circle(data.x, data.y, 4, 0xffffff);
    gameScene.physics.add.existing(bullet);
    bullet.body.setCircle(4);
    bullet.body.setVelocity(
      Math.cos(data.angle) * 400,
      Math.sin(data.angle) * 400
    );
    gameScene.projectiles.add(bullet);
    gameScene.time.delayedCall(1500, () => bullet.destroy());
  }

  if (data.type === 'respawn' && gameScene) {
    const sprite = players[data.id];
    if (sprite) {
      sprite.setPosition(data.x, data.y);
    } else {
      gameScene.spawnPlayer(data.id, data.color, data.x, data.y);
    }

    if (data.id === id) {
      gameScene.player.setPosition(data.x, data.y);
    }
  }

  // Spawn or update zombies
  if (data.type === 'zombie_spawn' && gameScene) {
    gameScene.spawnZombie(data.id, data.x, data.y);
  }

  if (data.type === 'zombie_move' && gameScene) {
    gameScene.updateZombie(data.id, data.x, data.y);
  }

  if (data.type === 'zombie_remove' && gameScene) {
    gameScene.removeZombie(data.id);
  }

  if (data.type === 'score_update') {
    if (data.playerId === id) {
      document.getElementById('my-score').innerText =
        `${data.zombiesKilled} zombies / ${data.playersKilled} players`;
    }

    const topList = document.getElementById('top-players');
    topList.innerHTML = '';
    data.topPlayers.forEach((p, index) => {
      const li = document.createElement('li');
      let badge = '';
      if (index === 0) badge = '🥇 ';
      else if (index === 1) badge = '🥈 ';
      else if (index === 2) badge = '🥉 ';

      li.innerText = `${badge}${p.pseudo}: ${p.zombiesKilled} zombies / ${p.playersKilled} players`;
      topList.appendChild(li);
    });
  }
});

// Chat controls
const pseudoInput = document.getElementById('pseudo');
const sendPseudoBtn = document.getElementById('send');
const messageInput = document.getElementById('message');
const sendMsgBtn = document.getElementById('send-msg');

sendPseudoBtn.addEventListener('click', sendPseudo);
pseudoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendPseudo();
});
function sendPseudo() {
  const value = pseudoInput.value.trim();
  if (value) {
    socket.send(JSON.stringify({ type: 'pseudo', pseudo: value }));
  }
}

sendMsgBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});
function sendMessage() {
  const message = messageInput.value.trim();
  if (message) {
    socket.send(JSON.stringify({ type: 'chat', message }));
    messageInput.value = '';
  }
}

function addMessage(data) {
  const msgList = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'flex items-center mb-1';

  const colorBox = document.createElement('div');
  colorBox.className = 'w-4 h-4 mr-2 border border-black';
  colorBox.style.backgroundColor = data.color;

  const text = document.createElement('span');
  text.innerText = `${data.pseudo}: ${data.message}`;

  div.appendChild(colorBox);
  div.appendChild(text);
  msgList.appendChild(div);
  msgList.scrollTop = msgList.scrollHeight;
}
