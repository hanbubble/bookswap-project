const currentUser = checkAuth();

// ── 패치워크 배경 ──────────────────────────────────────────
const _PAL = ['#E8879A','#C23050','#A82040','#2B3A6E','#1E2B5A','#8BC66A','#6A9A40','#E8C840','#5BA8D4','#7AD4C0','#F5E6C8','#FAD8E8'];
function _rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296};}
function _pFlower(ctx,ox,oy,S,col,rng){const cols=4,rows=4,stepX=S/cols,stepY=S/rows;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const cx=ox+stepX*(c+.5),cy=oy+stepY*(r+.5),pr=1.2+rng()*1.5;ctx.fillStyle=col;ctx.globalAlpha=.82;for(let p=0;p<5;p++){const a=p/5*Math.PI*2;ctx.beginPath();ctx.arc(cx+Math.cos(a)*pr*1.7,cy+Math.sin(a)*pr*1.7,pr,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#FFE566';ctx.globalAlpha=1;ctx.beginPath();ctx.arc(cx,cy,pr*.6,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
function _pDots(ctx,ox,oy,S,col){ctx.fillStyle=col;ctx.globalAlpha=1;const sp=18,r=5;for(let dy=sp/2;dy<S;dy+=sp)for(let dx=sp/2;dx<S;dx+=sp){ctx.beginPath();ctx.arc(ox+dx,oy+dy,r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
function _pVStripe(ctx,ox,oy,S,col){ctx.fillStyle=col;ctx.globalAlpha=.55;for(let dx=1;dx<S;dx+=7)ctx.fillRect(ox+dx,oy,3,S);ctx.globalAlpha=1;}
function _pPlaid(ctx,ox,oy,S,col){ctx.fillStyle=col;ctx.globalAlpha=.5;for(let dx=0;dx<S;dx+=13)ctx.fillRect(ox+dx,oy,6,S);ctx.globalAlpha=.38;for(let dy=0;dy<S;dy+=13)ctx.fillRect(ox,oy+dy,S,6);ctx.globalAlpha=1;}
function _pDiag(ctx,ox,oy,S,col){ctx.strokeStyle=col;ctx.lineWidth=3;ctx.globalAlpha=.5;for(let i=-S;i<S*2;i+=10){ctx.beginPath();ctx.moveTo(ox+i,oy);ctx.lineTo(ox+i+S,oy+S);ctx.stroke();}ctx.globalAlpha=1;}
function _pShapes(ctx,ox,oy,S,col,rng){const cols=3,rows=3,stepX=S/cols,stepY=S/rows,fs=stepX*.62;ctx.font=fs+'px MonaS12,serif';ctx.textAlign='center';ctx.textBaseline='middle';for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)ctx.fillText('🍓',ox+stepX*(c+.5),oy+stepY*(r+.5));}
function drawPatchwork(){const canvas=document.getElementById('bg-canvas');const DIM=720;canvas.width=canvas.height=DIM;const ctx=canvas.getContext('2d'),S=120,COLS=6,ROWS=6,NT=6,NP=_PAL.length,rng=_rng(20250401);const tg=Array.from({length:ROWS},()=>new Array(COLS));for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){let t;do{t=rng()*NT|0;}while((c>0&&tg[r][c-1]===t)||(r>0&&tg[r-1][c]===t));tg[r][c]=t;}const cg=Array.from({length:ROWS},()=>new Array(COLS));for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){let ci;do{ci=rng()*NP|0;}while((c>0&&cg[r][c-1]===ci)||(r>0&&cg[r-1][c]===ci));cg[r][c]=ci;}const fns=[_pFlower,_pDots,_pVStripe,_pPlaid,_pDiag,_pShapes];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const ox=c*S,oy=r*S,bi=cg[r][c],ai=(bi+2+(rng()*8|0))%NP,pr=_rng(r*97+c*53+tg[r][c]*17+3),angle=(rng()-.5)*.2;ctx.save();ctx.beginPath();ctx.rect(ox,oy,S,S);ctx.clip();ctx.fillStyle=_PAL[bi];ctx.fillRect(ox,oy,S,S);ctx.save();ctx.translate(ox+S/2,oy+S/2);ctx.rotate(angle);fns[tg[r][c]](ctx,-S/2,-S/2,S,_PAL[ai],pr);ctx.restore();ctx.restore();}ctx.setLineDash([4,4]);for(let i=0;i<=COLS;i++){const x=i*S;ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+1.5,0);ctx.lineTo(x+1.5,DIM);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,DIM);ctx.stroke();}for(let i=0;i<=ROWS;i++){const y=i*S;ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y+1.5);ctx.lineTo(DIM,y+1.5);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(DIM,y);ctx.stroke();}ctx.setLineDash([]);}
document.addEventListener('DOMContentLoaded', () => {
  document.fonts.load('20px MonaS12').then(drawPatchwork).catch(drawPatchwork);
});

