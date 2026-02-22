export let id = null;
export let color = null;
export let pseudo = null;
export let gameScene = null;

export const players = {};
export const zombies = {};

export const MAP_WIDTH = 2000;
export const MAP_HEIGHT = 2000;

export function setId(v) { id = v; }
export function setColor(v) { color = v; }
export function setPseudo(v) { pseudo = v; }
export function setGameScene(v) { gameScene = v; }