// ── roomId 확인 ───────────────────────────────────────────
const roomId = new URLSearchParams(location.search).get('roomId');
if (!roomId) window.location.href = 'waiting.html';

// ── In-memory 캐시 ────────────────────────────────────────
let _books = [];
let _reviews = [];
let _users = [];
let _roomMembers = [];
let _registeredMembers = [];

// ── Firebase 경로 (방 스코프) ─────────────────────────────
const ROOM_REF                = () => db.ref('rooms/' + roomId);
const BOOKS_REF               = () => db.ref('rooms/' + roomId + '/books');
const REVIEWS_REF             = () => db.ref('rooms/' + roomId + '/reviews');
const MEMBERS_REF             = () => db.ref('rooms/' + roomId + '/members');
const REGISTERED_MEMBERS_REF  = () => db.ref('rooms/' + roomId + '/registeredMembers');
const MEMBER_COLORS_REF       = () => db.ref('rooms/' + roomId + '/memberColors');

// ── 실시간 리스너 ─────────────────────────────────────────
function setupRealtimeListeners() {
  BOOKS_REF().on('value', snap => {
    _books = snap.exists() ? Object.values(snap.val()) : [];
    if (typeof renderBookshelf === 'function') renderBookshelf();
  });
  REVIEWS_REF().on('value', snap => {
    _reviews = snap.exists() ? Object.values(snap.val()) : [];
    if (typeof renderBookshelf === 'function') renderBookshelf();
  });
  db.ref('users').on('value', snap => {
    _users = snap.exists() ? Object.values(snap.val()) : [];
    if (typeof renderMembers === 'function') renderMembers();
    if (typeof renderBookshelf === 'function') renderBookshelf();
  });
  MEMBERS_REF().on('value', snap => {
    _roomMembers = snap.exists() ? Object.values(snap.val()) : [];
    if (typeof renderMembers === 'function') renderMembers();
  });
  REGISTERED_MEMBERS_REF().on('value', snap => {
    _registeredMembers = snap.exists() ? Object.values(snap.val()) : [];
    if (typeof renderMembers === 'function') renderMembers();
  });
  MEMBER_COLORS_REF().on('value', snap => {
    _roomColors = snap.exists() ? snap.val() : {};
    if (typeof renderMembers === 'function') renderMembers();
    if (typeof renderBookshelf === 'function') renderBookshelf();
  });
  db.ref('config/palette').on('value', snap => {
    if (snap.exists()) USER_COLORS = snap.val();
    if (typeof renderMembers === 'function') renderMembers();
    if (typeof renderBookshelf === 'function') renderBookshelf();
  });
}

// ── Data accessors ────────────────────────────────────────
function getBooks()   { return _books; }
function getReviews() { return _reviews; }
function getUsers()   { return _users; }

function saveBooks(books) {
  const obj = {};
  books.forEach(b => { obj[b.id] = b; });
  BOOKS_REF().set(obj);
}
function saveReviews(reviews) {
  const obj = {};
  reviews.forEach(r => { obj[r.bookId + '_' + r.userId] = r; });
  REVIEWS_REF().set(obj);
}
function saveUsers(users) {
  const obj = {};
  users.forEach(u => { obj[u.id] = u; });
  db.ref('users').set(obj);
}

// ── 방 입장 / 퇴장 ────────────────────────────────────────
function joinAsRoomMember() {
  const ref = MEMBERS_REF().child(currentUserInit.id);
  ref.set({ id: currentUserInit.id, name: currentUserInit.name, joinedAt: Date.now() });
  ref.onDisconnect().remove();
}

function leaveRoom() {
  MEMBERS_REF().child(currentUserInit.id).remove()
    .then(() => { window.location.href = 'waiting.html'; });
}

function logout() {
  MEMBERS_REF().child(currentUserInit.id).remove().then(() => {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });
}

// ── 방 정보 배너 ──────────────────────────────────────────
function loadRoomBanner() {
  ROOM_REF().once('value', snap => {
    if (!snap.exists()) { window.location.href = 'waiting.html'; return; }
    const room = snap.val();

    // 멤버 여부 확인: registeredMembers에 없으면 waiting으로
    const registered = room.registeredMembers || {};
    if (!registered[currentUserInit.id]) {
      window.location.href = 'waiting.html';
      return;
    }

    // 가장 최근 접속한 방 기록
    db.ref('userRooms/' + currentUserInit.id + '/' + roomId + '/lastVisited').set(Date.now());

    document.getElementById('room-banner-name').textContent = room.name || '';
    document.getElementById('room-banner-code').textContent = roomId;
    document.title = (room.name || roomId) + ' — 교환독서 기록장';
  });
}

