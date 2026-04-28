// In-memory 캐시
let _books = [];
let _reviews = [];
let _users = [];

// roomId (room-scoped일 때만 존재)
let roomId = null;

function BOOKS_REF()   { return roomId ? db.ref(`rooms/${roomId}/books`)   : db.ref('books'); }
function REVIEWS_REF() { return roomId ? db.ref(`rooms/${roomId}/reviews`) : db.ref('reviews'); }

// 실시간 리스너
function setupRealtimeListeners() {
  BOOKS_REF().on('value', snap => {
    _books = snap.exists() ? Object.values(snap.val()) : [];
  });
  REVIEWS_REF().on('value', snap => {
    _reviews = snap.exists() ? Object.values(snap.val()) : [];
    if (typeof loadBook === 'function' && currentBook) loadBook();
    if (typeof loadReviews === 'function' && currentBook) loadReviews();
  });
  db.ref('users').on('value', snap => {
    _users = snap.exists() ? Object.values(snap.val()) : [];
  });
  if (roomId) {
    db.ref('rooms/' + roomId + '/memberColors').on('value', snap => {
      _roomColors = snap.exists() ? snap.val() : {};
    });
  }
  db.ref('config/palette').on('value', snap => {
    if (snap.exists()) USER_COLORS = snap.val();
  });
}

function getBooks()   { return _books; }
function getReviews() { return _reviews; }
function getUsers()   { return _users; }

function saveReviews(reviews) {
  const obj = {};
  reviews.forEach(r => { obj[r.bookId + '_' + r.userId] = r; });
  REVIEWS_REF().set(obj);
}

const FALLBACK_GRADIENTS = [
  'linear-gradient(160deg,#AEE2FF,#D4BAFF)',
  'linear-gradient(160deg,#FFB6D9,#D4BAFF)',
  'linear-gradient(160deg,#C8F57A,#AEE2FF)',
  'linear-gradient(160deg,#FFB6D9,#FFE0A0)',
];

let userIdxMap = {};

// ── State ─────────────────────────────────────────────────
let currentUser;
let bookId;
let currentBook;
let currentReview = null;
let formRating = 0;
let pendingPhotoBase64 = '';
let savedYtUrl = '';
let isEditMode = false;

const DOT_COLORS = USER_COLORS; // user-colors.js 참조

