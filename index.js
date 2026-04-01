// In-memory 캐시
let _books = [];
let _reviews = [];
let _users = [];

// 실시간 리스너
function setupRealtimeListeners() {
  db.ref('books').on('value', snap => {
    _books = snap.exists() ? Object.values(snap.val()) : [];
    if (typeof renderBookshelf === 'function') renderBookshelf();
  });
  db.ref('reviews').on('value', snap => {
    _reviews = snap.exists() ? Object.values(snap.val()) : [];
    if (typeof renderBookshelf === 'function') renderBookshelf();
  });
  db.ref('users').on('value', snap => {
    _users = snap.exists() ? Object.values(snap.val()) : [];
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
  db.ref('books').set(obj);
}
function saveReviews(reviews) {
  const obj = {};
  reviews.forEach(r => { obj[r.bookId + '_' + r.userId] = r; });
  db.ref('reviews').set(obj);
}
function saveUsers(users) {
  const obj = {};
  users.forEach(u => { obj[u.id] = u; });
  db.ref('users').set(obj);
}
function logout()     { sessionStorage.removeItem('currentUser'); window.location.href = 'login.html'; }

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

  // ── 별자리 레이아웃 계산 ──────────────────────────────────
  const CARD_W  = 90;
  const CARD_H  = 155;
  const COLS    = 3;
  const CELL_H  = 240;
  const PAD     = 12;

  const containerW = board.clientWidth || 460;
  const CELL_W     = (containerW - PAD * 2) / COLS;
  const rowCount   = Math.ceil(books.length / COLS);
  const containerH = rowCount * CELL_H + PAD * 2 + 40;
  board.style.height = containerH + 'px';

  // 각 카드 중심 좌표 계산 (SVG 선 연결용)
  const positions = books.map((book, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const rx  = seededRandom(book.id + '_x');
    const ry  = seededRandom(book.id + '_y');
    const maxOffX = Math.max(0, CELL_W - CARD_W - PAD);
    const maxOffY = Math.max(0, CELL_H - CARD_H - PAD);
    const x = PAD + col * CELL_W + rx * maxOffX;
    const y = PAD + row * CELL_H + ry * maxOffY;
    return { x, y, cx: x + CARD_W / 2, cy: y + CARD_H / 2 };
  });

  // ── SVG 별자리 선 ────────────────────────────────────────
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:0;overflow:visible;';

  board.appendChild(svg);

  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i];
    const b = positions[i + 1];

    // 네온 외곽 — 두껍고 반투명
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    glow.setAttribute('x1', a.cx); glow.setAttribute('y1', a.cy);
    glow.setAttribute('x2', b.cx); glow.setAttribute('y2', b.cy);
    glow.setAttribute('stroke', 'rgba(180,220,255,0.25)');
    glow.setAttribute('stroke-width', '4');
    glow.setAttribute('stroke-dasharray', '4 7');
    svg.appendChild(glow);

    // 네온 코어 — 얇고 밝은 선명한 선
    const core = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    core.setAttribute('x1', a.cx); core.setAttribute('y1', a.cy);
    core.setAttribute('x2', b.cx); core.setAttribute('y2', b.cy);
    core.setAttribute('stroke', 'rgba(220,240,255,0.9)');
    core.setAttribute('stroke-width', '1');
    core.setAttribute('stroke-dasharray', '4 7');
    svg.appendChild(core);
  }

  // ── 카드 생성 ─────────────────────────────────────────────
  books.forEach((book, i) => {
    const bookReviews = reviews.filter(r => r.bookId === book.id && r.rating > 0);
    const avgRating   = bookReviews.length
      ? bookReviews.reduce((s, r) => s + r.rating, 0) / bookReviews.length
      : null;
    const filledStars = avgRating !== null ? Math.round(avgRating) : 0;
    const { x, y }    = positions[i];

    const card = document.createElement('div');
    card.className = 'book-card';
    card.style.cssText = `
      position:absolute;
      left:${x}px; top:${y}px;
      width:${CARD_W}px; height:${CARD_H}px;
      animation-delay:${i * 0.07}s;
    `;
    card.title = book.title;


    // 표지
    const inner = document.createElement('div');
    inner.className = 'book-card-inner';
    inner.style.width  = '100%';
    inner.style.height = '100%';
    if (book.cover) {
      inner.style.backgroundImage = `url('${book.cover}')`;
    } else {
      inner.style.background = FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length];
    }
    const titleEl = document.createElement('div');
    titleEl.className = 'cover-title';
    titleEl.textContent = book.title;
    inner.appendChild(titleEl);
    card.appendChild(inner);

    // 별점 스티커
    const sticker = document.createElement('div');
    sticker.className = 'card-stars-sticker';
    sticker.innerHTML = avgRating !== null ? starsHTML(avgRating) : starsHTML(0);
    card.appendChild(sticker);

    // 등록자 도트
    const dot = document.createElement('div');
    dot.className = 'owner-dot';
    const ownerColor = getUserColor(book.registeredBy);
    dot.style.background = ownerColor;
    const ownerName = users.find(u => u.id === book.registeredBy)?.name || '';
    dot.title = ownerName;
    card.appendChild(dot);

    // 픽셀 말풍선
    const ownerReview = reviews.find(r => r.bookId === book.id && r.userId === book.registeredBy);
    if (ownerReview?.oneLiner) {
      const bubble = document.createElement('div');
      bubble.className = 'pixel-bubble';
      bubble.textContent = ownerReview.oneLiner;
      bubble.style.setProperty('--bubble-color', ownerColor);
      bubble.style.setProperty('--bubble-glow', ownerColor + '55');
      card.appendChild(bubble);
    }

    card.onclick = () => { window.location.href = `detail.html?id=${book.id}`; };
    board.appendChild(card);
  });
}

