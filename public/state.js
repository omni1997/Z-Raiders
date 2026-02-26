export let id = null;
export let color = null;
export let pseudo = null;
export let gameScene = null;
export let currentWeapon = 'gun';

export const players = {};        // id → { sprite, weaponSprite, aimAngle }
export const zombies = {};
export const weaponsOnMap = {};   // id → sprite

export const MAP_WIDTH = 2000;
export const MAP_HEIGHT = 2000;

export function setId(v) { id = v; }
export function setColor(v) { color = v; }
export function setPseudo(v) { pseudo = v; }
export function setGameScene(v) { gameScene = v; }
export function setCurrentWeapon(v) { currentWeapon = v; }