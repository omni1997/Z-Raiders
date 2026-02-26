import { socket } from './socket.js';
import * as state from './state.js';
const { players } = state;
const getId = () => state.id;

import { addMessage, confirmPseudo } from './chat.js';

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'init') {
    state.setId(data.id);
    state.setColor(data.color);
    document.getElementById('color-box').style.backgroundColor = data.color;
    document.getElementById('info').innerText = `ID: ${data.id} | Color: ${data.color}`;
  }

  if (data.type === 'confirm') {
    state.setPseudo(data.pseudo);
    confirmPseudo(data.pseudo);
    if (state.gameScene) {
      state.gameScene.spawnPlayer(state.id, state.color);
    }
  }

  if (data.type === 'chat') {
    addMessage(data);
  }

  if (data.type === 'move' && state.gameScene) {
    state.gameScene.updateRemotePlayer(data.id, data.x, data.y, data.color, data.aimAngle);
  }

  if (data.type === 'projectile' && state.gameScene) {
    state.gameScene.spawnProjectile(data);
  }

  if (data.type === 'respawn' && state.gameScene) {
    const entry = players[data.id];
    if (entry) {
      entry.sprite.setPosition(data.x, data.y);
    } else {
      state.gameScene.spawnPlayer(data.id, data.color, data.x, data.y);
    }
    if (data.id === getId()) {
      state.gameScene.player.setPosition(data.x, data.y);
    }
  }

  if (data.type === 'zombie_spawn' && state.gameScene) {
    state.gameScene.spawnZombie(data.id, data.x, data.y);
  }
  if (data.type === 'zombie_move' && state.gameScene) {
    state.gameScene.updateZombie(data.id, data.x, data.y);
  }
  if (data.type === 'zombie_remove' && state.gameScene) {
    state.gameScene.removeZombie(data.id);
  }

  if (data.type === 'weapon_spawn' && state.gameScene) {
    state.gameScene.spawnWeaponOnMap(data.id, data.x, data.y, data.weaponType);
  }
  if (data.type === 'weapon_remove' && state.gameScene) {
    state.gameScene.removeWeaponOnMap(data.id);
  }

  if (data.type === 'weapon_equipped') {
    state.setCurrentWeapon(data.weaponType);
    document.getElementById('current-weapon').innerText = `🔫 ${data.weaponType}`;

    // Mettre à jour le sprite de l'arme du joueur local
    if (state.gameScene) {
      state.gameScene.updatePlayerWeapon(state.id, data.weaponType);
    }
  }

  if (data.type === 'player_weapon' && state.gameScene) {
    state.gameScene.updatePlayerWeapon(data.playerId, data.weaponType);
  }

  if (data.type === 'score_update') {
    if (data.playerId === state.id) {
      document.getElementById('my-score').innerText =
        `${data.zombiesKilled} zombies / ${data.playersKilled} players`;
    }
    const topList = document.getElementById('top-players');
    topList.innerHTML = '';
    data.topPlayers.forEach((p, index) => {
      const li = document.createElement('li');
      const badges = ['🥇 ', '🥈 ', '🥉 '];
      li.innerText = `${badges[index] || ''}${p.pseudo}: ${p.zombiesKilled} zombies / ${p.playersKilled} players`;
      topList.appendChild(li);
    });
  }
});