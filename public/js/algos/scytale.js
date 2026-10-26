import { h, strip, kbd } from '../core/render.js';
import { lettersOnly, scytaleGrid } from '../crypto/classical.js';

function rod(grid, filled, active, mode) {
  const rows = grid.length;
  const cols = grid[0].length;
  return h('div', { class: 'rod', style: { gridTemplateColumns: `repeat(${cols}, 2rem)` } },
    grid.flatMap((r, ri) => r.map((ch, ci) => {
      const key = `${ri},${ci}`;
      const on = filled.has(key);
      const act = active.has(key);
      return h('div', { class: `rod-cell ${on ? 'on' : ''} ${act ? (mode === 'read' ? 'read' : 'new') : ''}`, title: `turn ${ci + 1}, face ${ri + 1}` }, on ? ch : '');
    })),
    h('div', { class: 'rod-cap', style: { gridRow: `1 / span ${rows}` } }));
}

export default {
  id: 'scytale',
  title: 'Scytale',
  slides: '28',
  category: 'Classical ciphers',
  blurb: 'Spartan transposition: wrap a strip around a rod, write along it, unwind.',
  about: `<p>A <b>transposition</b> cipher from 7th-century BC Sparta. A leather strip is wound around a rod; the message is written along the rod, one row per face. Unwound, the strip shows the letters scrambled.</p>
<p>The <b>key</b> is the rod's diameter (how many letters fit around it). The receiver needs a rod of the same size. <span class="ref">Ch. 5 slide 28</span></p>`,
  inputs: [
    { id: 'text', label: 'Text', type: 'textarea', value: 'Help me I am under attack', rows: 2 },
    { id: 'rows', label: 'Rod size (letters around the rod)', type: 'number', value: 4, min: 2, max: 12 },
  ],
  actions: [{ id: 'encrypt', label: 'Encrypt' }, { id: 'decrypt', label: 'Decrypt' }],
  code: {
    encrypt: [
      'cols = ceil(len(text) / rodSize); pad with X',
      'write the text row by row along the rod',
      'unwind: read the grid column by column',
      'ciphertext = the letters on the strip',
    ],
    decrypt: [
      'cols = len(ciphertext) / rodSize',
      'wrap the strip: fill the grid column by column',
      'read the rod row by row',
      'plaintext = the rows joined together',
    ],
  },
  generate(action, v) {
    const letters = lettersOnly(v.text);
    if (!letters) throw new Error('Please enter some letters.');
    if (letters.length > 120) throw new Error('Please keep the text under 120 letters.');
    const decrypt = action === 'decrypt';
    if (decrypt && letters.length % v.rows) throw new Error(`Ciphertext length (${letters.length}) must be a multiple of the rod size (${v.rows}).`);
    const { grid, rows, cols } = scytaleGrid(v.text, v.rows, decrypt);
    const steps = [];
    const filled = new Set();
    let strip1 = '';
    const snap = (extra) => ({ filled: new Set(filled), strip: strip1, ...extra });
    steps.push(snap({ line: 0, active: new Set(), out: '', msg: `${letters.length} letters on a rod of size ${rows} → a ${rows} × ${cols} grid${rows * cols > letters.length ? `, padded with ${rows * cols - letters.length} X` : ''}.` }));

    if (!decrypt) {
      for (let r = 0; r < rows; r++) {
        const active = new Set();
        for (let c = 0; c < cols; c++) { filled.add(`${r},${c}`); active.add(`${r},${c}`); }
        steps.push(snap({ line: 1, active, out: '', msg: `Write ${kbd(grid[r].join(''))} along face ${r + 1} of the rod.` }));
      }
      let out = '';
      for (let c = 0; c < cols; c++) {
        const active = new Set();
        let chunk = '';
        for (let r = 0; r < rows; r++) { active.add(`${r},${c}`); chunk += grid[r][c]; }
        out += chunk;
        steps.push(snap({ line: 2, active, out, mode: 'read', msg: `Unwind turn ${c + 1}: the strip gets ${kbd(chunk)}.` }));
      }
      steps.push(snap({ line: 3, active: new Set(), out, msg: `Ciphertext: ${kbd(out)}` }));
    } else {
      for (let c = 0; c < cols; c++) {
        const active = new Set();
        let chunk = '';
        for (let r = 0; r < rows; r++) { filled.add(`${r},${c}`); active.add(`${r},${c}`); chunk += grid[r][c]; }
        steps.push(snap({ line: 1, active, out: '', msg: `Wrap the next ${rows} letters ${kbd(chunk)} around turn ${c + 1}.` }));
      }
      let out = '';
      for (let r = 0; r < rows; r++) {
        const active = new Set();
        for (let c = 0; c < cols; c++) active.add(`${r},${c}`);
        out += grid[r].join('');
        steps.push(snap({ line: 2, active, out, mode: 'read', msg: `Read face ${r + 1}: ${kbd(grid[r].join(''))}.` }));
      }
      steps.push(snap({ line: 3, active: new Set(), out, msg: `Plaintext: ${kbd(out)} (trailing X are padding).` }));
    }
    return { steps, ctx: { grid } };
  },
  render(step, stage, ctx) {
    const decrypt = ctx.action === 'decrypt';
    stage.append(
      h('div', { class: 'col' },
        h('div', { class: 'grid-label' }, 'The rod (rows = faces around the rod, columns = turns of the strip)'),
        rod(ctx.grid, step.filled, step.active, step.mode),
        strip(decrypt ? 'Plaintext' : 'Strip (ciphertext)', [...step.out].map((c, i) => ({ t: c, cls: i >= step.out.length - (step.mode === 'read' ? (decrypt ? ctx.grid[0].length : ctx.grid.length) : 0) ? 'dst new' : '' })), 'wrap')),
    );
  },
};
