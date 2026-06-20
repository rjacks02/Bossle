// game.js — Bossle game logic (local audio version)

// ── CONFIG ──────────────────────────────────────────────────
const CLIP_DURATIONS = [1, 2, 4, 8, 16, 31]; // seconds revealed per attempt
const MAX_ATTEMPTS   = 6;

// ── STATE ────────────────────────────────────────────────────
let todaysSong   = null;
let attempt      = 0;
let gameOver     = false;
let isPlaying    = false;
let clipTimer    = null;
let selectedSong = null;
let highlightIdx = -1;
let audioEl      = null;   // single <audio> element we reuse

// ── DAILY SONG ───────────────────────────────────────────────
function getDailyIndex() {
  const epoch = new Date('2024-01-01').getTime();
  const now   = new Date();
  const day   = Math.floor((now.getTime() - epoch) / 86400000);
  return day % SONGS.length;
}

function loadDailySong() {
  todaysSong = SONGS[getDailyIndex()];
}

// ── AUDIO SETUP ──────────────────────────────────────────────
function setupAudio() {
  audioEl = document.createElement('audio');
  audioEl.preload = 'auto';
  audioEl.src = `audio/${todaysSong.audioFile}.mp3`;

  audioEl.addEventListener('playing', () => {
    isPlaying = true;
    document.getElementById('playIcon').textContent = '⏹';
    document.getElementById('playBtn').classList.add('playing');
    animateWave(true);
  });

  audioEl.addEventListener('pause', () => {
    isPlaying = false;
    clearTimeout(clipTimer);
    document.getElementById('playIcon').textContent = '▶';
    document.getElementById('playBtn').classList.remove('playing');
    animateWave(false);
  });

  audioEl.addEventListener('ended', () => {
    isPlaying = false;
    clearTimeout(clipTimer);
    document.getElementById('playIcon').textContent = '▶';
    document.getElementById('playBtn').classList.remove('playing');
    animateWave(false);
  });

  audioEl.addEventListener('error', () => {
    document.getElementById('clipLabel').textContent = 'AUDIO ERROR – check audio/ folder';
  });
}

// ── PLAY / STOP ──────────────────────────────────────────────
function playClip() {
  if (!audioEl) return;

  if (isPlaying) {
    audioEl.pause();
    clearTimeout(clipTimer);
    return;
  }

  // Reset wave bars
  document.querySelectorAll('.wave-bar').forEach(b => b.classList.remove('played', 'active'));

  const duration = CLIP_DURATIONS[Math.min(attempt, CLIP_DURATIONS.length - 1)];

  // Always start from the beginning of the file
  audioEl.currentTime = 0;

  audioEl.play().catch(err => {
    console.warn('Audio play failed:', err);
    document.getElementById('clipLabel').textContent = 'Click play to listen';
  });

  // Stop after the clip duration
  clipTimer = setTimeout(() => {
    audioEl.pause();
  }, duration * 1000);
}

// ── CLIP LABEL ───────────────────────────────────────────────
function updateClipLabel() {
  const dur = CLIP_DURATIONS[Math.min(attempt, CLIP_DURATIONS.length - 1)];
  document.getElementById('clipLabel').textContent =
    `CLIP ${attempt + 1} · ${dur < 60 ? dur + ' SEC' : dur + 'S'}`;
}

// ── WAVE BARS ────────────────────────────────────────────────
function buildWaveBars() {
  const container = document.getElementById('waveBars');
  container.innerHTML = '';
  for (let i = 0; i < 60; i++) {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    bar.style.height = (8 + Math.random() * 84) + '%';
    container.appendChild(bar);
  }
}

let waveInterval = null;
function animateWave(playing) {
  const bars = document.querySelectorAll('.wave-bar');
  if (playing) {
    let frame = 0;
    waveInterval = setInterval(() => {
      frame++;
      bars.forEach((bar, i) => {
        if (i < frame * 0.5) bar.classList.add('played');
        bar.classList.toggle('active', Math.random() > 0.6 && i > frame * 0.3);
      });
    }, 60);
  } else {
    clearInterval(waveInterval);
    bars.forEach(b => b.classList.remove('active'));
  }
}

