const socket = new WebSocket(`ws://${location.host}`);

let id = null;
let color = null;

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'init') {
    id = data.id;
    color = data.color;
    document.body.style.backgroundColor = color;
    document.getElementById('info').innerText = `ID : ${id} | Couleur : ${color}`;
  }
});

document.getElementById('envoyer').addEventListener('click', () => {
  const pseudo = document.getElementById('pseudo').value.trim();
  if (pseudo) {
    socket.send(JSON.stringify({ type: 'pseudo', pseudo }));
  }
});
