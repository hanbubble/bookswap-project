// ── Seeded PRNG (LCG) ─────────────────────────────────────────────────
function _rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}

// ── Palette ───────────────────────────────────────────────────────────
const _PAL = [
  '#E8879A','#C23050','#A82040',
  '#2B3A6E','#1E2B5A',
  '#8BC66A','#6A9A40',
  '#E8C840',
  '#5BA8D4','#7AD4C0',
  '#F5E6C8','#FAD8E8'
];

// ── Patch type 0: 꽃무늬 ──────────────────────────────────────────────
function _pFlower(ctx, ox, oy, S, col, rng) {
  const cols = 4, rows = 4;
  const stepX = S / cols, stepY = S / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = ox + stepX * (col + 0.5);
      const cy = oy + stepY * (row + 0.5);
      const pr = 1.2 + rng() * 1.5;
      ctx.fillStyle = col; ctx.globalAlpha = 0.82;
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * pr * 1.7, cy + Math.sin(a) * pr * 1.7, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FFE566'; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(cx, cy, pr * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ── Patch type 1: 폴카 도트 ──────────────────────────────────────────
function _pDots(ctx, ox, oy, S, col) {
  ctx.fillStyle = col; ctx.globalAlpha = 1;
  const spacing = 18, r = 5;
  for (let dy = spacing / 2; dy < S; dy += spacing)
    for (let dx = spacing / 2; dx < S; dx += spacing) {
      ctx.beginPath();
      ctx.arc(ox + dx, oy + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.globalAlpha = 1;
}

// ── Patch type 2: 세로 스트라이프 ────────────────────────────────────
function _pVStripe(ctx, ox, oy, S, col) {
  ctx.fillStyle = col; ctx.globalAlpha = 0.55;
  for (let dx = 1; dx < S; dx += 7) ctx.fillRect(ox + dx, oy, 3, S);
  ctx.globalAlpha = 1;
}

// ── Patch type 3: 체크/플레이드 ──────────────────────────────────────
function _pPlaid(ctx, ox, oy, S, col) {
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.5;
  for (let dx = 0; dx < S; dx += 13) ctx.fillRect(ox + dx, oy, 6, S);
  ctx.globalAlpha = 0.38;
  for (let dy = 0; dy < S; dy += 13) ctx.fillRect(ox, oy + dy, S, 6);
  ctx.globalAlpha = 1;
}

// ── Patch type 4: 사선 스트라이프 ────────────────────────────────────
function _pDiag(ctx, ox, oy, S, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = 0.5;
  for (let i = -S; i < S * 2; i += 10) {
    ctx.beginPath(); ctx.moveTo(ox + i, oy); ctx.lineTo(ox + i + S, oy + S); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── Patch type 5: 딸기 이모지 ────────────────────────────────────────
function _pShapes(ctx, ox, oy, S, col, rng) {
  const cols = 3, rows = 3;
  const stepX = S / cols, stepY = S / rows;
  const fontSize = stepX * 0.62;
  ctx.font = fontSize + 'px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = ox + stepX * (col + 0.5);
      const cy = oy + stepY * (row + 0.5);
      ctx.fillText('🍓', cx, cy);
    }
  }
}

// ── Main: 패치워크 퀼트 배경 ──────────────────────────────────────────
function drawPatchwork() {
  const oc = document.createElement('canvas');
  const DIM  = 720;
  oc.width = oc.height = DIM;
  const ctx  = oc.getContext('2d');
  const S    = 120;
  const COLS = 6, ROWS = 6, NT = 6, NP = _PAL.length;
  const rng  = _rng(20250401);

  // 타입 그리드: 인접한 패치 타입 겹치지 않게
  const tg = Array.from({length: ROWS}, () => new Array(COLS));
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      let t;
      do { t = rng() * NT | 0; }
      while ((c > 0 && tg[r][c-1] === t) || (r > 0 && tg[r-1][c] === t));
      tg[r][c] = t;
    }

  // 배경색 그리드: 인접한 색 겹치지 않게
  const cg = Array.from({length: ROWS}, () => new Array(COLS));
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      let ci;
      do { ci = rng() * NP | 0; }
      while ((c > 0 && cg[r][c-1] === ci) || (r > 0 && cg[r-1][c] === ci));
      cg[r][c] = ci;
    }

  const fns = [_pFlower, _pDots, _pVStripe, _pPlaid, _pDiag, _pShapes];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ox = c * S, oy = r * S;
      const bi = cg[r][c];
      const ai = (bi + 2 + (rng() * 8 | 0)) % NP;  // 액센트색 (bg와 다르게)
      const pr = _rng(r * 97 + c * 53 + tg[r][c] * 17 + 3);

      const angle = (rng() - 0.5) * 0.2;  // ±~6° 랜덤 회전

      ctx.save();
      ctx.beginPath(); ctx.rect(ox, oy, S, S); ctx.clip();
      ctx.fillStyle = _PAL[bi]; ctx.fillRect(ox, oy, S, S);

      // 패치 경계는 그대로, 패턴만 회전
      ctx.save();
      ctx.translate(ox + S / 2, oy + S / 2);
      ctx.rotate(angle);
      fns[tg[r][c]](ctx, -S / 2, -S / 2, S, _PAL[ai], pr);
      ctx.restore();

      ctx.restore();
    }
  }

  // 실밥 경계선: 점선 그림자 1px + 점선 흰 2px
  ctx.setLineDash([4, 4]);
  for (let i = 0; i <= COLS; i++) {
    const x = i * S;
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 1.5, 0); ctx.lineTo(x + 1.5, DIM); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, DIM); ctx.stroke();
  }
  for (let i = 0; i <= ROWS; i++) {
    const y = i * S;
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y + 1.5); ctx.lineTo(DIM, y + 1.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(DIM, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // body 배경으로 적용
  document.body.style.backgroundImage = 'url(' + oc.toDataURL() + ')';
  document.body.style.backgroundRepeat = 'repeat';
}

document.addEventListener('DOMContentLoaded', drawPatchwork);

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', (i===0&&tab==='login')||(i===1&&tab==='signup')));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-'+tab).classList.add('active');
}

