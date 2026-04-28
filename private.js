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
fillChalkDeco('chalk-deco', window.innerWidth <= 480 ? 40 : 80);

// ── 데이터 캐시 ───────────────────────────────────────────
let _books = [], _reviews = [], _users = [];
let _privateNotes = {};
let _scrappedPassages = {};
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

    card.onclick = () => { window.location.href = `detail.html?id=${book.id}&roomId=${book._roomId}`; };
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

    const raw = _privateNotes[book.id];
    const existingNotes = !raw ? [] :
      typeof raw === 'string'
        ? [{ id: null, text: raw }]
        : Object.entries(raw).map(([id, val]) => ({
            id,
            text: typeof val === 'string' ? val : val.text,
            createdAt: typeof val === 'object' ? val.createdAt : 0
          })).sort((a, b) => a.createdAt - b.createdAt);

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

    // 나만의 메모 목록
    let _editingNoteId = null;

    const noteRow = document.createElement('div');
    noteRow.className = 'private-note-row';
    noteRow.onclick = e => e.stopPropagation();

    const noteInput = document.createElement('textarea');
    noteInput.className = 'private-note-input';
    noteInput.placeholder = '나만의 메모...';
    noteInput.rows = 1;
    noteInput.addEventListener('input', () => {
      noteInput.style.height = 'auto';
      noteInput.style.height = noteInput.scrollHeight + 'px';
    });
    noteRow.appendChild(noteInput);

    const sendBtn = document.createElement('button');
    sendBtn.className = 'private-note-send';
    sendBtn.textContent = '▶';
    sendBtn.onclick = e => {
      e.stopPropagation();
      const text = noteInput.value.trim();
      if (!text) return;
      if (_editingNoteId) {
        db.ref('privateNotes/' + currentUser.id + '/' + book.id + '/' + _editingNoteId).update({ text });
        _editingNoteId = null;
        sendBtn.classList.remove('editing');
      } else {
        db.ref('privateNotes/' + currentUser.id + '/' + book.id).push({ text, createdAt: Date.now() });
      }
      noteInput.value = '';
      noteInput.style.height = '';
    };
    noteRow.appendChild(sendBtn);

    function startEdit(note) {
      _editingNoteId = note.id;
      noteInput.value = note.text;
      noteInput.style.height = 'auto';
      noteInput.style.height = noteInput.scrollHeight + 'px';
      noteInput.focus();
      sendBtn.classList.add('editing');
    }

    function closeDropdown() {
      document.querySelectorAll('.note-dropdown').forEach(d => d.remove());
    }

    if (existingNotes.length > 0) {
      const notesList = document.createElement('div');
      notesList.className = 'private-notes-list';
      notesList.onclick = e => e.stopPropagation();
      existingNotes.forEach(note => {
        const noteItem = document.createElement('div');
        noteItem.className = 'private-note-item';

        const noteText = document.createElement('span');
        noteText.className = 'private-note-text';
        noteText.textContent = note.text;
        noteItem.appendChild(noteText);

        if (note.id) {
          // 데스크탑: 수정 + 삭제 버튼
          const editBtn = document.createElement('button');
          editBtn.className = 'private-note-edit desktop-only';
          editBtn.textContent = '수정';
          editBtn.onclick = e => { e.stopPropagation(); startEdit(note); };
          noteItem.appendChild(editBtn);

          const delBtn = document.createElement('button');
          delBtn.className = 'private-note-del desktop-only';
          delBtn.textContent = '×';
          delBtn.onclick = e => {
            e.stopPropagation();
            db.ref('privateNotes/' + currentUser.id + '/' + book.id + '/' + note.id).remove();
          };
          noteItem.appendChild(delBtn);

          // 모바일: ⋮ 버튼 + 드롭다운
          const moreBtn = document.createElement('button');
          moreBtn.className = 'private-note-more mobile-only';
          moreBtn.textContent = '⋮';
          moreBtn.onclick = e => {
            e.stopPropagation();
            closeDropdown();
            const dropdown = document.createElement('div');
            dropdown.className = 'note-dropdown';
            const editOpt = document.createElement('button');
            editOpt.textContent = '수정';
            editOpt.onclick = e => { e.stopPropagation(); closeDropdown(); startEdit(note); };
            const delOpt = document.createElement('button');
            delOpt.textContent = '삭제';
            delOpt.onclick = e => {
              e.stopPropagation(); closeDropdown();
              db.ref('privateNotes/' + currentUser.id + '/' + book.id + '/' + note.id).remove();
            };
            dropdown.appendChild(editOpt);
            dropdown.appendChild(delOpt);
            moreBtn.appendChild(dropdown);
            setTimeout(() => document.addEventListener('click', closeDropdown, { once: true }), 0);
          };
          noteItem.appendChild(moreBtn);
        }

        notesList.appendChild(noteItem);
      });
      card.appendChild(notesList);
    }

    card.appendChild(noteRow);

    card.onclick = () => { window.location.href = `detail.html?id=${book.id}&roomId=${book._roomId}`; };
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
        if (p?.text) allPassages.push({ ...p, bookTitle: book?.title || '', bookId: r.bookId, _roomId: r._roomId });
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

    card.onclick = () => { window.location.href = `detail.html?id=${p.bookId}&roomId=${p._roomId}`; };
    container.appendChild(card);
  });
}

