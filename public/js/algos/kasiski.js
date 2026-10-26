import { h, barChart, kbd, note, math, table, strip } from '../core/render.js';
import { ALPHA, lettersOnly, vigenere } from '../crypto/classical.js';
import { repeats, factorCounts, guessKeyLength, columns, caesarScores, letterCounts, ENGLISH } from '../crypto/analysis.js';
import { SAMPLE_TEXT } from '../core/samples.js';

const COLS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11'];

function cipherView(letters, { marks = new Map(), L = 0, upto = 300 } = {}) {
  return h('div', { class: 'cipherview' }, [...letters.slice(0, upto)].map((c, i) =>
    h('span', { class: `cv ${marks.get(i) || ''} ${L ? COLS[i % L] : ''}` }, c)), letters.length > upto ? h('span', { class: 'cv dim' }, '…') : null);
}

export default {
  id: 'kasiski',
  title: 'Kasiski Examination',
  slides: '55',
  category: 'Cryptanalysis',
  blurb: 'Break Vigenère: repeated strings reveal the key length, then frequency analysis per column.',
  about: `<p><b>Friedrich Kasiski</b> (1863) broke the "unbreakable" Vigenère cipher:</p>
<ol><li>Find <b>repeated strings</b> in the ciphertext. The same plaintext under the same part of the key encrypts the same way, so the distances between repeats are usually multiples of the key length <i>n</i>.</li>
<li>The most common factor of those distances suggests <i>n</i>. (We confirm with the <i>index of coincidence</i>: columns of the right length look like English, ≈ 0.066.)</li>
<li>Split the ciphertext into <i>n</i> columns. Each column is a plain Caesar cipher → <a href="#/frequency">frequency analysis</a> recovers one key letter per column.</li></ol>
<p><span class="ref">Ch. 5 slide 55</span></p>`,
  inputs: [
    { id: 'text', label: 'Vigenère ciphertext', type: 'textarea', value: vigenere(SAMPLE_TEXT, 'HORSE'), rows: 6 },
  ],
  actions: [{ id: 'run', label: 'Break it' }],
  random: () => {
    const words = ['KEY', 'LEMON', 'CIPHER', 'SECRET', 'ENIGMA', 'CRYPTO', 'SPARTA', 'BADGER'];
    return { text: vigenere(SAMPLE_TEXT, words[Math.floor(Math.random() * words.length)]) };
  },
  code: [
    'find repeated 3-letter sequences and the distances between them',
    'count the factors of every distance',
    'key length n = best candidate (confirm with index of coincidence)',
    'split the ciphertext into n columns',
    'for each column: frequency-analyse it as a Caesar cipher → key letter',
    'decrypt with the recovered keyword',
  ],
  generate(_, v) {
    const letters = lettersOnly(v.text);
    if (letters.length < 80) throw new Error('The Kasiski examination needs a long ciphertext (at least 80 letters, ideally hundreds).');
    const reps = repeats(letters, 3);
    const gaps = reps.flatMap((r) => r.gaps);
    const fc = factorCounts(gaps, 12);
    const { scores, length: L } = guessKeyLength(letters, 12);
    const cols = columns(letters, L);
    const keyLetters = cols.map((col) => caesarScores(col).reduce((a, b) => (b.chi < a.chi ? b : a)).shift);
    const key = keyLetters.map((k) => ALPHA[k]).join('');
    const plain = vigenere(v.text, key, true);
    const steps = [];
    const top = reps.slice(0, 6);
    steps.push({ kind: 'repeats', top, line: 0, msg: `Found ${reps.length} repeated trigrams. The most frequent: ${top.slice(0, 3).map((r) => `${kbd(r.seq)} ×${r.pos.length}`).join(', ')}. Their spacings: ${top[0]?.gaps.slice(0, 5).join(', ') || '—'}…`, dwell: 1.6 });
    steps.push({ kind: 'factors', fc, line: 1, msg: `Factors of all ${gaps.length} spacings. Small factors (2, 3) always score well, so look for a peak among the larger ones.` });
    steps.push({ kind: 'ioc', scores, L, line: 2, msg: `Index of coincidence per candidate length: English columns score ≈ 0.066, random ≈ 0.038. Key length → ${kbd(L)}.` });
    steps.push({ kind: 'cols', L, line: 3, msg: `Split the ciphertext into ${L} columns (colours). Every letter in a column was shifted by the same key letter.` });
    cols.forEach((col, i) => steps.push({ kind: 'col', i, col, k: keyLetters[i], L, line: 4, msg: `Column ${i + 1} (${col.length} letters): best Caesar shift ${keyLetters[i]} → key letter ${kbd(ALPHA[keyLetters[i]])}.` }));
    steps.push({ kind: 'done', key, plain, L, line: 5, msg: `Recovered keyword ${kbd(key)}. Plaintext: “${plain.slice(0, 60)}…”` });
    return { steps, ctx: { letters, key, keyLetters } };
  },
  render(step, stage, ctx) {
    const { letters } = ctx;
    const parts = [];
    if (step.kind === 'repeats') {
      const marks = new Map();
      step.top.slice(0, 3).forEach((r, j) => r.pos.forEach((p) => { for (let k = 0; k < 3; k++) marks.set(p + k, `rep${j}`); }));
      parts.push(cipherView(letters, { marks }), table(['sequence', 'positions', 'spacings'], step.top.map((r) => [h('b', {}, r.seq), r.pos.join(', '), r.gaps.join(', ')]), { compact: true, rowCls: (i) => (i < 3 ? `rep${i}` : '') }));
    } else if (step.kind === 'factors') {
      parts.push(h('div', { class: 'grid-label' }, 'How many spacings each factor divides'), barChart(Array.from({ length: 11 }, (_, i) => String(i + 2)), [{ name: 'spacings divisible', values: step.fc.slice(2), cls: 's1' }], { format: (x) => String(x) }));
    } else if (step.kind === 'ioc') {
      parts.push(h('div', { class: 'grid-label' }, 'Average index of coincidence of the columns'), barChart(step.scores.map((s) => String(s.L)), [{ name: 'IoC', values: step.scores.map((s) => s.ioc), cls: 's1' }], { highlight: step.L - 1, max: 0.08, format: (x) => x.toFixed(4) }),
        note('Multiples of the true length (e.g. 10 for a 5-letter key) score just as high, so the shortest high scorer wins.'));
    } else if (step.kind === 'cols' || step.kind === 'col') {
      parts.push(cipherView(letters, { L: step.L, upto: 200 }));
      parts.push(strip('Key so far', Array.from({ length: step.L }, (_, i) => ({ t: step.kind === 'col' && i <= step.i ? ALPHA[ctx.keyLetters[i]] : '?', cls: `${COLS[i]} ${step.i === i ? 'hl' : ''}` }))));
      if (step.kind === 'col') {
        const counts = letterCounts(step.col);
        const n = step.col.length;
        const shifted = counts.map((_, j) => (100 * counts[(j + step.k) % 26]) / n);
        parts.push(h('div', { class: 'grid-label' }, `Column ${step.i + 1}, shifted back by ${step.k}, vs. English`),
          barChart([...ALPHA], [{ name: `column ${step.i + 1}`, values: shifted, cls: 's1' }, { name: 'English', values: ENGLISH, cls: 's2' }], { height: 110, format: (x) => `${x.toFixed(1)}%` }));
      }
    } else if (step.kind === 'done') {
      parts.push(math(`Keyword: <b class="k">${step.key}</b>`), h('div', { class: 'plainout' }, step.plain));
    }
    stage.append(h('div', { class: 'col' }, parts));
  },
};
