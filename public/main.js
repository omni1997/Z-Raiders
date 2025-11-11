const socket = new WebSocket(`ws://${location.host}`);

let id = null;
let color = null;
let pseudo = null;

const players = {};
const zombies = {};
let gameScene = null;

// Phaser Game Scene
class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys();
    gameScene = this;
    this.graphics = this.add.graphics();
    this.projectiles = this.add.group();
    this.input.on('pointerdown', this.shoot, this);
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

    // Draw aiming line
    if (this.input.activePointer) {
      const pointer = this.input.activePointer;
      const startX = this.player.x;
      const startY = this.player.y;

      const dx = pointer.worldX - startX;
      const dy = pointer.worldY - startY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const maxLength = 100;
      const ratio = maxLength / length;

      const endX = startX + dx * ratio;
      const endY = startY + dy * ratio;

      this.graphics.clear();
      this.graphics.lineStyle(4, 0xff0000, 1);
      this.graphics.beginPath();
      this.graphics.moveTo(startX, startY);
      this.graphics.lineTo(endX, endY);
      this.graphics.strokePath();
    }
  }

  // Spawns a rectangle player
  spawnPlayer(playerId, playerColor, x = 100, y = 100) {
    const sprite = this.add.rectangle(x, y, 40, 40, Phaser.Display.Color.HexStringToColor(playerColor).color);
    this.physics.add.existing(sprite);
    sprite.body.setCollideWorldBounds(true);
    players[playerId] = sprite;
    if (playerId === id) this.player = sprite;
  }

  // Update position of other players
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

  // Handle shooting
  shoot(pointer) {
    if (pointer.leftButtonDown() && this.player) {
      const angle = Phaser.Math.Angle.Between(
        this.player.x, this.player.y,
        pointer.worldX, pointer.worldY
      );

      socket.send(JSON.stringify({
        type: 'shoot',
        x: this.player.x,
        y: this.player.y,
        angle: angle
      }));
    }
  }

  // Spawns a zombie rectangle
  spawnZombie(id, x, y) {
    if (zombies[id]) return;
    const zombie = this.add.rectangle(x, y, 30, 30, 0xff0000);
    this.physics.add.existing(zombie);
    zombies[id] = zombie;
  }

  // Updates a zombie position
  updateZombie(id, x, y) {
    const zombie = zombies[id];
    if (zombie) zombie.setPosition(x, y);
  }

  // Removes a zombie when killed
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
    // Personal score
    if (data.playerId === id) {
      document.getElementById('my-score').innerText =
        `${data.zombiesKilled} zombies / ${data.playersKilled} players`;
    }

    // Top players
    const topList = document.getElementById('top-players');
    topList.innerHTML = '';
    data.topPlayers.forEach((p, index) => {
      const li = document.createElement('li');
      const name = p.pseudo;

      // Add badge for top 3
      let badge = '';
      if (index === 0) badge = '🥇 ';
      else if (index === 1) badge = '🥈 ';
      else if (index === 2) badge = '🥉 ';

      li.innerText = `${badge}${name}: ${p.zombiesKilled} zombies / ${p.playersKilled} players`;
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
