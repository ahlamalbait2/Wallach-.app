let db = null;
let searchInput, clearBtn, resultsDiv, loadingDiv, reader, readerContent, statsDiv;
let currentSection = null;
const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');

document.addEventListener('DOMContentLoaded', function() {
  searchInput = document.getElementById('search');
  clearBtn = document.getElementById('clearBtn');
  resultsDiv = document.getElementById('results');
  loadingDiv = document.getElementById('loading');
  reader = document.getElementById('reader');
  readerContent = document.getElementById('readerContent');
  statsDiv = document.getElementById('stats');

  document.getElementById('backBtn').onclick = closeReader;
  document.getElementById('bookmarkBtn').onclick = toggleBookmark;

  clearBtn.onclick = function() {
    searchInput.value = '';
    searchInput.focus();
    searchInput.dispatchEvent(new Event('input'));
  };

  searchInput.addEventListener('input', debounce(doSearch, 250));
  initDB();
});

async function initDB() {
  try {
    const SQL = await initSqlJs({ locateFile: function(f) { return './' + f; } });
    const buf = await fetch('./wallach.sqlite').then(function(r) {
      if (!r.ok) throw new Error('Database not found');
      return r.arrayBuffer();
    });
    db = new SQL.Database(new Uint8Array(buf));

    const cnt = db.exec("SELECT COUNT(*) FROM sections")[0].values[0][0];
    loadingDiv.classList.add('hidden');
    statsDiv.textContent = cnt + ' sections loaded';
    statsDiv.classList.remove('hidden');
    searchInput.focus();
  } catch (e) {
    loadingDiv.innerHTML = '<p style="color:red">Error: ' + e.message + '</p>';
  }
}

function debounce(fn, ms) {
  let t;
  return function() {
    const args = arguments;
    clearTimeout(t);
    t = setTimeout(function() { fn.apply(null, args); }, ms);
  };
}

function doSearch(e) {
  const q = e.target.value.trim();
  clearBtn.classList.toggle('show', q.length > 0);

  if (q.length < 2) {
    resultsDiv.innerHTML = '';
    return;
  }

  const pattern = '%' + q + '%';

  try {
    const stmt = db.prepare(
      "SELECT id, title, page, substr(content, 1, 300) AS snip " +
      "FROM sections " +
      "WHERE title LIKE ? OR content LIKE ? " +
      "ORDER BY id LIMIT 40"
    );
    stmt.bind([pattern, pattern]);

    let html = '';
    let count = 0;
    while (stmt.step()) {
      const r = stmt.getAsObject();
      html += '<div class="card" data-id="' + r.id + '">' +
        '<h3>' + esc(r.title) + '</h3>' +
        '<p>' + highlight(esc(r.snip), q) + '</p>' +
        '<span class="page-badge">Page ' + r.page + '</span>' +
        '</div>';
      count++;
    }
    stmt.free();

    if (count === 0) {
      resultsDiv.innerHTML = '<div class="card"><h3>No results</h3><p>Try different keywords</p></div>';
    } else {
      resultsDiv.innerHTML = html;
      statsDiv.textContent = count + ' results for: ' + q;
      const cards = document.querySelectorAll('.card[data-id]');
      cards.forEach(function(c) {
        c.onclick = function() { openSection(parseInt(c.dataset.id)); };
      });
    }
  } catch (err) {
    resultsDiv.innerHTML = '<div class="card"><p style="color:red">Error: ' + err.message + '</p></div>';
  }
}

function highlight(text, query) {
  if (!query) return text;
  const words = query.split(/\s+/).filter(Boolean);
  let result = text;
  words.forEach(function(w) {
    if (w.length < 2) return;
    const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    result = result.replace(re, '<mark>$1</mark>');
  });
  return result;
}

function openSection(id) {
  const stmt = db.prepare("SELECT title, content, page FROM sections WHERE id = ?");
  stmt.bind([id]);
  if (stmt.step()) {
    const r = stmt.getAsObject();
    currentSection = { id: id, title: r.title, page: r.page, content: r.content };
    const isBM = bookmarks.some(function(b) { return b.id === id; });
    document.getElementById('bookmarkBtn').textContent = isBM ? 'Saved' : 'Bookmark';
    readerContent.innerHTML = '<h2 style="color:#1a5490;margin-top:0">' + esc(r.title) + '</h2>' +
      '<div style="color:#888;font-size:13px;margin-bottom:16px">Page ' + r.page + '</div>' +
      esc(r.content);
    reader.classList.remove('hidden');
    readerContent.scrollTop = 0;
  }
  stmt.free();
}

function closeReader() {
  reader.classList.add('hidden');
  currentSection = null;
}

function toggleBookmark() {
  if (!currentSection) return;
  const idx = bookmarks.findIndex(function(b) { return b.id === currentSection.id; });
  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    document.getElementById('bookmarkBtn').textContent = 'Bookmark';
  } else {
    bookmarks.push({
      id: currentSection.id,
      title: currentSection.title,
      page: currentSection.page
    });
    document.getElementById('bookmarkBtn').textContent = 'Saved';
  }
  localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
