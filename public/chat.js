import { socket } from './socket.js';

const messageInput = document.getElementById('message');
const sendMsgBtn = document.getElementById('send-msg');

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