// ── Members ───────────────────────────────────────────────

function renderMembers() {
  const currentUser = getCurrentUser();
  const users = getUsers();
  const bar   = document.getElementById('members-bar');
  bar.innerHTML = '';
  if (users.length === 0) {
    bar.innerHTML = '<span style="color:#CCC;font-size:13px">아직 멤버가 없어요</span>';
    return;
  }
  const sorted = [...users.filter(u=>u.id===currentUser.id), ...users.filter(u=>u.id!==currentUser.id)];
  sorted.forEach((user) => {
    const circle = document.createElement('div');
    circle.className = 'member-circle' + (user.id===currentUser.id ? ' me' : '');
    circle.title = user.name;
    circle.textContent = user.name.charAt(0);
    circle.style.background = getUserColor(user.id);
    if (user.id === currentUser.id) {
      circle.addEventListener('click', e => {
        e.stopPropagation();
        if (_colorPickerOpen) closeColorPicker();
        else openColorPicker(circle, user.id);
      });
    }
    bar.appendChild(circle);
  });
}

// ── Color Picker ──────────────────────────────────────────
let _colorPickerOpen = false;

function openColorPicker(circleEl, userId) {
  closeColorPicker();
  const users      = getUsers();
  const takenColors = new Set(
    users.filter(u => u.id !== userId && u.color).map(u => u.color.toUpperCase())
  );
  const myColor = getUserColor(userId).toUpperCase();

  const popover = document.createElement('div');
  popover.className = 'color-picker-popover';
  popover.id        = 'color-picker-popover';

  const label = document.createElement('div');
  label.className   = 'color-picker-label';
  label.textContent = '내 색상 선택 ✦';
  popover.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'color-swatches';
  USER_COLORS.forEach(hex => {
    const swatch = document.createElement('div');
    swatch.className   = 'color-swatch';
    swatch.style.background = hex;
    swatch.title       = hex;
    const upper = hex.toUpperCase();
    if (takenColors.has(upper)) {
      swatch.classList.add('swatch-taken');
    } else {
      if (upper === myColor) swatch.classList.add('swatch-current');
      swatch.addEventListener('click', e => {
        e.stopPropagation();
        saveUserColor(userId, hex);
        closeColorPicker();
      });
    }
    grid.appendChild(swatch);
  });
  popover.appendChild(grid);
  document.body.appendChild(popover);

  requestAnimationFrame(() => {
    const rect = circleEl.getBoundingClientRect();
    const pw   = popover.offsetWidth;
    const ph   = popover.offsetHeight;
    let left   = rect.left + rect.width / 2 - pw / 2;
    let top    = rect.top  - ph - 12;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    popover.style.left = left + 'px';
    popover.style.top  = top  + 'px';
  });

  _colorPickerOpen = true;
  setTimeout(() => {
    document.addEventListener('click', closeColorPicker, { once: true });
  }, 0);
}

function closeColorPicker() {
  const el = document.getElementById('color-picker-popover');
  if (el) el.remove();
  _colorPickerOpen = false;
}

