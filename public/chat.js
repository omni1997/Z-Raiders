import { socket } from './socket.js';

const pseudoInput = document.getElementById('pseudo');
const sendPseudoBtn = document.getElementById('send');
const messageInput = document.getElementById('message');
const sendMsgBtn = document.getElementById('send-msg');

sendPseudoBtn.addEventListener('click', sendPseudo);
pseudoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendPseudo();
});

export function sendPseudo() {
  const value = pseudoInput.value.trim();
  if (value) {
    socket.send(JSON.stringify({ type: 'pseudo', pseudo: value }));
  }
}

sendMsgBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

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
  div.className = 'flex items-center mb-1';

  const colorBox = document.createElement('div');
  colorBox.className = 'w-4 h-4 mr-2 border border-black';
  colorBox.style.backgroundColor = data.color;

  const text = document.createElement('span');
  text.innerText = `${data.pseudo}: ${data.message}`;

  div.appendChild(colorBox);
  div.appendChild(text);
  msgList.appendChild(div);
  msgList.scrollTop = msgList.scrollHeight;
}

export function confirmPseudo(pseudo) {
  pseudoInput.remove();
  sendPseudoBtn.remove();

  const confirmed = document.createElement('div');
  confirmed.innerText = `Username: ${pseudo}`;
  document.getElementById('form').appendChild(confirmed);
  document.getElementById('chat').style.display = 'block';
}