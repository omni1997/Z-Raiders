const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const { clients } = require('./state');
const { getRandomColor, randomPosition } = require('./utils');
const { handleMessage } = require('./messageHandler');
const { startGameLoop } = require('./gameLoop');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));

wss.on('connection', (ws) => {
  const color = getRandomColor();
  const id = randomUUID();
  const pos = randomPosition();

  clients.set(ws, { id, color, pseudo: null, x: pos.x, y: pos.y });
  ws.send(JSON.stringify({ type: 'init', id, color }));

  ws.on('message', (data) => handleMessage(ws, data));
  ws.on('close', () => clients.delete(ws));
});

startGameLoop();

server.listen(3000, () => console.log('Server listening on http://127.0.0.1:3000'));