// ── Collage board ─────────────────────────────────────────
const FALLBACK_GRADIENTS = [
  'linear-gradient(160deg,#AEE2FF,#D4BAFF)',
  'linear-gradient(160deg,#FFB6D9,#D4BAFF)',
  'linear-gradient(160deg,#C8F57A,#AEE2FF)',
  'linear-gradient(160deg,#FFB6D9,#FFE0A0)',
  'linear-gradient(160deg,#D4BAFF,#C8F57A)',
  'linear-gradient(160deg,#AEE2FF,#FFB6D9)',
  'linear-gradient(160deg,#C8F57A,#FFB6D9)',
  'linear-gradient(160deg,#FFE0A0,#D4BAFF)',
];

const TAPE_COLORS = [
  'rgba(174,226,255,0.7)',
  'rgba(255,182,217,0.7)',
  'rgba(212,186,255,0.7)',
  'rgba(200,245,122,0.7)',
];

function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return ((h >>> 0) / 0xFFFFFFFF);
}

function positionBubble(card) {
  if (window.innerWidth > 480) return;
  const bubble = card.querySelector('.pixel-bubble');
  if (!bubble) return;
  const rect = card.getBoundingClientRect();
  const bw = 160, bh = 100, margin = 12;
  const vw = window.innerWidth, vh = window.innerHeight;
  bubble.classList.remove('bubble-right','bubble-left','bubble-top','bubble-bottom');
  if (vw - rect.right >= bw + margin)  bubble.classList.add('bubble-right');
  else if (rect.left >= bw + margin)   bubble.classList.add('bubble-left');
  else                                  bubble.classList.add('bubble-top');
}

