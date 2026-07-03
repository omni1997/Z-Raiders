require('dotenv').config();

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const { clients } = require('./state');
const { getRandomColor, randomPosition } = require('./utils');
const { handleMessage } = require('./messageHandler');
const { startGameLoop } = require('./gameLoop');
const { getTopPlayers } = require('./scoreStore');
const { consumeToken } = require('./resetTokens');
const { setPassword } = require('./accountStore');
const db = require('./db');
const log = require('./logger');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));
app.use(express.json());

// Landing page for the reset link sent by email — validates the token and
// sets the new password. Plain HTTP since it's opened from an email client,
// not from an active game WebSocket session.
app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const email = consumeToken(token);
  if (!email) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }
  await setPassword(email, password);
  log.info(`Password reset for ${email}`);
  res.json({ ok: true });
});

wss.on('connection', (ws) => {
  const color = getRandomColor();
  const id = randomUUID();
  const pos = randomPosition();

  clients.set(ws, { id, color, pseudo: null, x: pos.x, y: pos.y });

  // Attach listeners synchronously so no message sent right after connecting
  // is missed while the leaderboard fetch below is still in flight.
  ws.on('message', (data) => handleMessage(ws, data));
  ws.on('close', () => clients.delete(ws));

  ws.send(JSON.stringify({ type: 'init', id, color }));
  getTopPlayers().then((topPlayers) => {
    ws.send(JSON.stringify({ type: 'login_top_players', topPlayers }));
  });
});

const PORT = process.env.PORT || 3000;

db.initSchema()
  .then(() => {
    startGameLoop();
    server.listen(PORT, () => console.log(`Server listening on http://127.0.0.1:${PORT}`));
  })
  .catch((err) => {
    log.error(`Failed to initialize database: ${err.message}`);
    process.exit(1);
  });