// ── DOTS ─────────────────────────────────────────────────────
function updateDots() {
  const guesses = collectGuesses();
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const dot = document.getElementById(`dot-${i}`);
    dot.className = 'attempt-dot';
    if (i < guesses.length) {
      dot.classList.add(guesses[i].type);
    } else if (i === attempt && !gameOver) {
      dot.classList.add('active');
    }
  }
}

// ── GUESS ENTRIES ─────────────────────────────────────────────
function addGuessEntry(text, type) {
  const list = document.getElementById('guessesList');
  const el   = document.createElement('div');
  el.className    = `guess-entry ${type}`;
  el.dataset.text = text;
  el.dataset.type = type;
  const icon = type === 'correct' ? '✓' : type === 'skipped' ? '⤼' : '✗';
  el.innerHTML = `<span class="guess-icon">${icon}</span><span>${text}</span>`;
  list.appendChild(el);
}

function collectGuesses() {
  return Array.from(document.querySelectorAll('.guess-entry')).map(el => ({
    text: el.dataset.text,
    type: el.dataset.type,
  }));
}

// ── LOCAL STORAGE ─────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `bossle-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function saveState() {
  const state = { attempt, gameOver, guesses: collectGuesses() };
  localStorage.setItem(todayKey(), JSON.stringify(state));
}

function restoreState() {
  const raw = localStorage.getItem(todayKey());
  if (!raw) return false;
  try {
    const state = JSON.parse(raw);
    attempt  = state.attempt;
    gameOver = state.gameOver;
    (state.guesses || []).forEach(g => addGuessEntry(g.text, g.type));
    updateDots();
    updateClipLabel();
    if (gameOver) {
      showResult(state.guesses.some(g => g.type === 'correct'));
      lockInput();
    }
    return true;
  } catch(e) { return false; }
}

// ── AUTOCOMPLETE ─────────────────────────────────────────────
function buildAutocomplete(query) {
  const dd = document.getElementById('autocompleteDropdown');
  dd.innerHTML = '';
  highlightIdx = -1;

  if (!query.trim()) { dd.classList.remove('open'); return; }

  const q = query.toLowerCase();
  const matches = SONGS_SORTED.filter(s =>
    s.title.toLowerCase().includes(q) || s.album.toLowerCase().includes(q)
  ).slice(0, 10);

  if (!matches.length) { dd.classList.remove('open'); return; }

  matches.forEach((song, i) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.dataset.idx = i;
    item.innerHTML = `
      <div class="song-title">${song.title}</div>
      <div class="song-album">${song.album} · ${song.year}</div>
    `;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      selectSong(song);
    });
    dd.appendChild(item);
  });

  dd.classList.add('open');
  dd._matches = matches;
}

function selectSong(song) {
  selectedSong = song;
  document.getElementById('guessInput').value = song.title;
  document.getElementById('autocompleteDropdown').classList.remove('open');
  document.getElementById('submitBtn').disabled = false;
}

// ── SUBMIT ────────────────────────────────────────────────────
function submitGuess() {
  if (!selectedSong || gameOver) return;

  const correct = selectedSong.title.toLowerCase() === todaysSong.title.toLowerCase();
  const type    = correct ? 'correct' : 'wrong';

  addGuessEntry(selectedSong.title, type);
  attempt++;
  selectedSong = null;
  document.getElementById('guessInput').value = '';
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('autocompleteDropdown').classList.remove('open');

  if (correct) {
    gameOver = true;
    updateDots(); saveState();
    showResult(true);
    lockInput();
    return;
  }

  if (attempt >= MAX_ATTEMPTS) {
    addGuessEntry('OUT OF GUESSES', 'skipped');
    gameOver = true;
    updateDots(); saveState();
    showResult(false);
    lockInput();
    return;
  }

  updateDots();
  updateClipLabel();
  saveState();
}

// ── SKIP ──────────────────────────────────────────────────────
function skipAttempt() {
  if (gameOver) return;

  // Stop audio if playing
  if (isPlaying) { audioEl.pause(); clearTimeout(clipTimer); }

  addGuessEntry('SKIPPED', 'skipped');
  attempt++;
  selectedSong = null;
  document.getElementById('guessInput').value = '';
  document.getElementById('submitBtn').disabled = true;

  if (attempt >= MAX_ATTEMPTS) {
    addGuessEntry('OUT OF GUESSES', 'skipped');
    gameOver = true;
    updateDots(); saveState();
    showResult(false);
    lockInput();
    return;
  }

  updateDots();
  updateClipLabel();
  saveState();
}

