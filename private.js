// ── 접근 제어 ─────────────────────────────────────────────
const currentUser = checkAuth();

// ── 별 배경 효과 ──────────────────────────────────────────
function fillChalkDeco(containerId, count) {
  const symbols = ['★','★','★','☆','✦','✦','✧','✧','·','·','·'];
  const container = document.getElementById(containerId);
  if (!container) return;
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
    const anim  = Math.random() < 0.6 ? 'twinkle' : 'fall';
    s.style.cssText = `top:${top}%;left:${left}%;font-size:${size}px;animation:${anim} ${dur}s ease-in-out infinite alternate;animation-delay:${delay}s;color:white;opacity:0.12;position:absolute;pointer-events:none;`;
    container.appendChild(s);
  }
}
fillChalkDeco('chalk-deco', 80);

// ── 데이터 캐시 ───────────────────────────────────────────
let _books = [], _reviews = [], _users = [];
let _privateNotes = {};
let _myReviewsData = [];
let _myReviewsPage = 0;

function getReviewsPerPage() {
  return window.innerWidth <= 480 ? 3 : 6;
}

function getBooks()   { return _books; }
function getReviews() { return _reviews; }
function getUsers()   { return _users; }

// ── 날짜 포맷 ─────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
}

// ── 별점 HTML ─────────────────────────────────────────────
function starsHTML(rating) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= rating ? '★' : '☆';
  return s;
}

// ── 프로필 렌더 ───────────────────────────────────────────
function renderProfile() {
  const users   = getUsers();
  const books   = getBooks();
  const reviews = getReviews();

  const user = users.find(u => u.id === currentUser.id);

  // 아바타
  const avatar = document.getElementById('profile-avatar');
  const color  = getUserColor(currentUser.id);
  avatar.style.background = color;
  avatar.textContent = currentUser.name.charAt(0);

  // 이름
  document.getElementById('profile-name').textContent = currentUser.name;

  // 가입일 (users 데이터에 joinedAt이 있으면 사용, 없으면 미표시)
  const joined = document.getElementById('profile-joined');
  if (user?.joinedAt) joined.textContent = 'JOINED ' + formatDate(user.joinedAt);
  else joined.textContent = '';

  // 통계
  const myBooks    = books.filter(b => b.registeredBy === currentUser.id);
  const myReviews  = reviews.filter(r => r.userId === currentUser.id && r.oneLiner);
  const myPassages = reviews.filter(r => r.userId === currentUser.id).flatMap(r => (r.passages || []).filter(p => p?.text));

  document.getElementById('stat-books').textContent   = myBooks.length;
  document.getElementById('stat-reviews').textContent = myReviews.length;
  document.getElementById('stat-passages').textContent = myPassages.length;
}

// ── 내가 등록한 책 ─────────────────────────────────────────
function renderMyBooks() {
  const books  = getBooks();
  const myBooks = books
    .filter(b => b.registeredBy === currentUser.id)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const container = document.getElementById('my-books');
  container.innerHTML = '';

  if (myBooks.length === 0) {
    container.innerHTML = '<div class="empty-msg">아직 등록한 책이 없어요 ✦</div>';
    return;
  }

  const FALLBACKS = [
    'linear-gradient(160deg,#AEE2FF,#D4BAFF)',
    'linear-gradient(160deg,#FFB6D9,#D4BAFF)',
    'linear-gradient(160deg,#C8F57A,#AEE2FF)',
    'linear-gradient(160deg,#FFB6D9,#FFE0A0)',
    'linear-gradient(160deg,#D4BAFF,#C8F57A)',
  ];

  myBooks.forEach((book, i) => {
    const card = document.createElement('div');
    card.className = 'priv-card';
    card.style.animationDelay = (i * 0.05) + 's';

    if (book.cover) {
      const img = document.createElement('img');
      img.className = 'priv-cover';
      img.src = book.cover;
      img.alt = book.title;
      card.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'priv-cover-ph';
      ph.style.background = FALLBACKS[i % FALLBACKS.length];
      ph.textContent = '📖';
      card.appendChild(ph);
    }

    const title = document.createElement('div');
    title.className = 'priv-title';
    title.textContent = book.title || '';
    card.appendChild(title);

    const date = document.createElement('div');
    date.className = 'priv-date';
    date.textContent = formatDate(book.timestamp);
    card.appendChild(date);

    card.onclick = () => { window.location.href = `detail.html?id=${book.id}`; };
    container.appendChild(card);
  });
}