// ── 피크닉 패치워크 배경 ──────────────────────────────────
function _picnicRng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}
const _PICNIC_PAL = [
  '#E8879A','#C23050','#A82040',
  '#2B3A6E','#1E2B5A',
  '#8BC66A','#6A9A40',
  '#E8C840',
  '#5BA8D4','#7AD4C0',
  '#F5E6C8','#FAD8E8'
];
function _ppFlower(ctx, ox, oy, S, col, rng) {
  const cols = 4, rows = 4, stepX = S / cols, stepY = S / rows;
  for (let row = 0; row < rows; row++) {
    for (let col2 = 0; col2 < cols; col2++) {
      const cx = ox + stepX * (col2 + 0.5), cy = oy + stepY * (row + 0.5);
      const pr = 1.2 + rng() * 1.5;
      ctx.fillStyle = col; ctx.globalAlpha = 0.82;
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * pr * 1.7, cy + Math.sin(a) * pr * 1.7, pr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#FFE566'; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(cx, cy, pr * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function _ppDots(ctx, ox, oy, S, col) {
  ctx.fillStyle = col; ctx.globalAlpha = 1;
  const spacing = 18, r = 5;
  for (let dy = spacing / 2; dy < S; dy += spacing)
    for (let dx = spacing / 2; dx < S; dx += spacing) {
      ctx.beginPath(); ctx.arc(ox + dx, oy + dy, r, 0, Math.PI * 2); ctx.fill();
    }
}
function _ppVStripe(ctx, ox, oy, S, col) {
  ctx.fillStyle = col; ctx.globalAlpha = 0.55;
  for (let dx = 1; dx < S; dx += 7) ctx.fillRect(ox + dx, oy, 3, S);
  ctx.globalAlpha = 1;
}
function _ppPlaid(ctx, ox, oy, S, col) {
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.5;
  for (let dx = 0; dx < S; dx += 13) ctx.fillRect(ox + dx, oy, 6, S);
  ctx.globalAlpha = 0.38;
  for (let dy = 0; dy < S; dy += 13) ctx.fillRect(ox, oy + dy, S, 6);
  ctx.globalAlpha = 1;
}
function _ppDiag(ctx, ox, oy, S, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = 0.5;
  for (let i = -S; i < S * 2; i += 10) {
    ctx.beginPath(); ctx.moveTo(ox + i, oy); ctx.lineTo(ox + i + S, oy + S); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function _ppShapes(ctx, ox, oy, S) {
  const cols = 3, rows = 3, stepX = S / cols, stepY = S / rows;
  ctx.font = (stepX * 0.62) + 'px MonaS12, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      ctx.fillText('🍓', ox + stepX * (col + 0.5), oy + stepY * (row + 0.5));
}
function _applyPicnicBg() {
  const oc = document.createElement('canvas');
  const DIM = 720; oc.width = oc.height = DIM;
  const ctx = oc.getContext('2d');
  const S = 120, COLS = 6, ROWS = 6, NT = 6, NP = _PICNIC_PAL.length;
  const rng = _picnicRng(20250401);
  const tg = Array.from({length: ROWS}, () => new Array(COLS));
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      let t; do { t = rng() * NT | 0; } while ((c > 0 && tg[r][c-1] === t) || (r > 0 && tg[r-1][c] === t));
      tg[r][c] = t;
    }
  const cg = Array.from({length: ROWS}, () => new Array(COLS));
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      let ci; do { ci = rng() * NP | 0; } while ((c > 0 && cg[r][c-1] === ci) || (r > 0 && cg[r-1][c] === ci));
      cg[r][c] = ci;
    }
  const fns = [_ppFlower, _ppDots, _ppVStripe, _ppPlaid, _ppDiag, _ppShapes];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ox = c * S, oy = r * S;
      const bi = cg[r][c], ai = (bi + 2 + (rng() * 8 | 0)) % NP;
      const pr = _picnicRng(r * 97 + c * 53 + tg[r][c] * 17 + 3);
      const angle = (rng() - 0.5) * 0.2;
      ctx.save();
      ctx.beginPath(); ctx.rect(ox, oy, S, S); ctx.clip();
      ctx.fillStyle = _PICNIC_PAL[bi]; ctx.fillRect(ox, oy, S, S);
      ctx.save();
      ctx.translate(ox + S / 2, oy + S / 2); ctx.rotate(angle);
      fns[tg[r][c]](ctx, -S / 2, -S / 2, S, _PICNIC_PAL[ai], pr);
      ctx.restore(); ctx.restore();
    }
  }
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
  document.body.style.background = '';
  document.body.style.backgroundImage = 'url(' + oc.toDataURL() + ')';
  document.body.style.backgroundRepeat = 'repeat';
  document.body.style.backgroundSize = 'auto';
  document.body.style.backgroundPosition = '0 0';
  document.body.style.backgroundAttachment = '';
}

function applyBackground() {
  const savedBg = localStorage.getItem('detail_bg_' + currentUser.id)
    || (localStorage.getItem('detail_dot_' + currentUser.id) === 'off' ? 'plain' : 'dot');

  document.body.classList.toggle('detail-dark',   savedBg === 'dark');
  document.body.classList.toggle('detail-picnic', savedBg === 'picnic');
  document.body.style.backgroundAttachment = '';

  if (savedBg === 'dark') {
    document.body.style.background = 'linear-gradient(135deg,#0a0a2e 0%,#1a0a3e 50%,#0d1b4b 100%)';
    document.body.style.backgroundAttachment = 'fixed';
    return;
  }

  if (savedBg === 'picnic') {
    document.fonts.load('20px MonaS12').then(_applyPicnicBg).catch(_applyPicnicBg);
    return;
  }

  const pastel = hexToPastel(getUserColor(currentBook.registeredBy), 0.25);
  document.body.style.background = pastel;

  if (savedBg === 'plain') {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    return;
  }

  if (window.innerWidth <= 480) {
    document.body.style.backgroundImage = `radial-gradient(circle, white 7px, transparent 7px), radial-gradient(circle, white 7px, transparent 7px)`;
    document.body.style.backgroundSize = `44px 44px`;
    document.body.style.backgroundPosition = `0 0, 22px 22px`;
  } else {
    document.body.style.backgroundImage = `radial-gradient(circle, white 7px, transparent 7px)`;
    document.body.style.backgroundSize = `44px 44px`;
    document.body.style.backgroundPosition = `0 0`;
  }
}

