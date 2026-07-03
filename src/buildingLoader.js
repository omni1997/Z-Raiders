const fs   = require('fs');
const path = require('path');

const WALL_SIZE       = 64;
const BUILDINGS_DIR   = path.join(__dirname, 'buildings');
const BUILDING_FILES  = ['building1.txt', 'building2.txt', 'building3.txt'];

/**
 * Charge un fichier .txt et retourne un tableau 2D de 0/1
 */
function loadBlueprintFile(filename) {
  const raw = fs.readFileSync(path.join(BUILDINGS_DIR, filename), 'utf-8');
  return raw
    .trim()
    .split('\n')
    .map(line => line.trim().split('').map(Number));
}

/**
 * Convertit un blueprint 2D en liste de murs absolus
 * @param {number[][]} grid
 * @param {number} originX  - coin haut-gauche du bâtiment dans le monde
 * @param {number} originY
 * @returns {{ id: string, x: number, y: number }[]}
 */
function blueprintToWalls(grid, originX, originY, buildingId) {
  const walls = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === 1) {
        walls.push({
          id: `${buildingId}-r${row}-c${col}`,
          x: originX + col * WALL_SIZE + WALL_SIZE / 2,
          y: originY + row * WALL_SIZE + WALL_SIZE / 2,
        });
      }
    }
  }
  return walls;
}

/**
 * Retourne { cols, rows } d'un blueprint
 */
function blueprintSize(grid) {
  return {
    cols: Math.max(...grid.map(r => r.length)),
    rows: grid.length,
  };
}

/**
 * Vérifie si deux rectangles AABB se chevauchent (avec marge)
 */
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh, margin = WALL_SIZE * 2) {
  return (
    ax < bx + bw + margin &&
    ax + aw + margin > bx &&
    ay < by + bh + margin &&
    ay + ah + margin > by
  );
}

/**
 * Place NUM_BUILDINGS bâtiments aléatoires (sans collision entre eux)
 * dans une world de taille worldW x worldH.
 *
 * @param {number} worldW
 * @param {number} worldH
 * @param {number} numBuildings
 * @param {number} maxAttempts  - tentatives max par bâtiment
 * @returns {{ id: string, x: number, y: number }[]}  liste de tous les murs
 */
function generateBuildings(worldW, worldH, numBuildings = 6, maxAttempts = 200) {
  const blueprints = BUILDING_FILES.map(f => loadBlueprintFile(f));

  const placed = [];   // { x, y, w, h }
  const allWalls = [];

  for (let i = 0; i < numBuildings; i++) {
    const grid      = blueprints[Math.floor(Math.random() * blueprints.length)];
    const { cols, rows } = blueprintSize(grid);
    const bw        = cols * WALL_SIZE;
    const bh        = rows * WALL_SIZE;
    const buildingId = `building-${i}`;

    let placed_ok = false;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Position aléatoire avec marge de WALL_SIZE*3 sur les bords
      const margin = WALL_SIZE * 3;
      const ox = margin + Math.floor(Math.random() * (worldW - bw - margin * 2));
      const oy = margin + Math.floor(Math.random() * (worldH - bh - margin * 2));

      // Vérifie collision avec les bâtiments déjà placés
      const collision = placed.some(p =>
        rectsOverlap(ox, oy, bw, bh, p.x, p.y, p.w, p.h)
      );

      if (!collision) {
        placed.push({ x: ox, y: oy, w: bw, h: bh });
        const walls = blueprintToWalls(grid, ox, oy, buildingId);
        allWalls.push(...walls);
        placed_ok = true;
        break;
      }
    }

    if (!placed_ok) {
      console.warn(`[buildingLoader] Impossible de placer le bâtiment ${i} après ${maxAttempts} tentatives`);
    }
  }

  return allWalls;
}

module.exports = { generateBuildings };
