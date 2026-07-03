import * as state from './state.js';

const VOLUME_KEY = 'zr_volume';
const MUTED_KEY  = 'zr_muted';

const slider  = document.getElementById('volume-slider');
const muteBtn = document.getElementById('volume-mute');

function getStoredVolume() {
  const v = parseFloat(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(v) ? v : 0.6;
}

let volume = getStoredVolume();
let muted  = localStorage.getItem(MUTED_KEY) === 'true';

function render() {
  slider.value = volume;
  slider.disabled = muted;
  muteBtn.innerText = muted ? '🔇' : '🔊';
  muteBtn.classList.toggle('active', muted);

  // Le gestionnaire de son Phaser est global (game.sound), donc ceci
  // s'applique à tous les sons, y compris ceux déjà en lecture (ambience).
  if (state.game) {
    state.game.sound.volume = volume;
    state.game.sound.mute   = muted;
  }
}

slider.addEventListener('input', () => {
  volume = parseFloat(slider.value);
  if (volume > 0 && muted) muted = false;
  localStorage.setItem(VOLUME_KEY, volume);
  localStorage.setItem(MUTED_KEY, muted);
  render();
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  localStorage.setItem(MUTED_KEY, muted);
  render();
});

// Appelé une fois le jeu Phaser créé, pour appliquer le réglage déjà choisi
export function applyStoredVolume() {
  render();
}

render();
