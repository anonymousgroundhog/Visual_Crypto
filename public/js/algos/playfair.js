import { h, strip, kbd, note } from '../core/render.js';
import { lettersOnly, playfairPair, playfairPrepare, playfairTable } from '../crypto/classical.js';

const RULES = {
  row: 'Same row → take the letter to the <b>right</b> of each (wrapping around).',
  column: 'Same column → take the letter <b>below</b> each (wrapping around).',
  rectangle: 'Different row and column → they form a rectangle; take the <b>other two corners</b> (same row, other letter\'s column).',
};
const RULES_DEC = { row: RULES.row.replace('right', 'left'), column: RULES.column.replace('below', 'above'), rectangle: RULES.rectangle };

function square(table, { placed = 25, from = [], to = [], fresh = -1 } = {}) {
  return h('div', { class: 'pf-square' }, Array.from({ length: 25 }, (_, i) => {
    let cls = i < placed ? 'on' : '';
    if (from.includes(i)) cls += ' src';
    if (to.includes(i)) cls += ' dst';
    if (i === fresh) cls += ' new';
    return h('div', { class: `pf-cell ${cls}` }, i < placed ? (table[i] === 'I' ? 'I/J' : table[i]) : '');
  }));
}

export default {
  id: 'playfair',
  title: 'Playfair Cipher',
  slides: '29–30',
  category: 'Classical ciphers',
  blurb: 'Encrypts pairs of letters with a 5×5 keyword square. Used by the British in WWI.',
  about: `<p>Invented by <b>Charles Wheatstone</b> (1854), popularised by Lord Playfair. It encrypts <i>digraphs</i> (letter pairs), which hides single-letter frequencies.</p>
<ul><li>Build a 5 × 5 table: keyword first, then the remaining letters (I and J share a cell).</li>
<li>Split into pairs. A doubled letter in a pair → second becomes X ("dollar" → DO LX AR). Odd letter at the end → pad with Z.</li>
<li>Same row → right; same column → down; otherwise → rectangle corners.</li></ul>
<p>Keyword <code>falcon</code>: AT → CR. <span class="ref">Ch. 5 slides 29–30</span></p>`,
  inputs: [
    { id: 'key', label: 'Keyword', type: 'text', value: 'falcon' },
    { id: 'text', label: 'Text', type: 'textarea', value: 'attack at dawn', rows: 2 },
  ],
  actions: [{ id: 'encrypt', label: 'Encrypt' }, { id: 'decrypt', label: 'Decrypt' }],
  code: [
    'table = keyword letters (no repeats), then the rest of A–Z (I = J)',
    'split the text into pairs (fix doubles with X, pad odd with Z)',
    'for each pair (a, b):',
    '  if same row:    shift each one column right  (left to decrypt)',
    '  elif same col:  shift each one row down      (up to decrypt)',
    '  else:           swap to the other rectangle corners',
  ],
  generate(action, v) {
    const keyLetters = lettersOnly(v.key).replace(/J/g, 'I');
    const table = playfairTable(v.key);
    const decrypt = action === 'decrypt';
    const text = lettersOnly(v.text);
    if (!text) throw new Error('Please enter some letters.');
    if (text.length > 120) throw new Error('Please keep the text under 120 letters.');
    if (decrypt && text.length % 2) throw new Error('Playfair ciphertext always has an even number of letters.');
    const pairs = decrypt ? text.replace(/J/g, 'I').match(/../g).map((p) => ({ a: p[0], b: p[1] })) : playfairPrepare(text);
    const steps = [];
    const uniqueKey = [...new Set(keyLetters)];
    uniqueKey.forEach((ch, i) => steps.push({ line: 0, placed: i + 1, fresh: i, pair: -1, out: '', dwell: 0.5, msg: `Keyword letter ${kbd(ch)} → cell ${i + 1}.${keyLetters.indexOf(ch) !== keyLetters.lastIndexOf(ch) ? ' (Repeats are skipped.)' : ''}` }));
    steps.push({ line: 0, placed: 25, pair: -1, out: '', msg: `Fill the remaining cells with the unused letters A–Z in order (J shares I's cell).` });
    steps.push({ line: 1, placed: 25, pair: -1, out: '', showPairs: true, msg: `Split into digraphs: ${pairs.map((p) => kbd(p.a + p.b)).join(' ')}${pairs.some((p) => p.note) ? '. ' + pairs.filter((p) => p.note).map((p) => p.note).join('; ') + '.' : ''}` });
    let out = '';
    pairs.forEach((p, i) => {
      const r = playfairPair(table, p.a, p.b, decrypt);
      out += r.out;
      const line = { row: 3, column: 4, rectangle: 5 }[r.rule];
      steps.push({ line: [2, line], placed: 25, pair: i, from: r.from, to: r.to, rule: r.rule, out, showPairs: true, msg: `${kbd(p.a + p.b)}: ${(decrypt ? RULES_DEC : RULES)[r.rule]} → ${kbd(r.out)}` });
    });
    steps.push({ line: null, placed: 25, pair: -1, out, showPairs: true, msg: `Done: ${kbd(out.match(/../g).join(' '))}` });
    return { steps, ctx: { table, pairs } };
  },
  render(step, stage, ctx) {
    stage.append(
      h('div', { class: 'row' },
        h('div', { class: 'col' }, h('div', { class: 'grid-label' }, 'Key square'), square(ctx.table, step)),
        h('div', { class: 'col grow' },
          step.showPairs && strip('Pairs', ctx.pairs.map((p, i) => ({ t: p.a + p.b, cls: i === step.pair ? 'hl' : i < step.pair || step.pair < 0 && step.out ? 'done' : '' })), 'wrap pairs'),
          step.showPairs && strip('Output', (step.out.match(/../g) || []).map((p, i) => ({ t: p, cls: i === step.pair ? 'dst new' : '' })), 'wrap pairs'),
          step.rule && note(`<b>Rule:</b> ${step.rule}`))),
    );
  },
};