// ── 내가 남긴 독후감 (페이지네이션) ──────────────────────────
function renderMyReviews() {
  const reviews = getReviews();
  _myReviewsData = reviews
    .filter(r => r.userId === currentUser.id && r.oneLiner)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const perPage = getReviewsPerPage();
  const totalPages = Math.max(1, Math.ceil(_myReviewsData.length / perPage));
  if (_myReviewsPage >= totalPages) _myReviewsPage = totalPages - 1;

  renderReviewsPage();
}

function renderReviewsPage() {
  const books = getBooks();
  const container = document.getElementById('my-reviews');

  const existingPag = document.getElementById('reviews-pagination');
  if (existingPag) existingPag.remove();

  container.innerHTML = '';

  if (_myReviewsData.length === 0) {
    container.innerHTML = '<div class="empty-msg">아직 남긴 독후감이 없어요 ✦</div>';
    return;
  }

  const FALLBACKS = [
    'linear-gradient(160deg,#AEE2FF,#D4BAFF)',
    'linear-gradient(160deg,#FFB6D9,#D4BAFF)',
    'linear-gradient(160deg,#C8F57A,#AEE2FF)',
    'linear-gradient(160deg,#D4BAFF,#C8F57A)',
    'linear-gradient(160deg,#FFE0A0,#D4BAFF)',
  ];

  const perPage = getReviewsPerPage();
  const start = _myReviewsPage * perPage;
  const pageItems = _myReviewsData.slice(start, start + perPage);

  pageItems.forEach((review, i) => {
    const book = books.find(b => b.id === review.bookId);
    if (!book) return;

    const existingNote = _privateNotes[book.id] || '';

    const card = document.createElement('div');
    card.className = 'priv-card';
    card.style.animationDelay = (i * 0.05) + 's';

    // 상단 행: 커버 + 제목/별점
    const topRow = document.createElement('div');
    topRow.className = 'review-top-row';

    if (book.cover) {
      const img = document.createElement('img');
      img.className = 'priv-cover';
      img.src = book.cover;
      img.alt = book.title;
      topRow.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'priv-cover-ph';
      ph.style.background = FALLBACKS[i % FALLBACKS.length];
      ph.textContent = '📖';
      topRow.appendChild(ph);
    }

    const headerWrap = document.createElement('div');
    headerWrap.className = 'review-header-wrap';

    const title = document.createElement('div');
    title.className = 'priv-title';
    title.textContent = book.title || '';
    headerWrap.appendChild(title);

    if (review.rating) {
      const stars = document.createElement('div');
      stars.className = 'priv-stars';
      stars.textContent = starsHTML(Math.round(review.rating));
      headerWrap.appendChild(stars);
    }

    topRow.appendChild(headerWrap);
    card.appendChild(topRow);

    // 하단: 리뷰 전문 + 날짜
    const oneliner = document.createElement('div');
    oneliner.className = 'priv-oneliner';
    oneliner.textContent = review.oneLiner;
    card.appendChild(oneliner);

    const date = document.createElement('div');
    date.className = 'priv-date';
    date.textContent = formatDate(review.timestamp);
    card.appendChild(date);

    // 나만의 메모 표시
    if (existingNote) {
      const noteDisplay = document.createElement('div');
      noteDisplay.className = 'private-note-display';
      noteDisplay.textContent = existingNote;
      card.appendChild(noteDisplay);
    }

    const noteRow = document.createElement('div');
    noteRow.className = 'private-note-row';
    noteRow.onclick = e => e.stopPropagation();

    const noteInput = document.createElement('textarea');
    noteInput.className = 'private-note-input';
    noteInput.placeholder = '나만의 메모...';
    noteInput.rows = 1;
    noteRow.appendChild(noteInput);

    const sendBtn = document.createElement('button');
    sendBtn.className = 'private-note-send';
    sendBtn.textContent = '✈';
    sendBtn.onclick = e => {
      e.stopPropagation();
      const text = noteInput.value.trim();
      if (!text) return;
      db.ref('privateNotes/' + currentUser.id + '/' + book.id).set(text);
      noteInput.value = '';
    };
    noteRow.appendChild(sendBtn);
    card.appendChild(noteRow);

    // 우측 상단 수정 버튼 (메모 있을 때만)
    if (existingNote) {
      const editBtn = document.createElement('button');
      editBtn.className = 'private-note-edit-btn';
      editBtn.textContent = '수정';
      editBtn.title = '메모 수정';
      editBtn.onclick = e => {
        e.stopPropagation();
        noteInput.value = existingNote;
        noteInput.focus();
      };
      card.appendChild(editBtn);
    }

    card.onclick = () => { window.location.href = `detail.html?id=${book.id}`; };
    container.appendChild(card);
  });

  renderReviewsPagination();
}