function renderBookshelf() {
  const board   = document.getElementById('bookshelf');
  board.innerHTML = '';
  const books   = getBooks();
  const reviews = getReviews();

  const subEl = document.getElementById('shelf-sub');
  if (subEl) subEl.innerHTML = `지금까지 모은 지식의 별자리 <span style="color:white">${books.length}</span>개 ✦`;

  if (books.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'shelf-empty-hint';
    hint.textContent = '첫 번째 책을 등록해보세요 🌟';
    board.appendChild(hint);
    return;
  }

  const users = getUsers();
  const CARD_W = 94, CARD_H = 155, COLS = 3, CELL_H = 240, PAD = 12;
  const containerW = board.clientWidth || 460;
  const CELL_W     = (containerW - PAD * 2) / COLS;
  const rowCount   = Math.ceil(books.length / COLS);
  const containerH = rowCount * CELL_H + PAD * 2 + 40;
  board.style.height = containerH + 'px';

  const positions = books.map((book, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const rx  = seededRandom(book.id + '_x'), ry = seededRandom(book.id + '_y');
    const maxOffX = Math.max(0, CELL_W - CARD_W - PAD);
    const maxOffY = Math.max(0, CELL_H - CARD_H - PAD);
    const x = PAD + col * CELL_W + rx * maxOffX;
    const y = PAD + row * CELL_H + ry * maxOffY;
    return { x, y, cx: x + CARD_W / 2, cy: y + CARD_H / 2 };
  });

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:0;overflow:visible;';
  board.appendChild(svg);

  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i], b = positions[i + 1];
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    glow.setAttribute('x1', a.cx); glow.setAttribute('y1', a.cy);
    glow.setAttribute('x2', b.cx); glow.setAttribute('y2', b.cy);
    glow.setAttribute('stroke', 'rgba(180,220,255,0.25)'); glow.setAttribute('stroke-width', '4');
    glow.setAttribute('stroke-dasharray', '4 7'); svg.appendChild(glow);
    const core = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    core.setAttribute('x1', a.cx); core.setAttribute('y1', a.cy);
    core.setAttribute('x2', b.cx); core.setAttribute('y2', b.cy);
    core.setAttribute('stroke', 'rgba(220,240,255,0.9)'); core.setAttribute('stroke-width', '1');
    core.setAttribute('stroke-dasharray', '4 7'); svg.appendChild(core);
  }

  books.forEach((book, i) => {
    const bookReviews = reviews.filter(r => r.bookId === book.id && r.rating > 0);
    const avgRating   = bookReviews.length ? bookReviews.reduce((s, r) => s + r.rating, 0) / bookReviews.length : null;
    const { x, y }   = positions[i];

    const card = document.createElement('div');
    card.className = 'book-card';
    card.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${CARD_W}px;height:${CARD_H}px;animation-delay:${i * 0.07}s;`;
    card.title = book.title;

    const inner = document.createElement('div');
    inner.className = 'book-card-inner';
    inner.style.width = '100%'; inner.style.height = '100%';
    if (book.cover) inner.style.backgroundImage = `url('${book.cover}')`;
    else inner.style.background = FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length];
    const titleEl = document.createElement('div');
    titleEl.className = 'cover-title'; titleEl.textContent = book.title;
    inner.appendChild(titleEl); card.appendChild(inner);

    const sticker = document.createElement('div');
    sticker.className = 'card-stars-sticker';
    sticker.innerHTML = avgRating !== null ? starsHTML(avgRating) : starsHTML(0);
    card.appendChild(sticker);

    const dot = document.createElement('div');
    dot.className = 'owner-dot';
    dot.style.background = getUserColor(book.registeredBy);
    dot.title = users.find(u => u.id === book.registeredBy)?.name || '';
    card.appendChild(dot);

    const ownerReview = reviews.find(r => r.bookId === book.id && r.userId === book.registeredBy);
    if (ownerReview?.oneLiner) {
      const bubble = document.createElement('div');
      bubble.className = 'pixel-bubble';
      bubble.textContent = ownerReview.oneLiner;
      const ownerColor = getUserColor(book.registeredBy);
      bubble.style.setProperty('--bubble-color', ownerColor);
      bubble.style.setProperty('--bubble-glow', ownerColor + '55');
      card.appendChild(bubble);
      card.addEventListener('mouseenter', () => positionBubble(card));
      card.addEventListener('touchstart', () => positionBubble(card), { passive: true });
    }

    card.onclick = () => { window.location.href = `detail.html?id=${book.id}&roomId=${roomId}`; };
    board.appendChild(card);
  });
}

// ── Members (등록 멤버 전체 + 온라인 표시) ───────────────
function renderMembers() {
  const bar = document.getElementById('members-bar');
  bar.innerHTML = '';

  const members = _registeredMembers.length > 0 ? _registeredMembers : _roomMembers;
  if (members.length === 0) {
    bar.innerHTML = '<span style="color:#CCC;font-size:13px">아직 멤버가 없어요</span>';
    return;
  }

  const sorted = [
    ...members.filter(m => m.id === currentUserInit.id),
    ...members.filter(m => m.id !== currentUserInit.id),
  ];

  sorted.forEach(member => {
    const isMe = member.id === currentUserInit.id;
    const circle = document.createElement('div');
    circle.className = 'member-circle' + (isMe ? ' me' : '');
    circle.title = member.name;
    circle.textContent = member.name.charAt(0);
    circle.style.background = getUserColor(member.id);
    if (isMe) {
      circle.addEventListener('click', e => {
        e.stopPropagation();
        if (_colorPickerOpen) closeColorPicker();
        else openColorPicker(circle, member.id);
      });
    }
    bar.appendChild(circle);
  });
}

// ── Color Picker ──────────────────────────────────────────
let _colorPickerOpen = false;

function openColorPicker(circleEl, userId) {
  closeColorPicker();
  const takenColors = new Set(
    Object.entries(_roomColors)
      .filter(([id]) => id !== userId)
      .map(([, hex]) => hex.toUpperCase())
  );
  const myColor = getUserColor(userId).toUpperCase();

  const overlay = document.createElement('div');
  overlay.className = 'color-picker-overlay'; overlay.id = 'color-picker-popover';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeColorPicker(); });

  const modal = document.createElement('div');
  modal.className = 'color-picker-modal';

  // ── 헤더 ──────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'color-picker-header';
  const label = document.createElement('div');
  label.className = 'color-picker-label'; label.textContent = 'DESIGN SETTING ✦';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'color-picker-close'; closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeColorPicker);
  header.appendChild(label); header.appendChild(closeBtn);
  modal.appendChild(header);

  // ── 탭 바 ─────────────────────────────────────────────────
  const tabBar = document.createElement('div');
  tabBar.className = 'admin-tab-bar';
  const tabColor = document.createElement('button');
  tabColor.className = 'admin-tab active'; tabColor.textContent = '프로필 색상';
  const tabDesign = document.createElement('button');
  tabDesign.className = 'admin-tab'; tabDesign.textContent = '페이지 디자인';
  const tabFont = document.createElement('button');
  tabFont.className = 'admin-tab'; tabFont.textContent = '글씨체';
  tabBar.appendChild(tabColor); tabBar.appendChild(tabDesign); tabBar.appendChild(tabFont);
  modal.appendChild(tabBar);

  // ── 탭 콘텐츠: 프로필 색상 ───────────────────────────────
  const contentColor = document.createElement('div');
  contentColor.className = 'admin-content';
  const colorDesc = document.createElement('div');
  colorDesc.className = 'color-picker-desc';
  colorDesc.textContent = '선택한 색상은 등록한 책의 상세페이지 배경에 적용됩니다';
  contentColor.appendChild(colorDesc);

  const grid = document.createElement('div'); grid.className = 'color-swatches';
  USER_COLORS.forEach(hex => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch'; swatch.style.background = hex; swatch.title = hex;
    const upper = hex.toUpperCase();
    if (takenColors.has(upper)) { swatch.classList.add('swatch-taken'); }
    else {
      if (upper === myColor) swatch.classList.add('swatch-current');
      swatch.addEventListener('click', e => {
        e.stopPropagation(); saveUserColor(userId, hex); closeColorPicker();
      });
    }
    grid.appendChild(swatch);
  });
  contentColor.appendChild(grid);
  modal.appendChild(contentColor);

  // ── 탭 콘텐츠: 페이지 디자인 ─────────────────────────────
  const contentDesign = document.createElement('div');
  contentDesign.className = 'admin-content hidden';
  const dotRow = document.createElement('div');
  dotRow.className = 'design-setting-row';
  const dotLabel = document.createElement('span');
  dotLabel.className = 'design-setting-label';
  dotLabel.textContent = '상세 페이지 도트 패턴';
  const dotEnabled = localStorage.getItem('detail_dot_' + userId) !== 'off';
  const dotToggle = document.createElement('button');
  dotToggle.className = 'design-toggle' + (dotEnabled ? ' on' : '');
  dotToggle.textContent = dotEnabled ? 'ON' : 'OFF';
  dotToggle.addEventListener('click', () => {
    const isOn = dotToggle.classList.contains('on');
    dotToggle.classList.toggle('on', !isOn);
    dotToggle.textContent = !isOn ? 'ON' : 'OFF';
    localStorage.setItem('detail_dot_' + userId, !isOn ? 'on' : 'off');
  });
  dotRow.appendChild(dotLabel); dotRow.appendChild(dotToggle);
  contentDesign.appendChild(dotRow);
  modal.appendChild(contentDesign);

  // ── 탭 콘텐츠: 글씨체 ────────────────────────────────────
  const contentFont = document.createElement('div');
  contentFont.className = 'admin-content hidden';
  const savedFont = localStorage.getItem('detail_font_' + userId) || 'readable';
  const fontOptions = [
    { value: 'readable', label: '가독성이 좋은 글씨' },
    { value: 'kitsch',   label: '키치한 손글씨' },
  ];
  const fontRow = document.createElement('div');
  fontRow.className = 'design-font-row';
  fontOptions.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'design-font-btn' + (savedFont === opt.value ? ' active' : '');
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      fontRow.querySelectorAll('.design-font-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      localStorage.setItem('detail_font_' + userId, opt.value);
    });
    fontRow.appendChild(btn);
  });
  contentFont.appendChild(fontRow);
  modal.appendChild(contentFont);

  // ── 탭 전환 ───────────────────────────────────────────────
  const allTabs = [tabColor, tabDesign, tabFont];
  const allContents = [contentColor, contentDesign, contentFont];
  function switchTab(idx) {
    allTabs.forEach((t, i) => t.classList.toggle('active', i === idx));
    allContents.forEach((c, i) => c.classList.toggle('hidden', i !== idx));
  }
  tabColor.addEventListener('click', () => switchTab(0));
  tabDesign.addEventListener('click', () => switchTab(1));
  tabFont.addEventListener('click',   () => switchTab(2));

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _colorPickerOpen = true;
}
function closeColorPicker() {
  document.getElementById('color-picker-popover')?.remove();
  _colorPickerOpen = false;
}
function saveUserColor(userId, hex) {
  MEMBER_COLORS_REF().child(userId).set(hex);
}

// ── 알라딘 오픈API ────────────────────────────────────────
const ALADIN_TTB_KEY = 'ttbanstjgml031830001';
let selectedBookData = null;

async function searchBooks() {
  const query = document.getElementById('book-search').value.trim();
  if (!query) { showToast('검색어를 입력해주세요', true); return; }
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<span class="search-loading">🔍 검색 중...</span>';
  const apiUrl = [
    'https://www.aladin.co.kr/ttb/api/ItemSearch.aspx',
    `?ttbkey=${ALADIN_TTB_KEY}`,
    `&Query=${encodeURIComponent(query)}`,
    '&QueryType=Title&MaxResults=10&SearchTarget=Book&Version=20131101&Cover=Big',
  ].join('');
  try {
    const res  = await fetch(`https://corsproxy.io/?${encodeURIComponent(apiUrl)}`);
    const text = await res.text();
    const xml  = new DOMParser().parseFromString(text, 'text/xml');
    const items = Array.from(xml.querySelectorAll('item')).map(el => ({
      title:  el.querySelector('title')?.textContent  || '제목 없음',
      cover:  el.querySelector('cover')?.textContent  || '',
      author: el.querySelector('author')?.textContent || '',
    }));
    if (items.length === 0) {
      resultsEl.innerHTML = '<span class="no-results">검색 결과가 없어요</span>';
      const hint = document.createElement('button');
      hint.className = 'manual-input-hint-btn';
      hint.textContent = '직접 입력하기';
      hint.onclick = showManualInput;
      resultsEl.appendChild(hint);
      return;
    }
    renderSearchResults(items);
  } catch {
    resultsEl.innerHTML = '<span class="no-results">검색 중 오류가 발생했어요</span>';
    const hint = document.createElement('button');
    hint.className = 'manual-input-hint-btn';
    hint.textContent = '직접 입력하기';
    hint.onclick = showManualInput;
    resultsEl.appendChild(hint);
  }
}