// ── UI helpers ─────────────────────────────────────────────
function switchTab(tab) {
  ['create', 'join'].forEach(t => {
    document.getElementById('panel-' + t).classList.toggle('active', t === tab);
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
}

function togglePw(id, btn) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁' : '🙈';
}

function showFieldError(inputEl, msg) {
  inputEl.closest('.form-group').querySelector('.error-msg')?.remove();
  const span = document.createElement('span');
  span.className = 'error-msg';
  span.textContent = msg;
  inputEl.closest('.form-group').appendChild(span);
  inputEl.classList.add('shake');
  setTimeout(() => { inputEl.classList.remove('shake'); span.remove(); }, 2200);
}

// ── 참여 이력 (Firebase) ──────────────────────────────────
function saveRoomToHistory(roomId, name) {
  db.ref('userRooms/' + currentUser.id + '/' + roomId).set({ roomId, name, savedAt: Date.now() });
  db.ref('rooms/' + roomId + '/registeredMembers/' + currentUser.id).set({ id: currentUser.id, name: currentUser.name });
}

async function loadMyRooms() {
  const section = document.getElementById('my-rooms-section');
  const list    = document.getElementById('my-rooms-list');

  const snap = await db.ref('userRooms/' + currentUser.id).once('value');
  if (!snap.exists()) return;

  const rooms = Object.values(snap.val()).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

  // Firebase에서 방 존재 여부 일괄 확인
  const snaps = await Promise.all(rooms.map(r => db.ref('rooms/' + r.roomId + '/name').once('value')));

  list.innerHTML = '';
  let validCount = 0;

  rooms.forEach((room, i) => {
    if (!snaps[i].exists()) return; // 삭제된 방 제외
    validCount++;

    const item = document.createElement('div');
    item.className = 'my-room-item';

    const info = document.createElement('div');
    info.className = 'my-room-info';

    const nameEl = document.createElement('div');
    nameEl.className   = 'my-room-name';
    nameEl.textContent = snaps[i].val() || room.name || '이름 없는 방';
    info.appendChild(nameEl);

    const codeEl = document.createElement('div');
    codeEl.className   = 'my-room-code';
    codeEl.textContent = room.roomId;
    info.appendChild(codeEl);

    item.appendChild(info);

    const btn = document.createElement('button');
    btn.className   = 'my-room-enter';
    btn.textContent = 'ENTER ROOM ▶';
    btn.onclick = () => { window.location.href = 'home.html?roomId=' + room.roomId; };
    item.appendChild(btn);

    list.appendChild(item);
  });

  if (validCount > 0) section.classList.remove('hidden');
}

loadMyRooms();

// ── roomId 생성 ───────────────────────────────────────────
// 혼동하기 쉬운 문자(0,O,1,I,L) 제외
function generateRoomId() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── 방 만들기 ─────────────────────────────────────────────
let _createdRoomId = null;

async function createRoom() {
  const nameEl = document.getElementById('create-name');
  const pwEl   = document.getElementById('create-pw');
  const name   = nameEl.value.trim();
  const pw     = pwEl.value.trim();
  if (!name) { showFieldError(nameEl, '방 이름을 입력해주세요'); return; }
  if (!pw)   { showFieldError(pwEl,   '비밀번호를 입력해주세요'); return; }

  const btn = document.getElementById('create-btn');
  btn.disabled = true;
  btn.textContent = '만드는 중...';

  try {
    // 중복 없는 roomId 확보
    let roomId, attempts = 0;
    do {
      roomId = generateRoomId();
      const snap = await db.ref('rooms/' + roomId).once('value');
      if (!snap.exists()) break;
    } while (++attempts < 10);

    await db.ref('rooms/' + roomId).set({
      name:      name,
      password:  pw,
      createdBy: currentUser.id,
      createdAt: Date.now(),
      members:   {}
    });

    _createdRoomId = roomId;
    saveRoomToHistory(roomId, name);
    document.getElementById('room-code-display').textContent = roomId;
    document.getElementById('create-result').classList.remove('hidden');
    showToast('방이 만들어졌어요! 🎉');
  } catch {
    showToast('방 생성 중 오류가 발생했어요', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'CREATE ROOM';
  }
}

async function copyRoomCode() {
  if (!_createdRoomId) return;
  try {
    await navigator.clipboard.writeText(_createdRoomId);
    const btn = document.getElementById('copy-btn');
    btn.textContent = '복사됨 ✓';
    setTimeout(() => { btn.textContent = '복사'; }, 1600);
  } catch {
    showToast('복사에 실패했어요', true);
  }
}

function enterCreatedRoom() {
  if (!_createdRoomId) return;
  window.location.href = 'home.html?roomId=' + _createdRoomId;
}

// ── 방 참여하기 ───────────────────────────────────────────
async function joinRoom() {
  const codeEl = document.getElementById('join-code');
  const pwEl   = document.getElementById('join-pw');
  const code   = codeEl.value.trim().toUpperCase();
  const pw     = pwEl.value.trim();

  if (code.length !== 6) { showFieldError(codeEl, '6자리 코드를 입력해주세요'); return; }
  if (!pw)               { showFieldError(pwEl,   '비밀번호를 입력해주세요');   return; }

  const btn = document.getElementById('join-btn');
  btn.disabled = true;
  btn.textContent = '확인 중...';

  try {
    const snap = await db.ref('rooms/' + code).once('value');
    if (!snap.exists()) { showFieldError(codeEl, '존재하지 않는 방이에요'); return; }

    const room = snap.val();
    if (room.password !== pw) { showFieldError(pwEl, '비밀번호가 틀렸어요'); return; }

    saveRoomToHistory(code, room.name || '');
    window.location.href = 'home.html?roomId=' + code;
  } catch {
    showToast('오류가 발생했어요', true);
  } finally {
    btn.disabled = false;
    btn.textContent = '입장하기 →';
  }
}
