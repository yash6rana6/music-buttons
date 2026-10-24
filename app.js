// ---------- Simple Soundboard ----------
const audio = new Audio();           // ek hi player => ek time pe ek hi sound
const nowEl = document.getElementById('nowPlaying');
const IDLE_TEXT = 'Kuch play nahi ho raha';
const lastPicked = {};               // folder ke liye repeat avoid
let activeBtn = null;

const COLORS = ['peach', 'mint', 'sky', 'lilac', 'lemon', 'rose'];
const FOLDER_ICONS = { happy: '😄', laugh: '😂', sad: '😢', memes: '📢', crying: '😭', angry: '😡' };

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');
const fileLabel = (p) =>
  p.split('/').pop()
    .replace(/\.[^.]+$/, '')
    .replace(/^Voicy[_ ]+/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function setActive(btn) {
  if (activeBtn) activeBtn.classList.remove('playing');
  activeBtn = btn;
  if (btn) btn.classList.add('playing');
  document.body.classList.toggle('is-playing', !!btn);
}

function stopAll() {
  audio.pause();
  audio.currentTime = 0;
  setActive(null);
  nowEl.textContent = IDLE_TEXT;
}

function play(src, label, btn) {
  audio.pause();                     // pehle wala band
  audio.src = encodePath(src);
  audio.currentTime = 0;
  setActive(btn);
  nowEl.textContent = label;
  audio.play().catch((err) => {
    if (err.name !== 'AbortError') stopAll();   // naya sound aaya to ignore
  });
}

audio.addEventListener('ended', () => {
  setActive(null);
  nowEl.textContent = IDLE_TEXT;
});

function pickRandom(folder) {
  const files = folder.files;
  if (files.length === 1) return files[0];
  let f;
  do {
    f = files[Math.floor(Math.random() * files.length)];
  } while (f === lastPicked[folder.name]);
  lastPicked[folder.name] = f;
  return f;
}

function makeBtn(className, color) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn ${className} ${color}`;
  return b;
}

function renderFolder(folder, i) {
  const b = makeBtn('folder', COLORS[i % COLORS.length]);
  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.textContent = FOLDER_ICONS[folder.name.toLowerCase()] || '🎲';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = titleCase(folder.name);
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = `${folder.files.length} sounds`;
  b.append(icon, name, count);

  b.addEventListener('click', () => {
    const file = pickRandom(folder);
    play(file, `${titleCase(folder.name)} → ${fileLabel(file)}`, b);
  });
  return b;
}

function renderLoose(item, i) {
  const b = makeBtn('sound', COLORS[(i + 3) % COLORS.length]);
  const label = fileLabel(item.path);
  b.textContent = label;
  b.addEventListener('click', () => play(item.path, label, b));
  return b;
}

async function init() {
  document.getElementById('stopBtn').addEventListener('click', stopAll);
  try {
    const res = await fetch('/api/sounds', { cache: 'no-store' });
    const { folders, loose } = await res.json();

    if (folders.length) {
      const wrap = document.getElementById('folders');
      folders.forEach((f, i) => wrap.appendChild(renderFolder(f, i)));
      document.getElementById('foldersSection').hidden = false;
    }
    if (loose.length) {
      const wrap = document.getElementById('loose');
      loose.forEach((s, i) => wrap.appendChild(renderLoose(s, i)));
      document.getElementById('looseSection').hidden = false;
    }
    if (!folders.length && !loose.length) document.getElementById('empty').hidden = false;
  } catch (e) {
    const empty = document.getElementById('empty');
    empty.textContent = 'Sounds load nahi hue. Server chal raha hai? (npm start)';
    empty.hidden = false;
  }
}

init();