function saveUserColor(userId, hex) {
  db.ref('users/' + userId).update({ color: hex });
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
    '&QueryType=Title&MaxResults=10&SearchTarget=Book',
    '&Version=20131101&Cover=Big',
  ].join('');

  try {
    const res    = await fetch(`https://corsproxy.io/?${encodeURIComponent(apiUrl)}`);
    const text   = await res.text();
    const parser = new DOMParser();
    const xml    = parser.parseFromString(text, 'text/xml');
    const itemEls = Array.from(xml.querySelectorAll('item'));

    if (itemEls.length === 0) {
      resultsEl.innerHTML = '<span class="no-results">검색 결과가 없어요 😢</span>';
      return;
    }

    const items = itemEls.map(el => ({
      title:  el.querySelector('title')?.textContent  || '제목 없음',
      cover:  el.querySelector('cover')?.textContent  || '',
      author: el.querySelector('author')?.textContent || '',
    }));

    renderSearchResults(items);
  } catch {
    resultsEl.innerHTML = '<span class="no-results">검색 중 오류가 발생했어요 😢</span>';
  }
}

function renderSearchResults(items) {
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '';
  items.forEach((item, i) => {
    const title = item.title;
    let cover   = item.cover;
    if (cover) cover = cover.replace('http://', 'https://');

    const thumb = document.createElement('div');
    thumb.className = 'result-thumb';

    if (cover) {
      const img = document.createElement('img');
      img.src = cover; img.alt = title;
      img.onerror = function() {
        const ph = document.createElement('div');
        ph.className = 'no-cover-thumb';
        ph.style.background = FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length];
        ph.textContent = '📚';
        this.replaceWith(ph);
      };
      thumb.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'no-cover-thumb';
      ph.style.background = FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length];
      ph.textContent = '📚';
      thumb.appendChild(ph);
    }

    const label = document.createElement('span');
    label.textContent = title;
    thumb.appendChild(label);
    thumb.onclick = () => selectBook({ title, cover });
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

function deselectBook() {
  selectedBookData = null;
  document.getElementById('selected-book').classList.add('hidden');
}

// ── Stars (반별 지원) ──────────────────────────────────────
let currentRating = 0;

// 별 HTML 생성 (카드 display용 — 실제 비율 + glow 비례)
function starsHTML(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const fill = Math.min(Math.max(rating - (i - 1), 0), 1);
    const pct  = Math.round(fill * 100);
    const glow = fill === 0
      ? 'text-shadow:none'
      : `text-shadow:0 0 ${(2 + fill * 5).toFixed(1)}px #FFF5DC,0 0 ${(5 + fill * 8).toFixed(1)}px rgba(245,217,122,${(0.25 + fill * 0.35).toFixed(2)})`;
    html += `<span class="star-cell"><span class="star-empty">✦</span><span class="star-full" style="width:${pct}%;${glow}">✦</span></span>`;
  }
  return html;
}

// 별 HTML 생성 (입력용 초기화 — 0/50/100% 스냅)
function starsInputHTML() {
  let html = '';
  for (let i = 0; i < 5; i++)
    html += `<span class="star-cell"><span class="star-empty">✦</span><span class="star-full" style="width:0%">✦</span></span>`;
  return html;
}

// 입력 별점 렌더
function renderInputStars(rating) {
  const cells = document.querySelectorAll('#star-rating .star-cell');
  cells.forEach((cell, i) => {
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
    const cell = e.target.closest('.star-cell');
    if (!cell) return;
    const cells = [...container.querySelectorAll('.star-cell')];
    const idx   = cells.indexOf(cell);
    const rect  = cell.getBoundingClientRect();
    const half  = e.clientX < rect.left + rect.width / 2;
    renderInputStars(idx + (half ? 0.5 : 1));
  });
  container.addEventListener('mouseleave', resetStars);
  container.addEventListener('click', e => {
    const cell = e.target.closest('.star-cell');
    if (!cell) return;
    const cells = [...container.querySelectorAll('.star-cell')];
    const idx   = cells.indexOf(cell);
    const rect  = cell.getBoundingClientRect();
    const half  = e.clientX < rect.left + rect.width / 2;
    setStars(idx + (half ? 0.5 : 1));
  });
}

