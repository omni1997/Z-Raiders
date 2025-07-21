const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));

const clients = new Map();

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
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
