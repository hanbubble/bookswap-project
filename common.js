// ── Firebase 초기화 ───────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC_Q9TMiRoNV0lHw9kxL0TagT9B4ZWPPV8",
  authDomain: "bookswap-94dc2.firebaseapp.com",
  databaseURL: "https://bookswap-94dc2-default-rtdb.firebaseio.com",
  projectId: "bookswap-94dc2",
  storageBucket: "bookswap-94dc2.firebasestorage.app",
  messagingSenderId: "198519480023",
  appId: "1:198519480023:web:68c0c0fcfb867b9b371a92"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ── Auth & core helpers ───────────────────────────────────
function getCurrentUser() { try { return JSON.parse(sessionStorage.getItem('currentUser')); } catch { return null; } }
function checkAuth()      { const u = getCurrentUser(); if (!u) window.location.href = 'login.html'; return u; }
function generateId()     { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function getUserColor(userId) {
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  if (user && user.color) return user.color;
  const idx = users.findIndex(u => u.id === userId);
  return USER_COLORS[(idx < 0 ? 0 : idx) % USER_COLORS.length];
}

function hexToPastel(hex, blend = 0.38) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const pr = Math.round(r + (255 - r) * blend);
  const pg = Math.round(g + (255 - g) * blend);
  const pb = Math.round(b + (255 - b) * blend);
  return `rgb(${pr},${pg},${pb})`;
}
