const socket = new WebSocket(`ws://${location.host}`);

let id = null;
let color = null;
let pseudo = null;

// Listen for messages from the server
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'init') {
    // Initialization: receive id and color from server
    id = data.id;
    color = data.color;
    // Set color box background and display info
    document.getElementById('color-box').style.backgroundColor = color;
    document.getElementById('info').innerText = `ID: ${id} | Color: ${color}`;
  }

  if (data.type === 'confirm') {
    // Confirmation of pseudo set by user
    pseudo = data.pseudo;

    // Remove pseudo input and send button
    document.getElementById('pseudo').remove();
    document.getElementById('send').remove();

    // Display confirmed username
    const confirmed = document.createElement('div');
    confirmed.innerText = `Username: ${pseudo}`;
    document.getElementById('form').appendChild(confirmed);

    // Show chat section
    document.getElementById('chat').style.display = 'block';
  }

  if (data.type === 'chat') {
    // Receive chat message, add to chat window
    addMessage(data);
  }
});

// Get DOM elements for inputs and buttons
const pseudoInput = document.getElementById('pseudo');
const sendPseudoBtn = document.getElementById('send');
const messageInput = document.getElementById('message');
const sendMsgBtn = document.getElementById('send-msg');

// Send pseudo on button click or Enter key
sendPseudoBtn.addEventListener('click', sendPseudo);
pseudoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendPseudo();
});

// Function to send pseudo to server
function sendPseudo() {
  const value = pseudoInput.value.trim();
  if (value) {
    socket.send(JSON.stringify({ type: 'pseudo', pseudo: value }));
  }
}

// Send chat message on button click or Enter key
sendMsgBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Function to send chat message to server
function sendMessage() {
  const message = messageInput.value.trim();
  if (message) {
    socket.send(JSON.stringify({ type: 'chat', message }));
    // Clear input after sending
    messageInput.value = '';
  }
}

function addMessage(data) {
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
