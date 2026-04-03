// In-memory 캐시
let _books = [];
let _reviews = [];
let _users = [];

// 실시간 리스너
function setupRealtimeListeners() {
  db.ref('books').on('value', snap => {
    _books = snap.exists() ? Object.values(snap.val()) : [];
  });
  db.ref('reviews').on('value', snap => {
    _reviews = snap.exists() ? Object.values(snap.val()) : [];
    if (typeof loadBook === 'function' && currentBook) loadBook();
    if (typeof loadReviews === 'function' && currentBook) loadReviews();
  });
  db.ref('users').on('value', snap => {
    _users = snap.exists() ? Object.values(snap.val()) : [];
  });
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
  db.ref('reviews').set(obj);
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


function applyBackground() {
  const pastel = hexToPastel(getUserColor(currentBook.registeredBy), 0.25);
  document.body.style.background = pastel;
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
  if (!bookId) { window.location.href = 'index.html'; return; }

  setupRealtimeListeners();

  // books + reviews 동시에 기다린 후 초기화
  Promise.all([
    db.ref('books').once('value'),
    db.ref('reviews').once('value'),
    db.ref('users').once('value'),
  ]).then(([bSnap, rSnap, uSnap]) => {
    _books   = bSnap.exists() ? Object.values(bSnap.val()) : [];
    _reviews = rSnap.exists() ? Object.values(rSnap.val()) : [];
    _users   = uSnap.exists() ? Object.values(uSnap.val()) : [];
    currentBook = _books.find(b => b.id === bookId);
    if (!currentBook) { window.location.href = 'index.html'; return; }
    applyBackground();
    loadBook();
    loadReviews();
    initFormStars(0);
    const hadReview = loadCurrentUserReview();
    if (!hadReview) addPassagePair();
    loadSharedMedia();
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
        <span class="avg-num">${avg > 0 ? avg.toFixed(1) + ' / 5.0' : 'NO RATING YET'}</span>
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
    list.innerHTML = '<div class="empty-state">아직 코멘트가 없어요 🌟<br>첫 번째 기록을 남겨보세요!</div>';
    return;
  }

  reviews.forEach((review, ri) => {
    renderOneLiner(review, ri);
    (review.passages || []).forEach(p => renderPassage(p, review, ri));
  });

  if (!grid.children.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#CCC;font-family:Jua,sans-serif;padding:20px;font-size:13px">아직 등록된 구절이 없어요 📖</div>';
  }
}

function renderOneLiner(review, ri) {
  if (!review.oneLiner) return;
  const isMine  = review.userId === currentUser.id;
  const uColor  = getUserColor(review.userId);
  const bubbleBg = hexToPastel(uColor, 0.88);

  const wrapper = document.createElement('div');
  wrapper.className = 'bubble-wrapper' + (isMine ? ' mine' : '');

  const badge = document.createElement('div');
  badge.className = 'name-badge';
  badge.style.background = uColor;
  badge.textContent = review.userName + (isMine ? ' ✦' : '');

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.style.cssText = `background:${bubbleBg}; border:2.5px solid ${uColor}; box-shadow:3px 3px 0 ${uColor};`;
  bubble.textContent = review.oneLiner;

  wrapper.appendChild(badge);
  wrapper.appendChild(bubble);
  document.getElementById('oneliners').appendChild(wrapper);
}

function renderPassage(passage, review, ri) {
  if (!passage.text) return;
  const card = document.createElement('div');
  card.className = 'passage-card';
  card.style.animationDelay = `${ri * 0.06}s`;
  card.innerHTML = `
    <div class="passage-meta"><span style="font-size:1.3em">${escHtml(review.userName)}</span><span style="font-size:0.75em">'s pick!</span></div>
    <div class="passage-text">"${escHtml(passage.text)}"</div>
    ${passage.comment ? `<div class="passage-comment">💬 ${escHtml(passage.comment)}</div>` : ''}
  `;
  document.getElementById('passages-grid').appendChild(card);
}

// ── Edit mode ─────────────────────────────────────────────
function loadCurrentUserReview() {
  currentReview = getReviews().find(r => r.bookId === bookId && r.userId === currentUser.id) || null;
  if (!currentReview) return false;

  isEditMode = true;
  document.getElementById('form-title').innerHTML =
    'MY RECORD ✏ <span class="edit-mode-badge">EDIT MODE</span>';
  document.getElementById('submit-btn').textContent = 'UPDATE ✏';

  formRating = currentReview.rating || 0;
  renderFormStars(formRating);
  document.getElementById('form-oneliner').value = currentReview.oneLiner || '';
  autoResizeTextarea(document.getElementById('form-oneliner'));

  if (currentReview.youtubeUrl) {
    savedYtUrl = currentReview.youtubeUrl;
    document.getElementById('youtube-url').value = currentReview.youtubeUrl;
    embedYoutube(false);  // 로드만, 재생 안 함
    updateYtBtn();        // ▶ PLAY 표시
  }

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
});

function embedYoutube(save = true) {
  const url = document.getElementById('youtube-url').value.trim();
  if (!url) { showToast('YouTube URL을 입력해주세요', true); return; }
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
  const url = document.getElementById('youtube-url').value.trim();
  const btn = document.getElementById('yt-btn');
  if (!btn) return;

  if (window.innerWidth <= 480) {
    // 모바일: 링크 입력창 숨김 → 영상 없으면 버튼도 숨김
    if (savedYtUrl) {
      btn.style.display = 'block';
      if (!btn.textContent.includes('PAUSE')) btn.textContent = '▶ PLAY';
    } else {
      btn.style.display = 'none';
    }
  } else {
    btn.style.display = '';
    if (url && url === savedYtUrl) {
      btn.textContent = '▶ PLAY';
    } else {
      btn.textContent = '💾 SAVE';
    }
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
    // SAVE (데스크탑 전용)
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
    document.getElementById('submit-btn').textContent = 'UPDATE ✏';
  }

  saveReviews(reviews);
  loadBook();
  loadReviews();
  showToast(isEditMode ? '✏ 수정되었어요!' : '★ 기록이 저장되었어요!');
}

init();
