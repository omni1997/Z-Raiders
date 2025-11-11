const socket = new WebSocket(`ws://${location.host}`);

let id = null;
let color = null;
let pseudo = null;

const players = {};
let gameScene = null;

const mapWidth = 2000;
const mapHeight = 2000;


// Phaser Game Scene
class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  preload() {
    this.load.image('map', 'assets/map.png');
    this.load.image('player', 'assets/player.png');
  }

  create() {
    const map = this.add.image(0, 0, 'map')
      .setOrigin(0)
      .setDepth(-1)
      .setDisplaySize(mapWidth, mapHeight);


    
    this.cursors = this.input.keyboard.createCursorKeys();
    gameScene = this;
    this.graphics = this.add.graphics();
    this.projectiles = this.add.group();
    this.input.on('pointerdown', this.shoot, this);

  }

  updateCamera() {
    const cam = this.cameras.main;
    // La caméra suit exactement le joueur
    cam.centerOn(this.player.x, this.player.y);
  }

  update() {
    if (!this.player || !pseudo) return;

    let vx = 0, vy = 0;
    const speed = 200;

    if (this.cursors.left.isDown) vx = -speed;
    if (this.cursors.right.isDown) vx = speed;
    if (this.cursors.up.isDown) vy = -speed;
    if (this.cursors.down.isDown) vy = speed;

    // Appliquer la vélocité localement pour l'animation
    this.player.setVelocity(vx, vy);

    // Envoyer la vitesse au serveur
    if (vx !== 0 || vy !== 0) {
      socket.send(JSON.stringify({
        type: 'move',
        vx: vx,
        vy: vy
      }));
    }

    // Direction du tir et ligne de visée
    if (this.player && this.input.activePointer) {
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

    this.updateCamera();
  }

  spawnPlayer(playerId, playerColor, x = 100, y = 100) {
    const sprite = this.physics.add.sprite(x, y, 'player').setTintFill(
      Phaser.Display.Color.HexStringToColor(playerColor).color
    );
    players[playerId] = sprite;

    if (playerId === id) {
        this.player = sprite;
        // Supprimer startFollow()
        this.cameras.main.setZoom(1.5);
    }
  }

  updateRemotePlayer(playerId, x, y, playerColor) {
    if (playerId === id) return;
    let sprite = players[playerId];
    if (!sprite) {
      sprite = this.physics.add.sprite(x, y, 'player').setTintFill(
        Phaser.Display.Color.HexStringToColor(playerColor || '#000000').color
      );_
      players[playerId] = sprite;
    } else {
      sprite.setPosition(x, y);
    }
  }

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



}

// Initialize Phaser game
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

// Listen for messages from the server
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
    if (data.id === id && gameScene.player) {
      // appliquer la position validée par le serveur
      gameScene.player.setPosition(data.x, data.y);
    } else {
      gameScene.updateRemotePlayer(data.id, data.x, data.y, data.color);
    }
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


});

// Chat: DOM elements
const pseudoInput = document.getElementById('pseudo');
const sendPseudoBtn = document.getElementById('send');
const messageInput = document.getElementById('message');
const sendMsgBtn = document.getElementById('send-msg');

// Pseudo
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

// Message
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