function renderReviewsPagination() {
  const perPage = getReviewsPerPage();
  const totalPages = Math.ceil(_myReviewsData.length / perPage);
  if (totalPages <= 1) return;

  const nav = document.createElement('div');
  nav.id = 'reviews-pagination';
  nav.className = 'reviews-pagination';

  for (let i = 0; i < totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-dot' + (i === _myReviewsPage ? ' active' : '');
    btn.textContent = i + 1;
    btn.onclick = () => {
      _myReviewsPage = i;
      renderReviewsPage();
    };
    nav.appendChild(btn);
  }

  document.getElementById('my-reviews').after(nav);
}

// ── 내가 남긴 구절 ─────────────────────────────────────────
function renderMyPassages() {
  const books   = getBooks();
  const reviews = getReviews();

  const allPassages = [];
  reviews
    .filter(r => r.userId === currentUser.id)
    .forEach(r => {
      const book = books.find(b => b.id === r.bookId);
      (r.passages || []).forEach(p => {
        if (p?.text) allPassages.push({ ...p, bookTitle: book?.title || '', bookId: r.bookId });
      });
    });

  const container = document.getElementById('my-passages');
  container.innerHTML = '';

  if (allPassages.length === 0) {
    container.innerHTML = '<div class="empty-msg">아직 남긴 구절이 없어요 ✦</div>';
    return;
  }

  allPassages.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'passage-scrap';
    card.style.animationDelay = (i * 0.05) + 's';
    const rot = (Math.random() * 6 - 3).toFixed(1);
    card.style.transform = `rotate(${rot}deg)`;

    const bookLabel = document.createElement('div');
    bookLabel.className = 'scrap-book-title';
    bookLabel.textContent = p.bookTitle;
    card.appendChild(bookLabel);

    const text = document.createElement('div');
    text.className = 'scrap-text';
    text.textContent = p.text;
    card.appendChild(text);

    if (p.comment) {
      const comment = document.createElement('div');
      comment.className = 'scrap-comment';
      comment.textContent = '💬 ' + p.comment;
      card.appendChild(comment);
    }

    card.onclick = () => { window.location.href = `detail.html?id=${p.bookId}`; };
    container.appendChild(card);
  });
}

