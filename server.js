const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));

const clients = new Map();
const projectiles = new Map(); // id → { from, x, y, angle, createdAt }


function getRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

wss.on('connection', (ws) => {
  const color = getRandomColor();
  const id = randomUUID();
  clients.set(ws, { id, color, pseudo: null });

  ws.send(JSON.stringify({ type: 'init', id, color }));

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    const client = clients.get(ws);

    if (!client) return;

    if (msg.type === 'pseudo') {
      client.pseudo = msg.pseudo;
      ws.send(JSON.stringify({ type: 'confirm', pseudo: client.pseudo }));
      console.log(`Connected: ${client.pseudo} (${client.id})`);
    }

    if (msg.type === 'chat' && client.pseudo) {
      const payload = {
        type: 'chat',
        pseudo: client.pseudo,
        color: client.color,
        message: msg.message,
      };

      for (const other of clients.keys()) {
        other.send(JSON.stringify(payload));
      }
    }

    if (msg.type === 'move' && client.pseudo) {
      const payload = {
        type: 'move',
        id: client.id,
        x: msg.x,
        y: msg.y,
        color: client.color
      };
      for (const other of clients.keys()) {
        other.send(JSON.stringify(payload));
      }
    }

  if (msg.type === 'shoot' && client.pseudo) {
      const idProj = 'p-' + randomUUID();
      const projectile = {
        id: idProj,
        from: client.id,
        x: msg.x,
        y: msg.y,
        angle: msg.angle,
        color: '#ffffff',
        createdAt: Date.now()
      };
      projectiles.set(idProj, projectile);

      const payload = {
        type: 'projectile',
        ...projectile
      };

      for (const other of clients.keys()) {
        other.send(JSON.stringify(payload));
      }

      // auto-cleanup (1.5s)
      setTimeout(() => {
        projectiles.delete(idProj);
      }, 1500);
    }

  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

server.listen(3000, () => {
  console.log('Server listening on http://192.168.1.152:3000');
});

