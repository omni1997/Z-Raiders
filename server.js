const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));

// Map of connected clients: ws → { id, color, pseudo, x, y }
const clients = new Map();

// Map of projectiles for server-side collision detection only
const projectiles = new Map();

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const PLAYER_RADIUS = 20;
const PROJECTILE_RADIUS = 4;
const PROJECTILE_SPEED = 400;
const PROJECTILE_LIFETIME = 1500;

// Generate random color in hex
function getRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

// Generate a random position on the map
function randomPosition() {
  return {
    x: Math.floor(Math.random() * MAP_WIDTH),
    y: Math.floor(Math.random() * MAP_HEIGHT)
  };
}

// Calculate distance between two points
function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

wss.on('connection', (ws) => {
  const color = getRandomColor();
  const id = randomUUID();
  const pos = randomPosition();

  // Add client to map with initial position and color
  clients.set(ws, { id, color, pseudo: null, x: pos.x, y: pos.y });

  // Send initial info to client
  ws.send(JSON.stringify({ type: 'init', id, color }));

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    const client = clients.get(ws);
    if (!client) return;

    // Handle pseudo registration
    if (msg.type === 'pseudo') {
      client.pseudo = msg.pseudo;
      ws.send(JSON.stringify({ type: 'confirm', pseudo: client.pseudo }));

      // Spawn initial position on client
      const spawnPayload = {
        type: 'respawn',
        id: client.id,
        x: client.x,
        y: client.y
      };
      ws.send(JSON.stringify(spawnPayload));

      console.log(`Connected: ${client.pseudo} (${client.id})`);
    }

    // Broadcast chat messages
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

    // Update player position and broadcast
    if (msg.type === 'move' && client.pseudo) {
      const speed = 200 / 60; // vitesse par tick (approx)
      
      // Calcul de la nouvelle position côté serveur
      client.x += msg.vx / 60; 
      client.y += msg.vy / 60;

      // Clamp pour rester dans la map
      client.x = Math.max(PLAYER_RADIUS, Math.min(MAP_WIDTH - PLAYER_RADIUS, client.x));
      client.y = Math.max(PLAYER_RADIUS, Math.min(MAP_HEIGHT - PLAYER_RADIUS, client.y));

      // Envoi de la position validée à tous les clients
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

    // Handle shooting
    if (msg.type === 'shoot' && client.pseudo) {
      const idProj = 'p-' + randomUUID();

      // Store projectile on server only for collision detection
      const projectile = {
        id: idProj,
        from: client.id,
        x: msg.x,
        y: msg.y,
        angle: msg.angle,
        createdAt: Date.now()
      };
      projectiles.set(idProj, projectile);

      // Payload sent once to all clients to spawn projectile
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

      // Auto-remove projectile after lifetime
      setTimeout(() => projectiles.delete(idProj), PROJECTILE_LIFETIME);
    }
  });

  // Remove client on disconnect
  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Server-side tick loop to detect collisions (60 FPS)
setInterval(() => {
  const now = Date.now();

  for (const [idProj, proj] of projectiles) {

    // Move projectile server-side for collision only
    const vx = Math.cos(proj.angle) * PROJECTILE_SPEED / 60;
    const vy = Math.sin(proj.angle) * PROJECTILE_SPEED / 60;
    proj.x += vx;
    proj.y += vy;

    // Check collision with all players except the shooter
    for (const client of clients.values()) {
      if (client.id === proj.from) continue;
      if (!client.pseudo) continue;

      if (distance(proj, client) < PLAYER_RADIUS + PROJECTILE_RADIUS) {
        // Player hit → respawn at random position
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

        // Remove projectile after hit
        projectiles.delete(idProj);
        break;
      }
    }

    // Remove projectile after lifetime
    if (now - proj.createdAt > PROJECTILE_LIFETIME) {
      projectiles.delete(idProj);
      continue;
    }
  }
}, 1000 / 60);

// Start server
server.listen(3000, () => {
  console.log('Server listening on http://127.0.0.1:3000');
});