// ── 직접 입력 ─────────────────────────────────────────────
let _manualCoverBase64 = '';

function showManualInput() {
  const resultsEl = document.getElementById('search-results');
  if (resultsEl.querySelector('.manual-input-form')) {
    resultsEl.innerHTML = '';
    _manualCoverBase64 = '';
    return;
  }
  _manualCoverBase64 = '';
  resultsEl.innerHTML = '';
  const form = document.createElement('div');
  form.className = 'manual-input-form';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'manual-title';
  titleInput.className = 'manual-title-input';
  titleInput.placeholder = '책 제목을 입력해주세요';
  titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmManualInput(); });
  form.appendChild(titleInput);

  const coverLabel = document.createElement('label');
  coverLabel.className = 'manual-cover-label';
  const coverInput = document.createElement('input');
  coverInput.type = 'file';
  coverInput.accept = 'image/*';
  coverInput.style.display = 'none';
  coverInput.addEventListener('change', handleManualCoverChange);
  const coverBtn = document.createElement('span');
  coverBtn.className = 'manual-cover-btn';
  coverBtn.textContent = '📷 표지 이미지 선택 (선택)';
  coverLabel.appendChild(coverInput);
  coverLabel.appendChild(coverBtn);
  form.appendChild(coverLabel);

  const preview = document.createElement('div');
  preview.id = 'manual-cover-preview';
  form.appendChild(preview);

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'manual-confirm-btn';
  confirmBtn.textContent = '✓ 선택';
  confirmBtn.onclick = confirmManualInput;
  form.appendChild(confirmBtn);

  resultsEl.appendChild(form);
  titleInput.focus();
}

function handleManualCoverChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const maxW = 600, maxH = 900;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      _manualCoverBase64 = c.toDataURL('image/jpeg', 0.75);
      const preview = document.getElementById('manual-cover-preview');
      if (preview) preview.innerHTML = `<img src="${_manualCoverBase64}">`;
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function confirmManualInput() {
  const title = document.getElementById('manual-title')?.value.trim();
  if (!title) { showToast('책 제목을 입력해주세요', true); return; }
  selectBook({ title, cover: _manualCoverBase64 });
  _manualCoverBase64 = '';
}

function renderSearchResults(items) {
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '';
  items.forEach((item, i) => {
    let cover = item.cover;
    if (cover) cover = cover.replace('http://', 'https://');
    const thumb = document.createElement('div'); thumb.className = 'result-thumb';
    if (cover) {
      const img = document.createElement('img');
      img.src = cover; img.alt = item.title;
      img.onerror = function() {
        const ph = document.createElement('div');
        ph.className = 'no-cover-thumb';
        ph.style.background = FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length];
        ph.textContent = '📚'; this.replaceWith(ph);
      };
      thumb.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'no-cover-thumb';
      ph.style.background = FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length];
      ph.textContent = '📚'; thumb.appendChild(ph);
    }
    const label = document.createElement('span'); label.textContent = item.title;
    thumb.appendChild(label);
    thumb.onclick = () => selectBook({ title: item.title, cover });
    resultsEl.appendChild(thumb);
  });
}

function selectBook(bookData) {
  selectedBookData = bookData;
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('sel-title').textContent = bookData.title;
  const img = document.getElementById('sel-cover');
  if (bookData.cover) { img.src = bookData.cover; img.style.display = ''; }
  else img.style.display = 'none';
  document.getElementById('selected-book').classList.remove('hidden');
}
function deselectBook() { selectedBookData = null; document.getElementById('selected-book').classList.add('hidden'); }

