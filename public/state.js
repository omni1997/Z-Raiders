export let id            = null;
export let color         = null;
export let pseudo        = null;
export let gameScene     = null;
export let currentWeapon = 'gun';   // conservé pour compatibilité
export let rangedWeapon  = 'gun';
export let meleeWeapon   = 'knife';
export let activeSlot    = 'ranged'; // 'ranged' | 'melee'

export const players     = {};
export const zombies     = {};
export const weaponsOnMap = {};

export const MAP_WIDTH  = 2000;
export const MAP_HEIGHT = 2000;

export function setId(v)           { id = v; }
export function setColor(v)        { color = v; }
export function setPseudo(v)       { pseudo = v; }
export function setGameScene(v)    { gameScene = v; }
export function setCurrentWeapon(v){ currentWeapon = v; }
export function setRangedWeapon(v) { rangedWeapon = v; currentWeapon = v; }
export function setMeleeWeapon(v)  { meleeWeapon = v; }
export function setActiveSlot(v)   { activeSlot = v; }