// ── 스크랩한 구절 ─────────────────────────────────────────
function renderScrappedPassages() {
  const container = document.getElementById('scrapped-passages');
  container.innerHTML = '';

  const entries = Object.entries(_scrappedPassages)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-msg">스크랩한 구절이 없어요 ✦</div>';
    return;
  }

  entries.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'passage-scrap';
    card.style.animationDelay = (i * 0.05) + 's';
    card.style.transform = `rotate(${(Math.random() * 6 - 3).toFixed(1)}deg)`;

    const bookLabel = document.createElement('div');
    bookLabel.className = 'scrap-book-title';
    bookLabel.textContent = p.bookTitle + (p.fromUser ? ' — ' + p.fromUser : '');
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

    const delBtn = document.createElement('button');
    delBtn.className = 'scrap-del-btn';
    delBtn.textContent = '×';
    delBtn.onclick = e => {
      e.stopPropagation();
      db.ref('scrappedPassages/' + currentUser.id + '/' + p.id).remove();
    };
    card.appendChild(delBtn);

    card.onclick = () => {
      const url = `detail.html?id=${p.bookId}${p.roomId ? '&roomId=' + p.roomId : ''}`;
      window.location.href = url;
    };
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
  localStorage.setItem('currentUser', JSON.stringify(currentUser));

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
  renderScrappedPassages();
}

// ── Firebase 리스너 ───────────────────────────────────────
// 유저가 가입한 모든 방에서 books/reviews 수집
db.ref('userRooms/' + currentUser.id).once('value', snap => {
  const roomIds = snap.exists() ? Object.keys(snap.val()) : [];

  let loaded = 0;
  const total = roomIds.length * 2; // books + reviews per room
  if (total === 0) { renderAll(); }

  roomIds.forEach(roomId => {
    db.ref('rooms/' + roomId + '/books').on('value', bSnap => {
      const roomBooks = bSnap.exists() ? Object.values(bSnap.val()) : [];
      _books = _books.filter(b => b._roomId !== roomId);
      roomBooks.forEach(b => { b._roomId = roomId; });
      _books = _books.concat(roomBooks);
      loaded++;
      if (loaded >= total) renderAll();
    });
    db.ref('rooms/' + roomId + '/reviews').on('value', rSnap => {
      const roomReviews = rSnap.exists() ? Object.values(rSnap.val()) : [];
      _reviews = _reviews.filter(r => r._roomId !== roomId);
      roomReviews.forEach(r => { r._roomId = roomId; });
      _reviews = _reviews.concat(roomReviews);
      loaded++;
      if (loaded >= total) renderAll();
    });
  });
});

db.ref('users').on('value', snap => {
  _users = snap.exists() ? Object.values(snap.val()) : [];
  renderAll();
});
db.ref('privateNotes/' + currentUser.id).on('value', snap => {
  _privateNotes = snap.exists() ? snap.val() : {};
  renderMyReviews();
});
db.ref('scrappedPassages/' + currentUser.id).on('value', snap => {
  _scrappedPassages = snap.exists() ? snap.val() : {};
  renderScrappedPassages();
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
