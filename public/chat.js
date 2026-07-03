import { socket } from './socket.js';

const pseudoInput = document.getElementById('pseudo');
const sendPseudoBtn = document.getElementById('send');
const messageInput = document.getElementById('message');
const sendMsgBtn = document.getElementById('send-msg');

sendPseudoBtn.addEventListener('click', sendPseudo);
pseudoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendPseudo(); });

// Affiche le score personnel persisté pendant que le joueur tape son callsign
let lookupTimer = null;
pseudoInput.addEventListener('input', () => {
  const pseudo = pseudoInput.value.trim();
  clearTimeout(lookupTimer);
  if (!pseudo) {
    document.getElementById('stat-zombies').innerText = 0;
    document.getElementById('stat-players').innerText = 0;
    return;
  }
  lookupTimer = setTimeout(() => {
    socket.send(JSON.stringify({ type: 'lookup_score', pseudo }));
  }, 300);
});

export function sendPseudo() {
  const value = pseudoInput.value.trim();
  if (value) socket.send(JSON.stringify({ type: 'pseudo', pseudo: value }));
}

sendMsgBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

export function sendMessage() {
  const message = messageInput.value.trim();
  if (message) {
    socket.send(JSON.stringify({ type: 'chat', message }));
    messageInput.value = '';
  }
}

export function addMessage(data) {
  const msgList = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg-entry';

  const diamond = document.createElement('div');
  diamond.className = 'msg-color';
  diamond.style.backgroundColor = data.color;

  const text = document.createElement('span');
  text.style.color = '#aaa';
  const name = document.createElement('span');
  name.style.color = data.color;
  name.style.textShadow = `0 0 5px ${data.color}88`;
  name.innerText = data.pseudo;
  text.appendChild(name);
  text.appendChild(document.createTextNode(`: ${data.message}`));

  div.appendChild(diamond);
  div.appendChild(text);
  msgList.appendChild(div);
  msgList.scrollTop = msgList.scrollHeight;
}

export function confirmPseudo(pseudo) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('info').innerText = `▶ ${pseudo}`;
  document.getElementById('chat').style.display = 'flex';
}