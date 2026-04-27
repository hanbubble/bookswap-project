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
function getCurrentUser() { try { return JSON.parse(localStorage.getItem('currentUser')); } catch { return null; } }
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

let _roomColors = {}; // 방별 색상 캐시 (각 페이지에서 채워짐)

function getUserColor(userId) {
  if (_roomColors[userId]) return _roomColors[userId];
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  return USER_COLORS[(idx < 0 ? 0 : idx) % USER_COLORS.length];
}

function goLastRoom() {
  const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (!user) { window.location.href = 'waiting.html'; return; }

  db.ref('userRooms/' + user.id).once('value', snap => {
    if (!snap.exists()) { window.location.href = 'waiting.html'; return; }
    const rooms = Object.values(snap.val());
    const latest = rooms.sort((a, b) => (b.lastVisited || b.savedAt || 0) - (a.lastVisited || a.savedAt || 0))[0];
    if (latest) window.location.href = `home.html?roomId=${latest.roomId}`;
    else window.location.href = 'waiting.html';
  });
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