// ── Stars ─────────────────────────────────────────────────
let currentRating = 0;

function starsHTML(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const fill = Math.min(Math.max(rating - (i - 1), 0), 1);
    const pct  = Math.round(fill * 100);
    const glow = fill === 0 ? 'text-shadow:none'
      : `text-shadow:0 0 ${(2+fill*5).toFixed(1)}px #FFF5DC,0 0 ${(5+fill*8).toFixed(1)}px rgba(245,217,122,${(0.25+fill*0.35).toFixed(2)})`;
    html += `<span class="star-cell"><span class="star-empty">✦</span><span class="star-full" style="width:${pct}%;${glow}">✦</span></span>`;
  }
  return html;
}
function starsInputHTML() {
  let html = '';
  for (let i = 0; i < 5; i++)
    html += `<span class="star-cell"><span class="star-empty">✦</span><span class="star-full" style="width:0%">✦</span></span>`;
  return html;
}
function renderInputStars(rating) {
  document.querySelectorAll('#star-rating .star-cell').forEach((cell, i) => {
    const fill = Math.min(Math.max(rating - i, 0), 1);
    const pct  = fill >= 1 ? 100 : fill >= 0.5 ? 50 : 0;
    cell.querySelector('.star-full').style.width = pct + '%';
  });
}
function resetStars() { renderInputStars(currentRating); }
function setStars(n)  { currentRating = n; renderInputStars(n); }
function initStarInput() {
  const container = document.getElementById('star-rating');
  container.innerHTML = starsInputHTML();
  container.addEventListener('mousemove', e => {
    const cell = e.target.closest('.star-cell'); if (!cell) return;
    const cells = [...container.querySelectorAll('.star-cell')];
    const idx   = cells.indexOf(cell);
    const rect  = cell.getBoundingClientRect();
    renderInputStars(idx + (e.clientX < rect.left + rect.width / 2 ? 0.5 : 1));
  });
  container.addEventListener('mouseleave', resetStars);
  container.addEventListener('click', e => {
    const cell = e.target.closest('.star-cell'); if (!cell) return;
    const cells = [...container.querySelectorAll('.star-cell')];
    const idx   = cells.indexOf(cell);
    const rect  = cell.getBoundingClientRect();
    setStars(idx + (e.clientX < rect.left + rect.width / 2 ? 0.5 : 1));
  });
}

