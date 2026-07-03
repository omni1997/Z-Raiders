import { socket } from './socket.js';

const loginScreen   = document.getElementById('login-screen');
const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const pseudoInput   = document.getElementById('pseudo');
const passwordField = document.getElementById('password-field');
const pseudoField   = document.getElementById('pseudo-field');
const submitBtn     = document.getElementById('auth-submit');
const toggleModeLink   = document.getElementById('toggle-mode');
const forgotLink       = document.getElementById('forgot-link');
const backToLoginLink  = document.getElementById('back-to-login');
const errorEl          = document.getElementById('auth-error');

let mode = 'login'; // 'login' | 'signup' | 'forgot'

function render() {
  pseudoField.style.display   = mode === 'signup' ? 'block' : 'none';
  passwordField.style.display = mode === 'forgot' ? 'none'  : 'block';
  forgotLink.style.display      = mode === 'login'  ? 'inline' : 'none';
  backToLoginLink.style.display = mode === 'forgot' ? 'inline' : 'none';
  toggleModeLink.style.display  = mode === 'forgot' ? 'none'   : 'inline';
  toggleModeLink.innerText = mode === 'login' ? 'Need an account? Sign up' : 'Already registered? Log in';
  submitBtn.innerText =
    mode === 'login'  ? '⚡ DEPLOY' :
    mode === 'signup' ? '⚡ CREATE ACCOUNT' : '✉ SEND RESET LINK';
  setError('');
}

function setError(message, ok = false) {
  errorEl.innerText = message;
  errorEl.style.color = ok ? '#44ff44' : 'var(--gore)';
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle('is-loading', loading);
}

toggleModeLink.addEventListener('click', (e) => {
  e.preventDefault();
  mode = mode === 'login' ? 'signup' : 'login';
  render();
});

forgotLink.addEventListener('click', (e) => {
  e.preventDefault();
  mode = 'forgot';
  render();
});

backToLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  mode = 'login';
  render();
});

submitBtn.addEventListener('click', submit);
[emailInput, passwordInput, pseudoInput].forEach((el) => {
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
});

function submit() {
  if (submitBtn.disabled) return;

  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  if (mode === 'forgot') {
    if (!email) return setError('Email required.');
    setLoading(true);
    socket.send(JSON.stringify({ type: 'forgot_password', email }));
    return;
  }

  if (!email || !password) return setError('Email and password required.');

  if (mode === 'signup') {
    const pseudo = pseudoInput.value.trim();
    if (!pseudo) return setError('Callsign required.');
    setLoading(true);
    socket.send(JSON.stringify({ type: 'signup', email, password, pseudo }));
  } else {
    setLoading(true);
    socket.send(JSON.stringify({ type: 'login', email, password }));
  }
}

export function handleAuthError(message) {
  setLoading(false);
  setError(message);
}

export function handleForgotPasswordSent() {
  setLoading(false);
  setError('If that email is registered, a reset link was sent.', true);
}

export function confirmAuth(pseudo) {
  setLoading(false);
  loginScreen.classList.add('hidden');
  document.getElementById('info').innerText = `▶ ${pseudo}`;
  document.getElementById('chat').style.display = 'flex';
}

render();