// ── Init ──────────────────────────────────────────────────
function init() {
  currentUser = checkAuth();
  const params = new URLSearchParams(location.search);
  bookId = params.get('id');
  roomId = params.get('roomId') || null;
  const fallbackUrl = roomId ? `home.html?roomId=${roomId}` : 'waiting.html';
  if (!bookId) { window.location.href = fallbackUrl; return; }

  setupRealtimeListeners();

  // books + reviews + memberColors 동시에 기다린 후 초기화
  Promise.all([
    BOOKS_REF().once('value'),
    REVIEWS_REF().once('value'),
    db.ref('users').once('value'),
    roomId ? db.ref('rooms/' + roomId + '/memberColors').once('value') : Promise.resolve(null),
  ]).then(([bSnap, rSnap, uSnap, cSnap]) => {
    _books   = bSnap.exists() ? Object.values(bSnap.val()) : [];
    _reviews = rSnap.exists() ? Object.values(rSnap.val()) : [];
    _users   = uSnap.exists() ? Object.values(uSnap.val()) : [];
    if (cSnap && cSnap.exists()) _roomColors = cSnap.val();
    currentBook = _books.find(b => b.id === bookId);
    if (!currentBook) { window.location.href = fallbackUrl; return; }
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) homeBtn.href = fallbackUrl;
    applyBackground();
    loadBook();
    loadReviews();
    initFormStars(0);
    const hadReview = loadCurrentUserReview();
    if (!hadReview) addPassagePair();
    loadSharedMedia();
    updateYtBtn();
  });
}

// ── Book header ───────────────────────────────────────────
function starsHTML(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const fill = Math.min(Math.max(rating - (i - 1), 0), 1);
    const pct  = Math.round(fill * 100);
    html += `<span class="star-cell"><span class="star-empty">✦</span><span class="star-full" style="width:${pct}%">✦</span></span>`;
  }
  return html;
}

function loadBook() {
  const container = document.getElementById('book-header');
  const avg = calcAvgRating();
  const gi = getBooks().findIndex(b => b.id === currentBook.id);
  const coverInner = currentBook.cover
    ? `<img src="${currentBook.cover}" alt="cover">`
    : `<div class="no-cover-ph" style="background:${FALLBACK_GRADIENTS[gi%4]}">📚</div>`;
  const coverEl = `<div class="book-cover-wrap">${coverInner}</div>`;

  container.innerHTML = `
    <div class="book-info">
      <h1>${escHtml(currentBook.title)}</h1>
      <div class="avg-stars">
        <span class="stars-display">${starsHTML(avg)}</span>
        <span class="avg-num">${avg > 0 ? avg.toFixed(1) : 'NO RATING YET'}</span>
      </div>
    </div>
    ${coverEl}
  `;
}

function calcAvgRating() {
  const r = getReviews().filter(r => r.bookId === bookId && r.rating > 0);
  return r.length ? r.reduce((s,r) => s+r.rating, 0) / r.length : 0;
}