// ── Passages ──────────────────────────────────────────────
function addRegPassagePair() {
  const pair = document.createElement('div'); pair.className = 'passage-pair';
  pair.innerHTML = `
    <textarea placeholder="인상 깊었던 구절을 적어주세요"></textarea>
    <textarea placeholder="독서메이트 코멘트를 남겨주세요"></textarea>
    <button class="remove-pair-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  document.getElementById('reg-passages-input').appendChild(pair);
}
function collectRegPassages() {
  return Array.from(document.querySelectorAll('#reg-passages-input .passage-pair')).map(pair => {
    const txts = pair.querySelectorAll('textarea');
    return { text: txts[0]?.value.trim() || '', comment: txts[1]?.value.trim() || '' };
  }).filter(p => p.text);
}

// ── Register ──────────────────────────────────────────────
function registerBook() {
  if (!selectedBookData)  { showToast('책을 먼저 선택해주세요 📚', true); return; }
  if (currentRating === 0){ showToast('별점을 선택해주세요 ★', true); return; }

  const bookId = generateId();
  const book   = { id:bookId, title:selectedBookData.title, cover:selectedBookData.cover,
                   registeredBy:currentUser.id, registeredAt:new Date().toISOString() };
  const review = { bookId, userId:currentUser.id, userName:currentUser.name,
                   rating:currentRating, oneLiner:document.getElementById('one-liner').value.trim(),
                   mateComment:'', passages:collectRegPassages(), placePhoto:'', youtubeUrl:'', song:'',
                   createdAt:new Date().toISOString() };

  const books   = getBooks();   books.push(book);     saveBooks(books);
  const reviews = getReviews(); reviews.push(review); saveReviews(reviews);

  selectedBookData = null; currentRating = 0;
  document.getElementById('selected-book').classList.add('hidden');
  document.getElementById('book-search').value = '';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('one-liner').value = '';
  document.getElementById('reg-passages-input').innerHTML = '';
  addRegPassagePair();
  resetStars();
  showToast('📚 책이 등록되었어요!');
}

// ── Star deco ─────────────────────────────────────────────
function fillChalkDeco(containerId, count) {
  const symbols = ['★','★','★','☆','✦','✦','✧','✧','·','·','·'];
  const container = document.getElementById(containerId);
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    s.textContent = sym;
    const isTiny = sym === '·';
    const size   = isTiny ? Math.round(4 + Math.random() * 4) : Math.round(6 + Math.random() * 16);
    const top    = (Math.random() * 98).toFixed(1);
    const left   = (Math.random() * 96).toFixed(1);
    const dur    = (2 + Math.random() * 5).toFixed(1);
    const delay  = -(Math.random() * 6).toFixed(1);
    const anim   = Math.random() < 0.6 ? 'twinkle' : 'fall';
    s.style.cssText = `top:${top}%;left:${left}%;font-size:${size}px;animation:${anim} ${dur}s ease-in-out infinite alternate;animation-delay:${delay}s;color:white;opacity:0.12;position:absolute;pointer-events:none;`;
    container.appendChild(s);
  }
}
fillChalkDeco('chalk-deco', 60);
fillChalkDeco('chalk-deco-right', 60);

// ── Admin ─────────────────────────────────────────────────
const DEV_ID = 'mneu8bp1gjbsb';

function openAdminPanel()  { document.getElementById('admin-overlay').classList.remove('hidden'); switchAdminTab('books'); }
function closeAdminPanel() { document.getElementById('admin-overlay').classList.add('hidden'); }

function switchAdminTab(tab) {
  if (tab === 'colors' && currentUserInit.id !== DEV_ID) return;
  ['books','members','colors'].forEach(t => {
    document.getElementById('admin-content-' + t).classList.toggle('hidden', t !== tab);
    document.getElementById('atab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'books')         loadAdminBooks();
  else if (tab === 'members')  loadAdminMembers();
  else if (tab === 'colors')   loadAdminColors();
}

function loadAdminMembers() {
  const el = document.getElementById('admin-content-members');
  el.innerHTML = '';
  if (_registeredMembers.length === 0) {
    el.innerHTML = '<div class="admin-empty">등록된 멤버가 없어요</div>';
    return;
  }
  _registeredMembers.forEach(member => {
    const isMe = member.id === currentUserInit.id;
    const row = document.createElement('div'); row.className = 'admin-user-row'; row.id = 'member-row-' + member.id;
    const nameEl = document.createElement('div'); nameEl.className = 'admin-user-name';
    const dot = document.createElement('span');
    dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${getUserColor(member.id)};margin-right:8px;`;
    nameEl.appendChild(dot);
    nameEl.appendChild(document.createTextNode(member.name));
    if (isMe) {
      const badge = document.createElement('span');
      badge.style.cssText = 'margin-left:6px;font-size:10px;color:rgba(168,212,255,0.6)';
      badge.textContent = '(나)';
      nameEl.appendChild(badge);
    }
    row.appendChild(nameEl);
    if (!isMe) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'admin-action-btn del';
      kickBtn.textContent = '추방';
      kickBtn.onclick = () => kickMember(member.id, member.name);
      row.appendChild(kickBtn);
    }
    el.appendChild(row);
  });
}

function kickMember(memberId, memberName) {
  if (!confirm(`${memberName}님을 방에서 추방할까요?\n추방 시 JOINED CLUB 목록에서도 제거됩니다.`)) return;
  Promise.all([
    REGISTERED_MEMBERS_REF().child(memberId).remove(),
    MEMBERS_REF().child(memberId).remove(),
    db.ref('userRooms/' + memberId + '/' + roomId).remove(),
  ]).then(() => {
    showToast(`👢 ${memberName}님을 추방했어요`);
    loadAdminMembers();
  });
}

function loadAdminBooks() {
  const el = document.getElementById('admin-content-books');
  const books = getBooks();
  if (books.length === 0) { el.innerHTML = '<div class="admin-empty">등록된 책이 없어요</div>'; return; }
  el.innerHTML = '';
  books.forEach(book => {
    const row = document.createElement('div'); row.className = 'admin-book-row'; row.id = 'book-row-' + book.id;
    const cover = document.createElement('img'); cover.className = 'admin-book-cover'; cover.src = book.cover || '';
    cover.onerror = () => { cover.style.display = 'none'; }; row.appendChild(cover);
    const titleWrap = document.createElement('div'); titleWrap.className = 'admin-book-title'; titleWrap.textContent = book.title; row.appendChild(titleWrap);
    const editBtn = document.createElement('button'); editBtn.className = 'admin-action-btn edit'; editBtn.textContent = '수정';
    editBtn.onclick = () => startEditBook(book, titleWrap, editBtn); row.appendChild(editBtn);
    const delBtn = document.createElement('button'); delBtn.className = 'admin-action-btn del'; delBtn.textContent = '삭제';
    delBtn.onclick = () => deleteBook(book.id); row.appendChild(delBtn);
    el.appendChild(row);
  });
}

