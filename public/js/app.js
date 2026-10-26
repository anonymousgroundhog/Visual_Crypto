// Hash router: #/ shows the catalogue, #/<id> opens one visualization.
import { h } from './core/render.js';
import { Player } from './core/player.js';
import { ALGORITHMS, CATEGORIES, byId } from './algos/index.js';

const view = document.getElementById('view');
const crumb = document.getElementById('crumb');
let player = null;

function previewGlyph(a) {
  const glyphs = {
    caesar: 'A→D', rot13: 'A↔N', atbash: 'A↔Z', scytale: '▤', playfair: '5×5', multishift: '+2−2+3', vigenere: 'J O K', enigma: '⚙⚙⚙',
    lsb: '…0/1', binary: '⊕', xorstream: '⊕ ⊕', feistel: 'L|R', des: '16×F', tdes: 'E·D·E', aes: '4×4', sha256: '#256', rsa: 'Mᵉ', dh: 'gᵃᵇ',
    frequency: 'E T A', kasiski: 'n = ?',
  };
  return h('div', { class: 'glyph' }, glyphs[a.id] || a.title[0]);
}

function home() {
  crumb.textContent = '';
  document.title = 'VisualCrypto';
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Search algorithms… (e.g. "xor", "enigma", "hash")', 'aria-label': 'Search algorithms' });
  const sections = CATEGORIES.map((cat) => {
    const items = ALGORITHMS.filter((a) => a.category === cat.name);
    return h('section', { class: 'cat', 'data-cat': cat.name },
      h('h2', {}, h('span', { class: 'cat-icon' }, cat.icon), cat.name),
      h('p', { class: 'cat-blurb' }, cat.blurb),
      h('div', { class: 'cards' }, items.map((a) => h('a', { class: 'algo-card', href: `#/${a.id}`, 'data-search': `${a.title} ${a.blurb} ${a.category}`.toLowerCase() },
        previewGlyph(a),
        h('div', { class: 'algo-card-body' }, h('h3', {}, a.title), h('p', {}, a.blurb), h('span', { class: 'slide-ref' }, `Ch. 5 · slide ${a.slides}`))))));
  });
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const card of view.querySelectorAll('.algo-card')) card.hidden = q && !card.dataset.search.includes(q);
    for (const sec of view.querySelectorAll('.cat')) sec.hidden = ![...sec.querySelectorAll('.algo-card')].some((c) => !c.hidden);
  });
  view.replaceChildren(h('div', { class: 'home' },
    h('header', { class: 'hero' },
      h('h1', {}, 'Visualising cryptography through animation'),
      h('p', {}, 'Pick an algorithm, type your own input, and step through it one operation at a time. Every cipher from IT 360 Chapter 5 — from Caesar to AES, RSA and steganography.'),
      search),
    sections,
    h('footer', { class: 'home-foot' }, 'Keyboard: Space play/pause · ← → step · Home/End jump. Inspired by VisuAlgo.')));
}

function route() {
  player?.destroy();
  player = null;
  const id = location.hash.replace(/^#\/?/, '');
  const mod = id && byId(id);
  if (!mod) return home();
  document.title = `${mod.title} · VisualCrypto`;
  crumb.textContent = `${mod.category} / ${mod.title}`;
  const root = h('div', { class: 'viz-root' });
  view.replaceChildren(root);
  player = new Player(root, mod);
  window.scrollTo(0, 0);
}

// Theme toggle (remembered per browser).
const themeBtn = document.getElementById('theme');
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  themeBtn.textContent = t === 'dark' ? '☀' : '☾';
}
let saved = null;
try { saved = localStorage.getItem('vc-theme'); } catch { /* storage unavailable */ }
applyTheme(saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('vc-theme', next); } catch { /* storage unavailable */ }
});

window.addEventListener('hashchange', route);
route();
