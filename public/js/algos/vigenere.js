import { h, math, strip, kbd } from '../core/render.js';
import { ALPHA, isLetter, letterIndex, lettersOnly, mod, shiftChar } from '../crypto/classical.js';
import { checkLength, ioStrips } from './shared.js';

function tabula(keyRow, plainCol) {
  const cells = [h('div', { class: 'tr-corner' }, '')];
  for (let c = 0; c < 26; c++) cells.push(h('div', { class: `tr-head ${c === plainCol ? 'on' : ''}` }, ALPHA[c]));
  for (let r = 0; r < 26; r++) {
    cells.push(h('div', { class: `tr-head ${r === keyRow ? 'on' : ''}` }, ALPHA[r]));
    for (let c = 0; c < 26; c++) {
      const cls = r === keyRow && c === plainCol ? 'hit' : r === keyRow || c === plainCol ? 'lane' : '';
      cells.push(h('div', { class: `tr-cell ${cls}` }, ALPHA[(r + c) % 26]));
    }
  }
  return h('div', { class: 'tabula-wrap' },
    h('div', { class: 'tabula-axis' }, 'plaintext letter →'),
    h('div', { class: 'tabula' }, cells),
    h('div', { class: 'tabula-axis side' }, 'keyword letter ↓'));
}

export default {
  id: 'vigenere',
  title: 'Vigenère Cipher',
  slides: '32',
  category: 'Classical ciphers',
  blurb: 'A keyword picks a different Caesar alphabet for each letter, via the tabula recta.',
  about: `<p>Invented by <b>Giovan Battista Bellaso</b> (1553), misattributed to Blaise de Vigenère. Each keyword letter selects one row of the <i>tabula recta</i>; the plaintext letter picks the column.</p>
<p>Keyword <code>horse</code>: <code>cat</code> → <code>jok</code>. It resisted attack for 300 years until the Kasiski examination (see <a href="#/kasiski">Kasiski attack</a>). <span class="ref">Ch. 5 slides 32, 55</span></p>`,
  inputs: [
    { id: 'text', label: 'Text', type: 'textarea', value: 'cat', rows: 2 },
    { id: 'key', label: 'Keyword', type: 'text', value: 'horse' },
  ],
  actions: [{ id: 'encrypt', label: 'Encrypt' }, { id: 'decrypt', label: 'Decrypt' }],
  code: {
    encrypt: [
      'j = 0',
      'for each letter c of the plaintext:',
      '  k = keyword[j mod len(keyword)]',
      '  row = k, column = c in the tabula recta',
      '  output the letter at (row, column)',
      '  j = j + 1   (non-letters are copied, j unchanged)',
    ],
    decrypt: [
      'j = 0',
      'for each letter c of the ciphertext:',
      '  k = keyword[j mod len(keyword)]',
      '  find c in row k of the tabula recta',
      '  output that column\'s header letter',
      '  j = j + 1   (non-letters are copied, j unchanged)',
    ],
  },
  generate(action, v) {
    checkLength(v.text, 200);
    const key = lettersOnly(v.key);
    if (!key) throw new Error('Keyword must contain at least one letter.');
    const decrypt = action === 'decrypt';
    const steps = [{ line: 0, pos: -1, out: '', row: -1, col: -1, j: -1, msg: `Keyword ${kbd(key)} repeats under the text. Each keyword letter names a row of the table.` }];
    let out = '';
    let j = 0;
    const keyAt = [];
    [...v.text].forEach((c, pos) => {
      if (!isLetter(c)) {
        keyAt.push(null);
        out += c;
        steps.push({ line: 5, pos, out, row: -1, col: -1, j: -1, dwell: 0.4, msg: `${kbd(c === ' ' ? 'space' : c)} copied unchanged.` });
        return;
      }
      const k = letterIndex(key[j % key.length]);
      keyAt.push(j % key.length);
      const p = letterIndex(c);
      const r = mod(p + (decrypt ? -k : k), 26);
      out += shiftChar(c, decrypt ? -k : k);
      const col = decrypt ? r : p;
      steps.push({
        line: [2, 3, 4], pos, out, row: k, col, j: j % key.length,
        msg: decrypt
          ? `Key letter ${kbd(key[j % key.length])} → row ${k}. Find ${kbd(c.toUpperCase())} in that row: it sits under column ${kbd(ALPHA[r])}.`
          : `Key letter ${kbd(key[j % key.length])} → row ${k}; plaintext ${kbd(c.toUpperCase())} → column ${p}. Intersection: ${kbd(ALPHA[r])}.`,
      });
      j++;
    });
    steps.push({ line: null, pos: v.text.length, out, row: -1, col: -1, j: -1, msg: `Done: ${kbd(out)}` });
    return { steps, ctx: { key, keyAt } };
  },
  render(step, stage, ctx) {
    const decrypt = ctx.action === 'decrypt';
    const keyItems = [...ctx.values.text].map((_, i) => ({ t: ctx.keyAt[i] == null ? '' : ctx.key[ctx.keyAt[i]], cls: i === step.pos ? 'src' : ctx.keyAt[i] == null ? 'empty' : '' }));
    const io = ioStrips(ctx.values.text, step.out, step.pos, { inLabel: decrypt ? 'Ciphertext' : 'Plaintext', outLabel: decrypt ? 'Plaintext' : 'Ciphertext' });
    io.insertBefore(strip('Keystream', keyItems, 'wrap keystream'), io.lastChild);
    stage.append(
      h('div', { class: 'row' },
        tabula(step.row, step.col),
        h('div', { class: 'col grow' },
          io,
          step.row >= 0 && math(`row <b>${ALPHA[step.row]}</b> (${step.row}) × column <b>${ALPHA[step.col]}</b> (${step.col}) → (${step.row} + ${step.col}) mod 26 = ${(step.row + step.col) % 26} → <b class="k">${ALPHA[(step.row + step.col) % 26]}</b>`))),
    );
  },
};
