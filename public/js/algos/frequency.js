import { h, barChart, kbd, note, math, table } from '../core/render.js';
import { ALPHA, caesar, lettersOnly } from '../crypto/classical.js';
import { ENGLISH, letterCounts, caesarScores } from '../crypto/analysis.js';
import { SAMPLE_TEXT } from '../core/samples.js';

const pct = (counts) => {
  const n = counts.reduce((a, b) => a + b, 0) || 1;
  return counts.map((c) => (100 * c) / n);
};

export default {
  id: 'frequency',
  title: 'Frequency Analysis',
  slides: '26, 55',
  category: 'Cryptanalysis',
  blurb: 'Break a Caesar cipher by comparing letter counts to English.',
  about: `<p>Every language has a fingerprint: in English, <b>E</b> is the most common letter (≈12.7%), then T, A, O. A substitution cipher only renames the letters, so the ciphertext keeps the same shape — just shifted.</p>
<p>The attack tries all 26 Caesar keys (brute force over a tiny key space) and scores each candidate with the <b>chi-square statistic</b>: Σ (observed − expected)² / expected. The lowest score looks most like English.</p>
<p>This works against Caesar, Atbash and (column by column) Vigenère — but not modern ciphers. <span class="ref">Ch. 5 slides 26, 55</span></p>`,
  inputs: [
    { id: 'text', label: 'Ciphertext', type: 'textarea', value: caesar(SAMPLE_TEXT, 7), rows: 6 },
  ],
  actions: [{ id: 'run', label: 'Break it' }],
  random: () => ({ text: caesar(SAMPLE_TEXT, 1 + Math.floor(Math.random() * 25)) }),
  code: [
    'count each letter of the ciphertext',
    'for shift k = 0 … 25:',
    '  candidate = Caesar-decrypt(ciphertext, k)',
    '  χ²(k) = Σ (observed − expected)² / expected',
    'best key = the k with the smallest χ²',
  ],
  generate(_, v) {
    const letters = lettersOnly(v.text);
    if (letters.length < 20) throw new Error('Frequency analysis needs a longer ciphertext (at least 20 letters, ideally hundreds).');
    const counts = letterCounts(letters);
    const scores = caesarScores(v.text);
    const best = scores.reduce((a, b) => (b.chi < a.chi ? b : a));
    const top = counts.indexOf(Math.max(...counts));
    const steps = [{ kind: 'count', line: 0, k: -1, msg: `${letters.length} letters counted. The most common ciphertext letter is ${kbd(ALPHA[top])} — if it stands for E, the shift is ${(top - 4 + 26) % 26}.` }];
    for (let k = 0; k < 26; k++) {
      steps.push({ kind: 'try', k, line: [1, 2, 3], dwell: 0.45, msg: `Shift ${k}: χ² = ${scores[k].chi.toFixed(1)}${scores[k].chi === best.chi ? ' ← lowest so far' : ''}` });
    }
    steps.push({ kind: 'best', k: best.shift, line: 4, msg: `Best key: ${kbd(best.shift)} (χ² = ${best.chi.toFixed(1)}). The decrypted text reads as English.` });
    return { steps, ctx: { counts, scores, best } };
  },
  render(step, stage, ctx) {
    const k = Math.max(0, step.k);
    const shifted = ctx.counts.map((_, i) => ctx.counts[(i + k) % 26]);
    const shown = step.kind === 'count' ? ctx.counts : shifted;
    const parts = [
      h('div', { class: 'grid-label' }, step.kind === 'count' ? 'Ciphertext letter frequency vs. English' : `Frequency after shifting back by ${k}`),
      barChart([...ALPHA], [{ name: step.kind === 'count' ? 'ciphertext' : `shift ${k}`, values: pct(shown), cls: 's1' }, { name: 'English', values: ENGLISH, cls: 's2' }], { format: (x) => `${x.toFixed(1)}%` }),
    ];
    if (step.kind !== 'count') {
      const upto = step.kind === 'best' ? 26 : step.k + 1;
      const chis = ctx.scores.map((s, i) => (i < upto ? s.chi : 0));
      parts.push(h('div', { class: 'grid-label' }, 'χ² score per key (lower = more English-like)'),
        barChart(ALPHA.split('').map((_, i) => String(i)), [{ name: 'χ²', values: chis, cls: 's1' }], { height: 90, highlight: step.kind === 'best' ? ctx.best.shift : step.k, max: Math.max(...ctx.scores.map((s) => s.chi)), format: (x) => x.toFixed(1) }),
        math(`<span class="preview">${ctx.scores[k].preview.slice(0, 160)}…</span>`));
    }
    if (step.kind === 'best') parts.push(note('Tip: paste ciphertext from the <a href="#/caesar">Caesar</a> visualizer here to break your own messages.'));
    stage.append(h('div', { class: 'col' }, parts));
  },
};
