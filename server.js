const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from the "public" directory
app.use(express.static('public'));

// In-memory storage of connected clients
const clients = new Map();

// Utility function to generate a random hex color
function getRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  const color = getRandomColor();        // Generate a random color
  const id = randomUUID();               // Generate a unique ID

  // Store client information in memory
  clients.set(ws, { id, color, pseudo: null });

  // Send the ID and color to the connected client
  ws.send(JSON.stringify({ type: 'init', id, color }));

  // Handle incoming messages from the client
  ws.on('message', (data) => {
    const msg = JSON.parse(data);

    // Handle pseudo submission
    if (msg.type === 'pseudo') {
      const client = clients.get(ws);
      if (client) {
        client.pseudo = msg.pseudo;

        console.log(`Client connected: ${client.pseudo} (id: ${client.id}, color: ${client.color})`);

        // Optional: send confirmation back to the client
        ws.send(JSON.stringify({ type: 'confirm', pseudo: msg.pseudo }));
      }
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Start HTTP + WebSocket server
server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
