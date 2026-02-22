import { GameScene } from './gameScene.js';
import './socketHandler.js';
import './chat.js';

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