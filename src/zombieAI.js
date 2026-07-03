const WALL_SIZE = 64;

// Checks if a point collides with a single wall's bounding box
function wallCollision(obj, wall) {
  return (
    obj.x > wall.x - WALL_SIZE / 2 &&
    obj.x < wall.x + WALL_SIZE / 2 &&
    obj.y > wall.y - WALL_SIZE / 2 &&
    obj.y < wall.y + WALL_SIZE / 2
  );
}

// Builds a boolean occupancy grid from the wall list (one cell per WALL_SIZE)
function buildGrid(wallList, worldW, worldH) {
  const cols = Math.ceil(worldW / WALL_SIZE);
  const rows = Math.ceil(worldH / WALL_SIZE);
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(false));

  for (const wall of wallList) {
    const col = Math.floor(wall.x / WALL_SIZE);
    const row = Math.floor(wall.y / WALL_SIZE);
    if (row >= 0 && row < rows && col >= 0 && col < cols) grid[row][col] = true;
  }

  return { grid, cols, rows };
}

function worldToCell(pos) {
  return { row: Math.floor(pos.y / WALL_SIZE), col: Math.floor(pos.x / WALL_SIZE) };
}

function cellCenter(cell) {
  return { x: cell.col * WALL_SIZE + WALL_SIZE / 2, y: cell.row * WALL_SIZE + WALL_SIZE / 2 };
}

const DIRECTIONS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// BFS on the occupancy grid (uniform cost -> shortest path in cell count).
// Returns a list of world-space waypoints, or null if unreachable.
function findPath(gridInfo, startCell, endCell) {
  const { grid, cols, rows } = gridInfo;
  if (grid[endCell.row]?.[endCell.col]) return null;
  if (startCell.row === endCell.row && startCell.col === endCell.col) return [];

  const key = (r, c) => r * cols + c;
  const visited = new Set([key(startCell.row, startCell.col)]);
  const cameFrom = new Map();
  const queue = [startCell];
  let head = 0;

  while (head < queue.length) {
    const { row, col } = queue[head++];
    if (row === endCell.row && col === endCell.col) break;

    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr, nc = col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc]) continue;
      if (dr !== 0 && dc !== 0 && (grid[row][nc] || grid[nr][col])) continue; // no cutting through corners
      const k = key(nr, nc);
      if (visited.has(k)) continue;
      visited.add(k);
      cameFrom.set(k, { row, col });
      queue.push({ row: nr, col: nc });
    }
  }

  if (!visited.has(key(endCell.row, endCell.col))) return null;

  const path = [];
  let cur = endCell;
  while (cur.row !== startCell.row || cur.col !== startCell.col) {
    path.push(cur);
    cur = cameFrom.get(key(cur.row, cur.col));
  }
  path.reverse();
  return path.map(cellCenter);
}

// Samples points along the segment to detect whether a wall blocks a direct path
function hasLineOfSight(wallList, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist / (WALL_SIZE / 2)));

  for (let i = 1; i < steps; i++) {
    const point = { x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps };
    for (const wall of wallList) {
      if (wallCollision(point, wall)) return false;
    }
  }
  return true;
}

module.exports = { WALL_SIZE, wallCollision, buildGrid, worldToCell, cellCenter, findPath, hasLineOfSight };
