const socket = new WebSocket(`ws://${location.host}`);

let id = null;
let color = null;
let pseudo = null;

const players = {};
let gameScene = null;

// Phaser Game Scene
class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  preload() {
    this.load.image('player', 'assets/player.png');
  }

  create() {
    this.cursors = this.input.keyboard.createCursorKeys();
    gameScene = this;
  }

  update() {
    if (!this.player || !pseudo) return;

    let vx = 0, vy = 0;
    const speed = 200;

    if (this.cursors.left.isDown) vx = -speed;
    if (this.cursors.right.isDown) vx = speed;
    if (this.cursors.up.isDown) vy = -speed;
    if (this.cursors.down.isDown) vy = speed;

    this.player.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      socket.send(JSON.stringify({
        type: 'move',
        x: this.player.x,
        y: this.player.y,
      }));
    }
  }

  spawnPlayer(playerId, playerColor, x = 100, y = 100) {
    const sprite = this.physics.add.sprite(x, y, 'player').setTintFill(
      Phaser.Display.Color.HexStringToColor(playerColor).color
    );
    players[playerId] = sprite;
    if (playerId === id) this.player = sprite;
  }

  updateRemotePlayer(playerId, x, y, playerColor) {
    if (playerId === id) return;
    let sprite = players[playerId];
    if (!sprite) {
      sprite = this.physics.add.sprite(x, y, 'player').setTintFill(
        Phaser.Display.Color.HexStringToColor(playerColor || '#000000').color
      );
      players[playerId] = sprite;
    } else {
      sprite.setPosition(x, y);
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
  gameScene.updateRemotePlayer(data.id, data.x, data.y, data.color);
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