// ── Reviews ───────────────────────────────────────────────
function loadReviews() {
  const reviews = getReviews()
    .filter(r => r.bookId === bookId)
    .sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  const list    = document.getElementById('oneliners');
  const grid    = document.getElementById('passages-grid');
  list.innerHTML = '';
  grid.innerHTML = '';

  if (reviews.length === 0) {
    list.innerHTML = '<div class="passages-empty">아직 코멘트가 없어요<br>첫 번째 기록을 남겨보세요</div>';
    return;
  }

  reviews.forEach((review, ri) => {
    renderOneLiner(review, ri);
    (review.passages || []).forEach(p => renderPassage(p, review, ri));
  });

  if (!list.children.length) {
    list.innerHTML = '<div class="passages-empty">아직 코멘트가 없어요<br>첫 번째 기록을 남겨보세요</div>';
  }
  if (!grid.children.length) {
    grid.innerHTML = '<div class="passages-empty" style="grid-column:1/-1">아직 등록된 구절이 없어요</div>';
  }
}

function renderOneLiner(review, ri) {
  if (!review.oneLiner) return;
  const isMine  = review.userId === currentUser.id;
  const uColor  = getUserColor(review.userId);
  const isDark  = document.body.classList.contains('detail-dark');

  const r = parseInt(uColor.slice(1,3), 16);
  const g = parseInt(uColor.slice(3,5), 16);
  const b = parseInt(uColor.slice(5,7), 16);

  const bubbleBg    = isDark ? `rgba(${r},${g},${b},0.18)` : hexToPastel(uColor, 0.88);
  const borderColor = isDark ? `rgba(${r},${g},${b},0.45)` : uColor;
  const shadowColor = isDark ? `rgba(${r},${g},${b},0.25)` : uColor;
  const badgeBg     = isDark ? `rgba(${r},${g},${b},0.35)` : uColor;

  const wrapper = document.createElement('div');
  wrapper.className = 'bubble-wrapper' + (isMine ? ' mine' : '');

  const badge = document.createElement('div');
  badge.className = 'name-badge';
  badge.style.background = badgeBg;
  badge.textContent = review.userName + (isMine ? ' ✦' : '');

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.style.cssText = `background:${bubbleBg}; border:2.5px solid ${borderColor}; box-shadow:3px 3px 0 ${shadowColor};`;
  if (isDark) bubble.style.color = 'white';
  bubble.innerHTML = escHtml(review.oneLiner).replace(/\n/g, '<br>');

  wrapper.appendChild(badge);
  wrapper.appendChild(bubble);
  document.getElementById('oneliners').appendChild(wrapper);
}

function closeScrapPopup() {
  const popup = document.getElementById('scrap-popup');
  if (popup) popup.remove();
}

function showScrapPopup(x, y, passage, review) {
  closeScrapPopup();
  const popup = document.createElement('div');
  popup.id = 'scrap-popup';
  popup.className = 'scrap-popup';

  const btn = document.createElement('button');
  btn.className = 'scrap-popup-btn';
  btn.textContent = '📌 내 스크랩북에 저장';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const book = getBooks().find(b => b.id === bookId);
    db.ref('scrappedPassages/' + currentUser.id).push({
      text: passage.text,
      comment: passage.comment || '',
      bookId: bookId,
      roomId: roomId || '',
      bookTitle: book?.title || '',
      fromUser: review.userName,
      timestamp: Date.now()
    });
    showToast('📌 스크랩북에 저장됐어요!');
    closeScrapPopup();
  });
  popup.appendChild(btn);
  document.body.appendChild(popup);

  const pw = popup.offsetWidth || 190;
  popup.style.left = Math.max(8, Math.min(x, window.innerWidth - pw - 8)) + 'px';
  popup.style.top  = Math.min(y + 8, window.innerHeight - 60) + 'px';

  setTimeout(() => document.addEventListener('click', closeScrapPopup, { once: true }), 0);
}