// ── Edit Profile 팝업 ─────────────────────────────────────
function openEditProfile() {
  document.getElementById('edit-name').value = currentUser.name;
  document.getElementById('edit-current-pw').value = '';
  document.getElementById('edit-new-pw').value = '';
  document.getElementById('ep-error').textContent = '';
  document.getElementById('edit-profile-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('edit-name').focus(), 80);
}

function closeEditProfile() {
  document.getElementById('edit-profile-overlay').classList.add('hidden');
}

async function saveEditProfile() {
  const newName   = document.getElementById('edit-name').value.trim();
  const currentPw = document.getElementById('edit-current-pw').value;
  const newPw     = document.getElementById('edit-new-pw').value;
  const errorEl   = document.getElementById('ep-error');
  errorEl.textContent = '';

  if (!newName)   { errorEl.textContent = '닉네임을 입력해주세요'; return; }
  if (!currentPw) { errorEl.textContent = '현재 비밀번호를 입력해주세요'; return; }

  const snap = await db.ref('users/' + currentUser.id).once('value');
  const userData = snap.val();
  if (userData.password !== currentPw) {
    errorEl.textContent = '현재 비밀번호가 올바르지 않아요';
    return;
  }

  if (newName !== currentUser.name) {
    const usersSnap = await db.ref('users').once('value');
    const users = Object.values(usersSnap.val() || {});
    if (users.some(u => u.id !== currentUser.id && u.name === newName)) {
      errorEl.textContent = '이미 사용 중인 닉네임이에요';
      return;
    }
  }

  const updates = { name: newName };
  if (newPw) updates.password = newPw;
  await db.ref('users/' + currentUser.id).update(updates);

  if (newName !== currentUser.name) {
    const roomsSnap = await db.ref('userRooms/' + currentUser.id).once('value');
    if (roomsSnap.exists()) {
      Object.keys(roomsSnap.val()).forEach(roomId => {
        db.ref('rooms/' + roomId + '/registeredMembers/' + currentUser.id + '/name').set(newName);
        db.ref('rooms/' + roomId + '/members/' + currentUser.id + '/name').set(newName);
      });
    }
  }

  currentUser.name = newName;
  sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

  closeEditProfile();
  showToast(newPw ? '프로필과 비밀번호가 변경됐어요!' : '닉네임이 변경됐어요!');
  renderProfile();
}

// ── 전체 렌더 ─────────────────────────────────────────────
function renderAll() {
  renderProfile();
  renderMyBooks();
  renderMyReviews();
  renderMyPassages();
}

// ── Firebase 리스너 ───────────────────────────────────────
db.ref('books').on('value', snap => {
  _books = snap.exists() ? Object.values(snap.val()) : [];
  renderAll();
});
db.ref('reviews').on('value', snap => {
  _reviews = snap.exists() ? Object.values(snap.val()) : [];
  renderAll();
});
db.ref('users').on('value', snap => {
  _users = snap.exists() ? Object.values(snap.val()) : [];
  renderAll();
});
db.ref('privateNotes/' + currentUser.id).on('value', snap => {
  _privateNotes = snap.exists() ? snap.val() : {};
  renderMyReviews();
});

// ── MY REVIEWS 스와이프 (모바일) ──────────────────────────────
(function () {
  const container = document.getElementById('my-reviews');
  let startX = 0, startY = 0;
  container.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  container.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    const perPage = getReviewsPerPage();
    const totalPages = Math.ceil(_myReviewsData.length / perPage);
    if (dx < 0 && _myReviewsPage < totalPages - 1) {
      _myReviewsPage++;
      renderReviewsPage();
    } else if (dx > 0 && _myReviewsPage > 0) {
      _myReviewsPage--;
      renderReviewsPage();
    }
  }, { passive: true });
})();

let _lastPerPage = getReviewsPerPage();
window.addEventListener('resize', () => {
  const perPage = getReviewsPerPage();
  if (perPage === _lastPerPage) return;
  _lastPerPage = perPage;
  if (_myReviewsData.length > 0) {
    const totalPages = Math.max(1, Math.ceil(_myReviewsData.length / perPage));
    if (_myReviewsPage >= totalPages) _myReviewsPage = totalPages - 1;
    renderReviewsPage();
  }
});
