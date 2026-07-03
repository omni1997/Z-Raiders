import { GameScene } from './gameScene.js';
import './socketHandler.js';
import './chat.js';
import * as state from './state.js';
import { applyStoredVolume } from './volume.js';

const gameZone = document.getElementById('game-zone');

const config = {
  type: Phaser.AUTO,
  width: gameZone.clientWidth,
  height: gameZone.clientHeight,
  parent: 'game-zone',
  physics: { default: 'arcade' },
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

window.addEventListener('load', () => {
  const game = new Phaser.Game(config);
  state.setGame(game);
  applyStoredVolume();
  window.addEventListener('resize', () => {
    game.scale.resize(gameZone.clientWidth, gameZone.clientHeight);
  });
});