function togglePw(id, btn) {
  const el = document.getElementById(id);
  el.type = el.type==='password' ? 'text' : 'password';
  btn.textContent = el.type==='password' ? '👁' : '🙈';
}

function showError(inputEl, msg) {
  const old = inputEl.parentElement.parentElement.querySelector('.error-msg');
  if (old) old.remove();
  const span = document.createElement('span');
  span.className = 'error-msg';
  span.textContent = msg;
  inputEl.parentElement.parentElement.appendChild(span);
  inputEl.classList.add('shake');
  setTimeout(() => { inputEl.classList.remove('shake'); span.remove(); }, 2000);
}

function handleSignup(e) {
  e.preventDefault();
  const nameEl = document.getElementById('signup-name');
  const pwEl   = document.getElementById('signup-pw');
  const name = nameEl.value.trim(), pw = pwEl.value.trim();
  if (!name) { showError(nameEl, '닉네임을 입력해주세요'); return; }
  if (!pw)   { showError(pwEl,   '비밀번호를 입력해주세요'); return; }

  Promise.all([
    db.ref('users').once('value'),
    db.ref('pendingUsers').once('value'),
  ]).then(([uSnap, pSnap]) => {
    const existing = [
      ...Object.values(uSnap.exists() ? uSnap.val() : {}),
      ...Object.values(pSnap.exists() ? pSnap.val() : {}),
    ];
    if (existing.some(u => u.name === name)) {
      showError(nameEl, '이미 사용 중인 닉네임이에요'); return;
    }
    const newUser = { id: generateId(), name, password: pw };
    // 관리자는 바로 승인
    const ref = name === '문서희' ? 'users' : 'pendingUsers';
    db.ref(ref + '/' + newUser.id).set(newUser, () => {
      nameEl.value = ''; pwEl.value = '';
      const msg = document.getElementById('signup-success');
      msg.textContent = name === '문서희'
        ? '🎉 가입 완료! 로그인해보세요!'
        : '✉ 가입 신청 완료! 관리자 승인 후 로그인 가능해요.';
      msg.style.display = 'block';
      setTimeout(() => {
        msg.style.display = 'none';
        switchTab('login');
        document.getElementById('login-name').value = name;
      }, 2200);
    });
  });
}

function handleLogin(e) {
  e.preventDefault();
  const nameEl = document.getElementById('login-name');
  const pwEl   = document.getElementById('login-pw');
  const name = nameEl.value.trim(), pw = pwEl.value.trim();
  if (!name) { showError(nameEl, '닉네임을 입력해주세요'); return; }
  if (!pw)   { showError(pwEl,   '비밀번호를 입력해주세요'); return; }

  db.ref('users').once('value', snap => {
    const users = Object.values(snap.exists() ? snap.val() : {});
    const user  = users.find(u => u.name === name && u.password === pw);
    if (user) {
      sessionStorage.setItem('currentUser', JSON.stringify({ id: user.id, name: user.name }));
      window.location.href = 'index.html';
      return;
    }
    // 대기 중인지 확인
    db.ref('pendingUsers').once('value', pSnap => {
      const pending = Object.values(pSnap.exists() ? pSnap.val() : {});
      if (pending.some(u => u.name === name && u.password === pw)) {
        showError(pwEl, '아직 관리자 승인 대기 중이에요 🕐');
      } else {
        showError(pwEl, '닉네임 또는 비밀번호가 올바르지 않아요');
      }
    });
  });
}

// ── 별 파티클 효과 ────────────────────────────────────────────────────
function spawnSparkles(btn) {
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const symbols = ['🍀', '✨', '🍥', '🍓'];

  for (let i = 0; i < 10; i++) {
    const el = document.createElement('span');
    el.textContent = symbols[i % symbols.length];
    const size = 12 + Math.random() * 14;
    el.style.cssText = `
      position:fixed; left:${cx}px; top:${cy}px;
      font-size:${size}px; pointer-events:none; z-index:9999;
      transform:translate(-50%,-50%); opacity:1;
      transition:transform 0.65s ease-out, opacity 0.65s ease-out, font-size 0.65s ease-out;
    `;
    document.body.appendChild(el);

    const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
    const dist  = 55 + Math.random() * 45;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random()*360}deg)`;
      el.style.opacity   = '0';
      el.style.fontSize  = (size * 1.6) + 'px';
    }));

    setTimeout(() => el.remove(), 700);
  }
}

function fitBgWords() {
  const container = document.querySelector('.bg-mobile');
  if (!container) return;
  const w = window.innerWidth * 0.97;
  container.querySelectorAll('span').forEach(span => {
    span.style.fontSize = '100px';
    span.style.display = 'inline-block';
    const textWidth = span.offsetWidth;
    span.style.display = '';
    span.style.fontSize = (100 * w / textWidth) + 'px';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.submit-btn').forEach(btn => {
    btn.addEventListener('click', () => spawnSparkles(btn));
  });
  document.fonts.ready.then(fitBgWords);
});

window.addEventListener('resize', fitBgWords);

if (getCurrentUser()) window.location.href = 'index.html';