function renderPassage(passage, review, ri) {
  if (!passage.text) return;
  const card = document.createElement('div');
  card.className = 'passage-card';
  card.style.animationDelay = `${ri * 0.06}s`;
  card.innerHTML = `
    <div class="passage-meta"><span class="name-badge" style="background:${getUserColor(review.userId)}">${escHtml(review.userName)}</span></div>
    <div class="passage-text">"${escHtml(passage.text).replace(/\n/g, '<br>')}"</div>
    ${passage.comment ? `<div class="passage-comment">💬 ${escHtml(passage.comment).replace(/\n/g, '<br>')}</div>` : ''}
  `;

  if (review.userId !== currentUser.id) {
    // 데스크탑: 우클릭
    card.addEventListener('contextmenu', e => {
      e.preventDefault();
      showScrapPopup(e.clientX, e.clientY, passage, review);
    });

    // 모바일: 길게 누르기
    let longPressTimer;
    card.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      longPressTimer = setTimeout(() => {
        showScrapPopup(touch.clientX, touch.clientY, passage, review);
      }, 600);
    }, { passive: true });
    card.addEventListener('touchend',  () => clearTimeout(longPressTimer), { passive: true });
    card.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });
  }

  document.getElementById('passages-grid').appendChild(card);
}

// ── Edit mode ─────────────────────────────────────────────
function loadCurrentUserReview() {
  currentReview = getReviews().find(r => r.bookId === bookId && r.userId === currentUser.id) || null;
  if (!currentReview) return false;

  isEditMode = true;
  document.getElementById('form-title').innerHTML =
    'MY RECORD ✏ <span class="edit-mode-badge">EDIT MODE</span>';
  document.getElementById('submit-btn').textContent = '수정하기';

  formRating = currentReview.rating || 0;
  renderFormStars(formRating);
  document.getElementById('form-oneliner').value = currentReview.oneLiner || '';
  autoResizeTextarea(document.getElementById('form-oneliner'));

  if (currentReview.youtubeUrl) {
    savedYtUrl = currentReview.youtubeUrl;
    document.getElementById('youtube-url').value = currentReview.youtubeUrl;
    embedYoutube(false);  // 로드만, 재생 안 함
  }
  updateYtBtn();

  if (currentReview.placePhoto) {
    pendingPhotoBase64 = currentReview.placePhoto;
    const img = document.getElementById('place-photo');
    img.src = currentReview.placePhoto;
    img.style.display = 'block';
    document.getElementById('upload-placeholder').style.display = 'none';
    document.getElementById('photo-edit-btn').style.display = 'block';
  }

  const passagesInput = document.getElementById('passages-input');
  passagesInput.innerHTML = '';
  if (currentReview.passages && currentReview.passages.length > 0) {
    currentReview.passages.forEach(p => addPassagePair(p.text, p.comment));
  } else {
    addPassagePair();
  }
  return true;
}

// ── 다른 유저 미디어 표시 ────────────────────────────────────
function loadSharedMedia() {
  const reviews = getReviews().filter(r => r.bookId === bookId);

  // 현재 유저 사진이 없으면 다른 유저 것 표시 (읽기 전용)
  if (!pendingPhotoBase64) {
    const withPhoto = reviews.find(r => r.placePhoto);
    if (withPhoto) {
      const img = document.getElementById('place-photo');
      img.src = withPhoto.placePhoto;
      img.style.display = 'block';
      document.getElementById('upload-placeholder').style.display = 'none';
    }
  }

  // 현재 유저 유튜브가 없으면 다른 유저 것 표시
  if (!document.getElementById('youtube-embed').innerHTML.trim()) {
    const withYt = reviews.find(r => r.youtubeUrl);
    if (withYt) {
      const match = withYt.youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      if (match) {
        document.getElementById('youtube-url').value = withYt.youtubeUrl;
        document.getElementById('youtube-embed').innerHTML =
          `<iframe src="https://www.youtube.com/embed/${match[1]}" allowfullscreen allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"></iframe>`;
      }
    }
  }
}

// ── Photo ─────────────────────────────────────────────────
function triggerPhotoUpload() { document.getElementById('photo-input').click(); }

function handlePhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  resizeImageToBase64(file, 1200, 900, b64 => {
    pendingPhotoBase64 = b64;
    const img = document.getElementById('place-photo');
    img.src = b64;
    img.style.display = 'block';
    document.getElementById('upload-placeholder').style.display = 'none';
    document.getElementById('photo-edit-btn').style.display = 'block';

    // 사진을 즉시 review에 저장
    const reviews = getReviews();
    const idx = reviews.findIndex(r => r.bookId === bookId && r.userId === currentUser.id);
    if (idx !== -1) {
      reviews[idx].placePhoto = b64;
      saveReviews(reviews);
    }
  });
}

