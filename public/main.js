const socket = new WebSocket(`ws://${location.host}`);

let id = null;
let color = null;
let pseudo = null;

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'init') {
    id = data.id;
    color = data.color;
    document.getElementById('color-box').style.backgroundColor = color;
    document.getElementById('info').innerText = `ID: ${id} | Color: ${color}`;
  }

  if (data.type === 'confirm') {
    pseudo = data.pseudo;

    // Remove input and button
    document.getElementById('pseudo').remove();
    document.getElementById('send').remove();

    // Show confirmed username
    const confirmed = document.createElement('div');
    confirmed.innerText = `Username: ${pseudo}`;
    document.getElementById('form').appendChild(confirmed);

    // Show chat
    document.getElementById('chat').style.display = 'block';
  }

  if (data.type === 'chat') {
    addMessage(data);
  }
});

document.getElementById('send').addEventListener('click', () => {
  const input = document.getElementById('pseudo');
  const value = input.value.trim();
  if (value) {
    socket.send(JSON.stringify({ type: 'pseudo', pseudo: value }));
  }
});

document.getElementById('send-msg').addEventListener('click', () => {
  const input = document.getElementById('message');
  const message = input.value.trim();
  if (message) {
    socket.send(JSON.stringify({ type: 'chat', message }));
    input.value = '';
  }
});

function addMessage(data) {
  const msgList = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message';

  const colorBox = document.createElement('div');
  colorBox.className = 'chat-color';
  colorBox.style.backgroundColor = data.color;

  const text = document.createElement('span');
  text.innerText = `${data.pseudo}: ${data.message}`;

  div.appendChild(colorBox);
  div.appendChild(text);
  msgList.appendChild(div);
  msgList.scrollTop = msgList.scrollHeight;
}
