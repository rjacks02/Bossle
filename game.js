// game.js — Bossle game logic (random song, unlimited plays)

// ── CONFIG ──────────────────────────────────────────────────
const CLIP_DURATIONS = [1, 2, 4, 8, 16, 31];
const MAX_ATTEMPTS   = 6;

// ── STATE ────────────────────────────────────────────────────
let currentSong  = null;
let attempt      = 0;
let gameOver     = false;
let isPlaying    = false;
let clipTimer    = null;
let selectedSong = null;
let highlightIdx = -1;
let audioEl      = null;

// ── RANDOM SONG ──────────────────────────────────────────────
function pickRandomSong() {
  const idx = Math.floor(Math.random() * SONGS.length);
  currentSong = SONGS[idx];
}

// ── AUDIO SETUP ──────────────────────────────────────────────
function setupAudio() {
  if (audioEl) { audioEl.pause(); audioEl.remove(); }
  audioEl = document.createElement('audio');
  audioEl.preload = 'auto';
  audioEl.src = `audio/${currentSong.audioFile}.mp3`;

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
  document.querySelectorAll('.wave-bar').forEach(b => b.classList.remove('played', 'active'));
  const duration = CLIP_DURATIONS[Math.min(attempt, CLIP_DURATIONS.length - 1)];
  audioEl.currentTime = 0;
  audioEl.play().catch(() => {
    document.getElementById('clipLabel').textContent = 'Click play to listen';
  });
  clipTimer = setTimeout(() => audioEl.pause(), duration * 1000);
}

// ── CLIP LABEL ───────────────────────────────────────────────
function updateClipLabel() {
  const dur = CLIP_DURATIONS[Math.min(attempt, CLIP_DURATIONS.length - 1)];
  document.getElementById('clipLabel').textContent =
    `CLIP ${attempt + 1} · ${dur} SEC`;
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

// ── WAVE BARS ────────────────────────────────────────────────
let waveInterval = null;
function animateWave(playing) {
  const bars = document.querySelectorAll('.wave-bar');
  if (playing) {
    const duration = CLIP_DURATIONS[Math.min(attempt, CLIP_DURATIONS.length - 1)];
    waveInterval = setInterval(() => {
      const progress = Math.min(audioEl.currentTime / duration, 1);
      const playedCount = Math.floor(progress * bars.length);
      bars.forEach((bar, i) => {
        bar.classList.toggle('played', i < playedCount);
        bar.classList.toggle('active', i >= playedCount && Math.random() > 0.6);
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
    item.innerHTML = `
      <div class="song-title">${song.title}</div>
      <div class="song-album">${song.album} · ${song.year}</div>
    `;
    item.addEventListener('mousedown', e => { e.preventDefault(); selectSong(song); });
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
  const correct = selectedSong.title.toLowerCase() === currentSong.title.toLowerCase();
  const type    = correct ? 'correct' : 'wrong';
  addGuessEntry(selectedSong.title, type);
  attempt++;
  selectedSong = null;
  document.getElementById('guessInput').value = '';
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('autocompleteDropdown').classList.remove('open');
  if (correct) {
    gameOver = true;
    updateDots();
    showResult(true);
    return;
  }
  if (attempt >= MAX_ATTEMPTS) {
    addGuessEntry('OUT OF GUESSES', 'skipped');
    gameOver = true;
    updateDots();
    showResult(false);
    return;
  }
  updateDots();
  updateClipLabel();
}

// ── SKIP ──────────────────────────────────────────────────────
function skipAttempt() {
  if (gameOver) return;
  if (isPlaying) { audioEl.pause(); clearTimeout(clipTimer); }
  addGuessEntry('SKIPPED', 'skipped');
  attempt++;
  selectedSong = null;
  document.getElementById('guessInput').value = '';
  document.getElementById('submitBtn').disabled = true;
  if (attempt >= MAX_ATTEMPTS) {
    addGuessEntry('OUT OF GUESSES', 'skipped');
    gameOver = true;
    updateDots();
    showResult(false);
    return;
  }
  updateDots();
  updateClipLabel();
}

// ── RESULT ───────────────────────────────────────────────────
function showResult(won) {
  const messages = [
    'BORN TO KNOW IT!',
    'TRAMPS LIKE YOU!',
    'YOU SHOWED \'EM!',
    'DARKNESS LIFTED!',
    'BARELY MADE IT!',
    'GOT THERE!',
  ];
  document.getElementById('resultIcon').textContent = won ? '🎸' : '💀';
  document.getElementById('resultText').textContent = won
    ? messages[Math.min(attempt - 1, 5)]
    : 'SO CLOSE, TRAMP';
  document.getElementById('resultSong').textContent  = `"${currentSong.title}"`;
  document.getElementById('resultAlbum').textContent = `${currentSong.album} · ${currentSong.year}`;
  document.getElementById('listenFullBtn').onclick = () => {
    const q = encodeURIComponent(`Bruce Springsteen ${currentSong.title}`);
    window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank');
  };
  document.getElementById('resultCard').classList.remove('hidden');
}

// ── NEW GAME ─────────────────────────────────────────────────
function newGame() {
  // Stop audio
  if (audioEl) { audioEl.pause(); clearTimeout(clipTimer); }

  // Reset state
  attempt      = 0;
  gameOver     = false;
  isPlaying    = false;
  selectedSong = null;
  highlightIdx = -1;

  // Clear UI
  document.getElementById('guessesList').innerHTML = '';
  document.getElementById('guessInput').value = '';
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('autocompleteDropdown').classList.remove('open');
  document.getElementById('resultCard').classList.add('hidden');
  document.getElementById('inputArea').style.opacity = '';
  document.getElementById('inputArea').style.pointerEvents = '';

  // Pick new song and reload audio
  pickRandomSong();
  buildWaveBars();
  updateClipLabel();
  updateDots();
  setupAudio();
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
    if (highlightIdx >= 0 && matches[highlightIdx]) selectSong(matches[highlightIdx]);
    else if (selectedSong) submitGuess();
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
  if (!e.target.closest('.autocomplete-wrap'))
    document.getElementById('autocompleteDropdown').classList.remove('open');
});

// ── MODAL ────────────────────────────────────────────────────
if (!localStorage.getItem('bossle-visited')) {
  document.getElementById('modalOverlay').classList.add('open');
  localStorage.setItem('bossle-visited', '1');
}
document.getElementById('howBtn').addEventListener('click',     () => document.getElementById('modalOverlay').classList.add('open'));
document.getElementById('modalClose').addEventListener('click', () => document.getElementById('modalOverlay').classList.remove('open'));
document.getElementById('modalOk').addEventListener('click',    () => document.getElementById('modalOverlay').classList.remove('open'));
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay'))
    document.getElementById('modalOverlay').classList.remove('open');
});

// ── WIRE UP BUTTONS ──────────────────────────────────────────
document.getElementById('playBtn').addEventListener('click', playClip);
document.getElementById('skipBtn').addEventListener('click', skipAttempt);
document.getElementById('submitBtn').addEventListener('click', submitGuess);
document.getElementById('newGameBtn').addEventListener('click', newGame);

// ── INIT ─────────────────────────────────────────────────────
pickRandomSong();
buildWaveBars();
updateClipLabel();
updateDots();
setupAudio();