function openPhotoLightbox() {
  const src = document.getElementById('place-photo').src;
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.className = 'photo-lightbox';
  overlay.innerHTML = `<span class="photo-lightbox-close" title="닫기">✕</span><img src="${src}">`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('.photo-lightbox-close').addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

function resizeImageToBase64(file, maxW, maxH, cb) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h*maxW/w); w = maxW; }
      if (h > maxH) { w = Math.round(w*maxH/h); h = maxH; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.75));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ── YouTube ───────────────────────────────────────────────
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('form-oneliner');
  if (ta) ta.addEventListener('input', () => autoResizeTextarea(ta));

  document.addEventListener('input', e => {
    if (e.target.matches('#passages-input textarea')) {
      autoResizeTextarea(e.target);
    }
  });
});

function embedYoutube(save = true) {
  const url = document.getElementById('youtube-url').value.trim();
  if (!url) { showToast('URL을 입력해주세요', true); return; }
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (!match) { showToast('올바른 YouTube URL이 아니에요', true); return; }
  document.getElementById('youtube-embed').innerHTML =
    `<iframe src="https://www.youtube.com/embed/${match[1]}?enablejsapi=1" allowfullscreen allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"></iframe>`;

  if (save) {
    savedYtUrl = url;
    updateYtBtn();
    const reviews = getReviews();
    const idx = reviews.findIndex(r => r.bookId === bookId && r.userId === currentUser.id);
    if (idx !== -1) { reviews[idx].youtubeUrl = url; saveReviews(reviews); }
  }
}

function _ytPostMessage(cmd) {
  const iframe = document.querySelector('#youtube-embed iframe');
  if (iframe) iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*');
}

function updateYtBtn() {
  const btn = document.getElementById('yt-btn');
  const editBtn = document.getElementById('yt-edit-btn');
  const urlInput = document.getElementById('youtube-url');
  if (!btn) return;

  const hasVideo = savedYtUrl || document.getElementById('youtube-embed').innerHTML.trim();

  if (hasVideo) {
    // URL 있음: 링크수정하기 + PLAY 표시
    if (editBtn) editBtn.classList.remove('hidden');
    urlInput.classList.add('hidden');
    btn.classList.remove('hidden');
    if (!btn.textContent.includes('PAUSE')) btn.textContent = '▶ PLAY';
  } else {
    // URL 없음: 입력창 + 확인 표시
    if (editBtn) editBtn.classList.add('hidden');
    urlInput.classList.remove('hidden');
    btn.classList.remove('hidden');
    btn.textContent = '확인';
  }
}

function toggleYtEdit() {
  const urlInput = document.getElementById('youtube-url');
  const btn = document.getElementById('yt-btn');
  const editBtn = document.getElementById('yt-edit-btn');

  if (editBtn.textContent.trim() === '링크 수정하기') {
    // 편집 모드 진입: play 버튼 → url 입력란
    btn.classList.add('hidden');
    urlInput.value = savedYtUrl || '';
    urlInput.classList.remove('hidden');
    urlInput.focus();
    editBtn.textContent = '확인';
  } else {
    // 확인: URL 저장
    const newUrl = urlInput.value.trim();
    if (newUrl) {
      embedYoutube(true);
    }
    urlInput.classList.add('hidden');
    btn.classList.remove('hidden');
    if (!btn.textContent.includes('PAUSE')) btn.textContent = '▶ PLAY';
    editBtn.textContent = '링크 수정하기';
  }
}

function handleYtBtn() {
  const btn = document.getElementById('yt-btn');
  if (btn.textContent.includes('PAUSE')) {
    _ytPostMessage('pauseVideo');
    btn.textContent = '▶ PLAY';
  } else if (btn.textContent.includes('PLAY')) {
    const iframe = document.querySelector('#youtube-embed iframe');
    if (!iframe) { embedYoutube(false); }
    _ytPostMessage('playVideo');
    btn.textContent = '⏸ PAUSE';
  } else {
    // 확인 / SAVE
    embedYoutube(true);
  }
}