// ── 구절 쌍 (등록 폼) ─────────────────────────────────────
function addRegPassagePair() {
  const pair = document.createElement('div');
  pair.className = 'passage-pair';
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
  const currentUser = getCurrentUser();
  if (!selectedBookData)  { showToast('책을 먼저 선택해주세요 📚', true); return; }
  if (currentRating === 0){ showToast('별점을 선택해주세요 ★', true); return; }

  const bookId = generateId();
  const book   = { id:bookId, title:selectedBookData.title, cover:selectedBookData.cover, registeredBy:currentUser.id, registeredAt:new Date().toISOString() };
  const review = { bookId, userId:currentUser.id, userName:currentUser.name, rating:currentRating, oneLiner:document.getElementById('one-liner').value.trim(), mateComment:'', passages:collectRegPassages(), placePhoto:'', youtubeUrl:'', song:'', createdAt:new Date().toISOString() };

  const books   = getBooks();   books.push(book);     saveBooks(books);
  const reviews = getReviews(); reviews.push(review); saveReviews(reviews);

  selectedBookData = null; currentRating = 0;
  document.getElementById('selected-book').classList.add('hidden');
  document.getElementById('book-search').value = '';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('one-liner').value = '';
  document.getElementById('reg-passages-input').innerHTML = '';
  addRegPassagePair();
  currentRating = 0; resetStars();
  renderBookshelf();
  showToast('📚 책이 등록되었어요!');
}

// ── Star deco (딥 스페이스 반짝임) ───────────────────────
function fillChalkDeco(containerId, count) {
  const symbols = ['★','★','★','☆','✦','✦','✧','✧','·','·','·'];
  const container = document.getElementById(containerId);
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    s.textContent = sym;
    const isTiny = sym === '·';
    const size  = isTiny ? Math.round(4 + Math.random() * 4) : Math.round(6 + Math.random() * 16);
    const top   = (Math.random() * 98).toFixed(1);
    const left  = (Math.random() * 96).toFixed(1);
    const dur   = (2 + Math.random() * 5).toFixed(1);
    const delay = -(Math.random() * 6).toFixed(1);
    // 일부는 반짝임, 나머지는 표류
    const anim  = Math.random() < 0.6 ? 'twinkle' : 'fall';
    s.style.cssText = `top:${top}%;left:${left}%;font-size:${size}px;animation:${anim} ${dur}s ease-in-out infinite alternate;animation-delay:${delay}s;color:white;opacity:0.12;position:absolute;pointer-events:none;`;
    container.appendChild(s);
  }
}
fillChalkDeco('chalk-deco', 60);
fillChalkDeco('chalk-deco-right', 60);

// ── Admin ─────────────────────────────────────────────────
function openAdminPanel() {
  const overlay = document.getElementById('admin-overlay');
  overlay.classList.remove('hidden');
  switchAdminTab('books');
}

function closeAdminPanel() {
  document.getElementById('admin-overlay').classList.add('hidden');
}

