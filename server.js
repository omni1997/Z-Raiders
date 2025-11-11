const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));

// Connected clients: ws → { id, color, pseudo, x, y }
const clients = new Map();

// Server-side projectiles for collision handling
const projectiles = new Map();

// Server-side PVE enemies (zombies)
const zombies = new Map();

// Map and entity parameters
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const PLAYER_RADIUS = 20;
const PROJECTILE_RADIUS = 4;
const PROJECTILE_SPEED = 400;
const PROJECTILE_LIFETIME = 1500;
const ZOMBIE_SPEED = 80;
const ZOMBIE_SPAWN_INTERVAL = 10; // seconds
const ZOMBIE_RADIUS = 18;

// Generate random color
function getRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

// Generate random position
function randomPosition() {
  return {
    x: Math.floor(Math.random() * MAP_WIDTH),
    y: Math.floor(Math.random() * MAP_HEIGHT)
  };
}

// Compute distance between two points
function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

wss.on('connection', (ws) => {
  const color = getRandomColor();
  const id = randomUUID();
  const pos = randomPosition();

  // Register client
  clients.set(ws, { id, color, pseudo: null, x: pos.x, y: pos.y });

  // Send initialization info
  ws.send(JSON.stringify({ type: 'init', id, color }));

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    const client = clients.get(ws);
    if (!client) return;

    // Pseudo registration
    if (msg.type === 'pseudo') {
      client.pseudo = msg.pseudo;
      ws.send(JSON.stringify({ type: 'confirm', pseudo: client.pseudo }));

      const spawnPayload = {
        type: 'respawn',
        id: client.id,
        x: client.x,
        y: client.y
      };
      ws.send(JSON.stringify(spawnPayload));

      console.log(`Connected: ${client.pseudo} (${client.id})`);
    }

    // Chat broadcast
    if (msg.type === 'chat' && client.pseudo) {
      const chatPayload = {
        type: 'chat',
        pseudo: client.pseudo,
        color: client.color,
        message: msg.message,
      };
      for (const other of clients.keys()) {
        other.send(JSON.stringify(chatPayload));
      }
    }

    // Player movement
    if (msg.type === 'move' && client.pseudo) {
      client.x = msg.x;
      client.y = msg.y;
      const movePayload = {
        type: 'move',
        id: client.id,
        x: client.x,
        y: client.y,
        color: client.color
      };
      for (const other of clients.keys()) {
        other.send(JSON.stringify(movePayload));
      }
    }

    // Player shooting
    if (msg.type === 'shoot' && client.pseudo) {
      const idProj = 'p-' + randomUUID();

      const projectile = {
        id: idProj,
        from: client.id,
        x: msg.x,
        y: msg.y,
        angle: msg.angle,
        createdAt: Date.now()
      };
      projectiles.set(idProj, projectile);

      const projectilePayload = {
        type: 'projectile',
        id: projectile.id,
        from: projectile.from,
        x: projectile.x,
        y: projectile.y,
        angle: projectile.angle
      };
      for (const other of clients.keys()) {
        other.send(JSON.stringify(projectilePayload));
      }

      setTimeout(() => projectiles.delete(idProj), PROJECTILE_LIFETIME);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Spawn zombies at regular intervals
setInterval(() => {
  const id = 'z-' + randomUUID();
  const pos = randomPosition();
  const zombie = { id, x: pos.x, y: pos.y, targetId: null };
  zombies.set(id, zombie);

  // Inform all clients about new zombie
  const payload = {
    type: 'zombie_spawn',
    id: zombie.id,
    x: zombie.x,
    y: zombie.y
  };
  for (const ws of clients.keys()) {
    ws.send(JSON.stringify(payload));
  }

  console.log(`Zombie spawned: ${id}`);
}, ZOMBIE_SPAWN_INTERVAL * 1000);

// Server tick (60 FPS)
setInterval(() => {
  const now = Date.now();

  // --- Projectiles ---
  for (const [idProj, proj] of projectiles) {
    const vx = Math.cos(proj.angle) * PROJECTILE_SPEED / 60;
    const vy = Math.sin(proj.angle) * PROJECTILE_SPEED / 60;
    proj.x += vx;
    proj.y += vy;

    // Check collision with players
    for (const client of clients.values()) {
      if (client.id === proj.from) continue;
      if (!client.pseudo) continue;

      if (distance(proj, client) < PLAYER_RADIUS + PROJECTILE_RADIUS) {
        const newPos = randomPosition();
        client.x = newPos.x;
        client.y = newPos.y;

        const respawnPayload = {
          type: 'respawn',
          id: client.id,
          x: client.x,
          y: client.y
        };
        for (const other of clients.keys()) {
          other.send(JSON.stringify(respawnPayload));
        }

        projectiles.delete(idProj);
        break;
      }
    }

    // Check collision with zombies
    for (const [zId, zombie] of zombies) {
      if (distance(proj, zombie) < ZOMBIE_RADIUS + PROJECTILE_RADIUS) {
        // Remove zombie
        zombies.delete(zId);

        const removePayload = {
          type: 'zombie_remove',
          id: zId
        };
        for (const ws of clients.keys()) {
          ws.send(JSON.stringify(removePayload));
        }

        projectiles.delete(idProj);
        console.log(`Zombie ${zId} killed by projectile`);
        break;
      }
    }

    // Lifetime expiration
    if (now - proj.createdAt > PROJECTILE_LIFETIME) {
      projectiles.delete(idProj);
      continue;
    }
  }

  // --- Zombies ---
  for (const zombie of zombies.values()) {
    // Find the closest player
    if (!zombie.targetId || ![...clients.values()].find(c => c.id === zombie.targetId)) {
      let closest = null;
      let minDist = Infinity;
      for (const client of clients.values()) {
        if (!client.pseudo) continue;
        const d = distance(zombie, client);
        if (d < minDist) {
          minDist = d;
          closest = client.id;
        }
      }
      zombie.targetId = closest;
    }

    const target = [...clients.values()].find(c => c.id === zombie.targetId);
    if (!target) continue;

    // Move toward target
    const dx = target.x - zombie.x;
    const dy = target.y - zombie.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      zombie.x += (dx / len) * (ZOMBIE_SPEED / 60);
      zombie.y += (dy / len) * (ZOMBIE_SPEED / 60);
    }

    // Send zombie position to all clients
    const movePayload = {
      type: 'zombie_move',
      id: zombie.id,
      x: zombie.x,
      y: zombie.y
    };
    for (const ws of clients.keys()) {
      ws.send(JSON.stringify(movePayload));
    }

    // Collision with player
    for (const client of clients.values()) {
      if (!client.pseudo) continue;
      if (distance(zombie, client) < PLAYER_RADIUS + ZOMBIE_RADIUS) {
        const newPos = randomPosition();
        client.x = newPos.x;
        client.y = newPos.y;

        const respawnPayload = {
          type: 'respawn',
          id: client.id,
          x: client.x,
          y: client.y
        };
        for (const other of clients.keys()) {
          other.send(JSON.stringify(respawnPayload));
        }

        console.log(`${client.pseudo} was caught by zombie ${zombie.id}`);
      }
    }
  }
}, 1000 / 60);

// Start server
server.listen(3000, () => {
  console.log('Server listening on http://127.0.0.1:3000');
});