// ── RESULT ───────────────────────────────────────────────────
function showResult(won) {
  const messages = [
    'BORN TO KNOW IT!',
    'TRAMPS LIKE YOU!',
    'YOU SHOWED 'EM!',
    'DARKNESS LIFTED!',
    'BARELY MADE IT!',
    'GOT THERE!',
  ];

  document.getElementById('resultIcon').textContent = won ? '🎸' : '💀';
  document.getElementById('resultText').textContent = won
    ? (attempt <= 1 ? messages[0] : messages[Math.min(attempt - 1, 5)])
    : 'BETTER LUCK TOMORROW';

  document.getElementById('resultSong').textContent  = `"${todaysSong.title}"`;
  document.getElementById('resultAlbum').textContent = `${todaysSong.album} · ${todaysSong.year}`;

  document.getElementById('listenFullBtn').onclick = () => {
    // Search YouTube for the song
    const q = encodeURIComponent(`Bruce Springsteen ${todaysSong.title}`);
    window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank');
  };

  document.getElementById('resultCard').classList.remove('hidden');
}

// ── SHARE ─────────────────────────────────────────────────────
function buildShareText() {
  const guesses = collectGuesses();
  const squares = guesses
    .filter(g => g.text !== 'OUT OF GUESSES')
    .map(g => g.type === 'correct' ? '🟨' : g.type === 'skipped' ? '⬛' : '🟥')
    .join('');
  const won   = guesses.some(g => g.type === 'correct');
  const count = guesses.filter(g => g.text !== 'OUT OF GUESSES').length;
  const score = won ? `${count}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
  return `🎸 Bossle ${score}\n${squares}\n#Bossle #Springsteen #TheBoss`;
}

function shareResult() {
  const text = buildShareText();
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('shareBtn');
      btn.textContent = 'COPIED!';
      setTimeout(() => btn.textContent = 'SHARE RESULT', 2000);
    });
  }
}

// ── LOCK INPUT ────────────────────────────────────────────────
function lockInput() {
  const area = document.getElementById('inputArea');
  area.style.opacity = '0.4';
  area.style.pointerEvents = 'none';
}

// ── KEYBOARD NAV ─────────────────────────────────────────────
document.getElementById('guessInput').addEventListener('keydown', e => {
  const dd      = document.getElementById('autocompleteDropdown');
  const items   = dd.querySelectorAll('.autocomplete-item');
  const matches = dd._matches || [];

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightIdx = Math.min(highlightIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightIdx = Math.max(highlightIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightIdx));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (highlightIdx >= 0 && matches[highlightIdx]) {
      selectSong(matches[highlightIdx]);
    } else if (selectedSong) {
      submitGuess();
    }
  } else if (e.key === 'Escape') {
    dd.classList.remove('open');
  }
});

document.getElementById('guessInput').addEventListener('input', e => {
  selectedSong = null;
  document.getElementById('submitBtn').disabled = true;
  buildAutocomplete(e.target.value);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.autocomplete-wrap')) {
    document.getElementById('autocompleteDropdown').classList.remove('open');
  }
});

// ── MODAL ────────────────────────────────────────────────────
if (!localStorage.getItem('bossle-visited')) {
  document.getElementById('modalOverlay').classList.add('open');
  localStorage.setItem('bossle-visited', '1');
}
document.getElementById('howBtn').addEventListener('click',    () => document.getElementById('modalOverlay').classList.add('open'));
document.getElementById('modalClose').addEventListener('click', () => document.getElementById('modalOverlay').classList.remove('open'));
document.getElementById('modalOk').addEventListener('click',   () => document.getElementById('modalOverlay').classList.remove('open'));
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay'))
    document.getElementById('modalOverlay').classList.remove('open');
});

// ── WIRE UP BUTTONS ──────────────────────────────────────────
document.getElementById('playBtn').addEventListener('click', playClip);
document.getElementById('skipBtn').addEventListener('click', skipAttempt);
document.getElementById('submitBtn').addEventListener('click', submitGuess);
document.getElementById('shareBtn').addEventListener('click', shareResult);

// ── INIT ─────────────────────────────────────────────────────
loadDailySong();
buildWaveBars();
updateClipLabel();
setupAudio();

const restored = restoreState();
if (!restored) updateDots();