function switchAdminTab(tab) {
  ['books','users','colors'].forEach(t => {
    document.getElementById('admin-content-' + t).classList.toggle('hidden', t !== tab);
    document.getElementById('atab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'books')  loadAdminBooks();
  else if (tab === 'users')  loadPendingUsers();
  else if (tab === 'colors') loadAdminColors();
}

function loadAdminBooks() {
  const el = document.getElementById('admin-content-books');
  const books = getBooks();
  if (books.length === 0) { el.innerHTML = '<div class="admin-empty">등록된 책이 없어요</div>'; return; }
  el.innerHTML = '';
  books.forEach(book => {
    const row = document.createElement('div');
    row.className = 'admin-book-row';
    row.id = 'book-row-' + book.id;

    const cover = document.createElement('img');
    cover.className = 'admin-book-cover';
    cover.src = book.cover || '';
    cover.onerror = () => { cover.style.display = 'none'; };
    row.appendChild(cover);

    const titleWrap = document.createElement('div');
    titleWrap.className = 'admin-book-title';
    titleWrap.textContent = book.title;
    row.appendChild(titleWrap);

    const editBtn = document.createElement('button');
    editBtn.className = 'admin-action-btn edit';
    editBtn.textContent = '수정';
    editBtn.onclick = () => startEditBook(book, titleWrap, editBtn);
    row.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'admin-action-btn del';
    delBtn.textContent = '삭제';
    delBtn.onclick = () => deleteBook(book.id);
    row.appendChild(delBtn);

    el.appendChild(row);
  });
}

function startEditBook(book, titleWrap, editBtn) {
  const input = document.createElement('input');
  input.value = book.title;
  titleWrap.innerHTML = '';
  titleWrap.appendChild(input);
  editBtn.textContent = '저장';
  editBtn.className = 'admin-action-btn save';
  editBtn.onclick = () => {
    const newTitle = input.value.trim();
    if (!newTitle) return;
    const books = getBooks();
    const b = books.find(x => x.id === book.id);
    if (b) { b.title = newTitle; saveBooks(books); }
    showToast('📚 책 제목이 수정됐어요!');
    setTimeout(() => loadAdminBooks(), 400);
  };
  input.focus();
}

function deleteBook(bookId) {
  if (!confirm('정말 이 책을 삭제할까요?')) return;
  const books = getBooks().filter(b => b.id !== bookId);
  saveBooks(books);
  const reviews = getReviews().filter(r => r.bookId !== bookId);
  saveReviews(reviews);
  showToast('🗑 책이 삭제됐어요');
  setTimeout(() => loadAdminBooks(), 400);
}

function loadPendingUsers() {
  const el = document.getElementById('admin-content-users');
  el.innerHTML = '<div class="admin-empty">불러오는 중...</div>';
  db.ref('pendingUsers').once('value', snap => {
    const pending = snap.exists() ? Object.values(snap.val()) : [];
    if (pending.length === 0) { el.innerHTML = '<div class="admin-empty">대기 중인 회원이 없어요 ✦</div>'; return; }
    el.innerHTML = '';
    pending.forEach(user => {
      const row = document.createElement('div');
      row.className = 'admin-user-row';
      row.id = 'user-row-' + user.id;

      const name = document.createElement('div');
      name.className = 'admin-user-name';
      name.textContent = '👤 ' + user.name;
      row.appendChild(name);

      const approveBtn = document.createElement('button');
      approveBtn.className = 'admin-approve-btn';
      approveBtn.textContent = '승인';
      approveBtn.onclick = () => approveUser(user);
      row.appendChild(approveBtn);

      el.appendChild(row);
    });
  });
}

function loadAdminColors() {
  const el = document.getElementById('admin-content-colors');
  const palette = [...USER_COLORS];

  el.innerHTML = '';

  const desc = document.createElement('div');
  desc.style.cssText = 'font-family:Jua,sans-serif;font-size:13px;color:rgba(168,212,255,0.7);margin-bottom:14px;line-height:1.7';
  desc.textContent = '유저들이 선택할 수 있는 색상 팔레트를 설정하세요. 스와치를 클릭하면 색을 바꿀 수 있어요.';
  el.appendChild(desc);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px';

  palette.forEach((hex, i) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px';

    const swatch = document.createElement('div');
    swatch.style.cssText = `width:44px;height:44px;border-radius:50%;background:${hex};cursor:pointer;border:2px solid rgba(255,255,255,0.2);transition:transform 0.15s;position:relative`;
    swatch.title = hex;

    const input = document.createElement('input');
    input.type  = 'color';
    input.value = hex;
    input.style.cssText = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border:none;padding:0';
    input.addEventListener('input', () => {
      swatch.style.background = input.value;
      palette[i] = input.value;
    });

    swatch.appendChild(input);
    swatch.addEventListener('mouseenter', () => { swatch.style.transform = 'scale(1.15)'; });
    swatch.addEventListener('mouseleave', () => { swatch.style.transform = 'scale(1)'; });

    const label = document.createElement('div');
    label.style.cssText = 'font-size:10px;font-family:monospace;color:rgba(255,255,255,0.5)';
    label.textContent = `${i+1}번`;

    wrap.appendChild(swatch);
    wrap.appendChild(label);
    grid.appendChild(wrap);
  });

  el.appendChild(grid);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'admin-action-btn save';
  saveBtn.style.cssText = 'width:100%;padding:10px;font-size:12px';
  saveBtn.textContent = '팔레트 저장';
  saveBtn.onclick = () => {
    db.ref('config/palette').set(palette, err => {
      if (!err) showToast('🎨 색상 팔레트가 저장됐어요!');
    });
  };
  el.appendChild(saveBtn);
}

function approveUser(user) {
  db.ref('users/' + user.id).set(user, () => {
    db.ref('pendingUsers/' + user.id).remove(() => {
      showToast('✅ ' + user.name + ' 승인 완료!');
      document.getElementById('user-row-' + user.id)?.remove();
      const el = document.getElementById('admin-content-users');
      if (el && el.children.length === 0) {
        el.innerHTML = '<div class="admin-empty">대기 중인 회원이 없어요 ✦</div>';
      }
    });
  });
}

// ── Init ──────────────────────────────────────────────────
const currentUserInit = checkAuth();
if (currentUserInit && currentUserInit.name === '문서희') {
  document.getElementById('admin-btn').classList.remove('hidden');
}
setupRealtimeListeners();
initStarInput();
addRegPassagePair();