// ── Passages ──────────────────────────────────────────────
function addPassagePair(text, comment) {
  const pair = document.createElement('div');
  pair.className = 'passage-pair';
  pair.innerHTML = `
    <textarea placeholder="인상 깊었던 구절을 적어주세요">${escHtml(text||'')}</textarea>
    <textarea placeholder="독서메이트 코멘트를 남겨주세요">${escHtml(comment||'')}</textarea>
    <button class="remove-pair-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  document.getElementById('passages-input').appendChild(pair);
  pair.querySelectorAll('textarea').forEach(ta => autoResizeTextarea(ta));
}

function collectPassages() {
  return Array.from(document.querySelectorAll('.passage-pair')).map(pair => {
    const txts = pair.querySelectorAll('textarea');
    return { text: txts[0]?.value.trim()||'', comment: txts[1]?.value.trim()||'' };
  }).filter(p => p.text);
}

// ── Form stars (반별 지원) ────────────────────────────────
function renderFormStars(rating) {
  const cells = document.querySelectorAll('#form-stars .star-cell');
  cells.forEach((cell, i) => {
    const fill = Math.min(Math.max(rating - i, 0), 1);
    cell.querySelector('.star-full').style.width = (fill >= 1 ? 100 : fill >= 0.5 ? 50 : 0) + '%';
  });
}

function resetFormStars() { renderFormStars(formRating); }
function setFormStar(n)   { formRating = n; renderFormStars(n); }

function initFormStars(initRating = 0) {
  const container = document.getElementById('form-stars');
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const cell = document.createElement('span');
    cell.className = 'star-cell';
    cell.innerHTML = '<span class="star-empty">✦</span><span class="star-full" style="width:0%">✦</span>';
    container.appendChild(cell);
  }
  renderFormStars(initRating);

  container.addEventListener('mousemove', e => {
    const cell = e.target.closest('.star-cell');
    if (!cell) return;
    const cells = [...container.querySelectorAll('.star-cell')];
    const idx   = cells.indexOf(cell);
    const rect  = cell.getBoundingClientRect();
    renderFormStars(idx + (e.clientX < rect.left + rect.width / 2 ? 0.5 : 1));
  });
  container.addEventListener('mouseleave', resetFormStars);
  container.addEventListener('click', e => {
    const cell = e.target.closest('.star-cell');
    if (!cell) return;
    const cells = [...container.querySelectorAll('.star-cell')];
    const idx   = cells.indexOf(cell);
    const rect  = cell.getBoundingClientRect();
    setFormStar(idx + (e.clientX < rect.left + rect.width / 2 ? 0.5 : 1));
  });
}

// ── Submit ────────────────────────────────────────────────
function submitReview() {
  if (formRating === 0) { showToast('별점을 선택해주세요 ★', true); return; }

  const reviewData = {
    bookId,
    userId:      currentUser.id,
    userName:    currentUser.name,
    rating:      formRating,
    oneLiner:    document.getElementById('form-oneliner').value.trim(),
    mateComment: '',
    passages:    collectPassages(),
    placePhoto:  pendingPhotoBase64,
    youtubeUrl:  document.getElementById('youtube-url').value.trim(),
    song:        '',
    createdAt:   new Date().toISOString(),
  };

  const reviews = getReviews();
  if (isEditMode) {
    const idx = reviews.findIndex(r => r.bookId===bookId && r.userId===currentUser.id);
    if (idx !== -1) { reviewData.createdAt = reviews[idx].createdAt; reviews[idx] = reviewData; }
  } else {
    reviews.push(reviewData);
    isEditMode = true;
    document.getElementById('form-title').innerHTML = 'MY RECORD ✏ <span class="edit-mode-badge">EDIT MODE</span>';
    document.getElementById('submit-btn').textContent = '수정하기';
  }

  saveReviews(reviews);
  loadBook();
  loadReviews();
  showToast(isEditMode ? '수정되었어요!' : '★ 기록이 저장되었어요!');
}

init();