function startEditBook(book, titleWrap, editBtn) {
  const input = document.createElement('input'); input.value = book.title;
  titleWrap.innerHTML = ''; titleWrap.appendChild(input);
  editBtn.textContent = '저장'; editBtn.className = 'admin-action-btn save';
  editBtn.onclick = () => {
    const newTitle = input.value.trim(); if (!newTitle) return;
    const books = getBooks(); const b = books.find(x => x.id === book.id);
    if (b) { b.title = newTitle; saveBooks(books); }
    showToast('📚 책 제목이 수정됐어요!');
    setTimeout(() => loadAdminBooks(), 400);
  };
  input.focus();
}

function deleteBook(bookId) {
  if (!confirm('정말 이 책을 삭제할까요?')) return;
  saveBooks(getBooks().filter(b => b.id !== bookId));
  saveReviews(getReviews().filter(r => r.bookId !== bookId));
  showToast('🗑 책이 삭제됐어요');
  setTimeout(() => loadAdminBooks(), 400);
}


function loadAdminColors() {
  const el = document.getElementById('admin-content-colors');
  const palette = [...USER_COLORS];
  el.innerHTML = '';
  const desc = document.createElement('div');
  desc.style.cssText = 'font-family:Jua,sans-serif;font-size:13px;color:rgba(168,212,255,0.7);margin-bottom:14px;line-height:1.7';
  desc.textContent = '유저들이 선택할 수 있는 색상 팔레트를 설정하세요.';
  el.appendChild(desc);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px';
  palette.forEach((hex, i) => {
    const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px';
    const swatch = document.createElement('div');
    swatch.style.cssText = `width:44px;height:44px;border-radius:50%;background:${hex};cursor:pointer;border:2px solid rgba(255,255,255,0.2);transition:transform 0.15s;position:relative`;
    const input = document.createElement('input'); input.type = 'color'; input.value = hex;
    input.style.cssText = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border:none;padding:0';
    input.addEventListener('input', () => { swatch.style.background = input.value; palette[i] = input.value; });
    swatch.appendChild(input);
    swatch.addEventListener('mouseenter', () => { swatch.style.transform = 'scale(1.15)'; });
    swatch.addEventListener('mouseleave', () => { swatch.style.transform = 'scale(1)'; });
    const label = document.createElement('div'); label.style.cssText = 'font-size:10px;font-family:monospace;color:rgba(255,255,255,0.5)';
    label.textContent = `${i+1}번`;
    wrap.appendChild(swatch); wrap.appendChild(label); grid.appendChild(wrap);
  });
  el.appendChild(grid);
  const saveBtn = document.createElement('button'); saveBtn.className = 'admin-action-btn save';
  saveBtn.style.cssText = 'width:100%;padding:10px;font-size:12px'; saveBtn.textContent = '팔레트 저장';
  saveBtn.onclick = () => { db.ref('config/palette').set(palette, err => { if (!err) showToast('🎨 색상 팔레트가 저장됐어요!'); }); };
  el.appendChild(saveBtn);
}


function deleteRoom() {
  document.getElementById('delete-room-overlay').classList.remove('hidden');
}
function closeDeleteConfirm() {
  document.getElementById('delete-room-overlay').classList.add('hidden');
}
function confirmDeleteRoom() {
  closeDeleteConfirm();
  const removeUserRooms = _registeredMembers.map(m =>
    db.ref('userRooms/' + m.id + '/' + roomId).remove()
  );
  Promise.all(removeUserRooms)
    .then(() => ROOM_REF().remove())
    .then(() => { window.location.href = 'waiting.html'; })
    .catch(() => showToast('방 삭제 중 오류가 발생했어요', true));
}

// ── Init ──────────────────────────────────────────────────
const currentUserInit = checkAuth();
const currentUser = currentUserInit; // alias
let isRoomOwner = false;

// 방 존재 확인 후 초기화
ROOM_REF().once('value', snap => {
  if (!snap.exists()) { window.location.href = 'waiting.html'; return; }

  const room = snap.val();
  isRoomOwner = room.createdBy === currentUserInit.id;
  if (isRoomOwner) {
    document.getElementById('admin-btn').classList.remove('hidden');
  }
  if (currentUserInit.id === DEV_ID) {
    document.getElementById('atab-colors').classList.remove('hidden');
  }

  loadRoomBanner();
  joinAsRoomMember();
  setupRealtimeListeners();
  initStarInput();
  addRegPassagePair();
});
