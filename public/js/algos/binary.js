import { h, bitRow, table, kbd, note } from '../core/render.js';

const OPS = {
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  XOR: (a, b) => a ^ b,
};

function truthTable(opName, a, b) {
  const rows = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([x, y]) => [x, y, OPS[opName](x, y)]);
  return table(['A', 'B', `A ${opName} B`], rows, { rowCls: (i) => (rows[i][0] === a && rows[i][1] === b ? 'hl' : ''), compact: true });
}

export default {
  id: 'binary',
  title: 'Binary Operations',
  slides: '39',
  category: 'Symmetric ciphers',
  blurb: 'AND, OR and XOR bit by bit, and why XOR is reversible.',
  about: `<p>Modern ciphers work on <b>bits</b>. The three basic operations combine two bits column by column:</p>
<ul><li><b>AND</b> → 1 only if both are 1</li><li><b>OR</b> → 1 if either is 1</li><li><b>XOR</b> → 1 if they differ</li></ul>
<p>XOR is special: it is <b>reversible</b>. <code>(A ⊕ B) ⊕ B = A</code>, so XOR-ing with a key twice gives the data back. That makes it the core of stream ciphers, Feistel networks, DES and AES. <span class="ref">Ch. 5 slide 39</span></p>`,
  inputs: [
    { id: 'a', label: 'A (binary)', type: 'text', value: '1101' },
    { id: 'b', label: 'B (binary)', type: 'text', value: '1001' },
    { id: 'op', label: 'Operation', type: 'select', value: 'XOR', options: ['AND', 'OR', 'XOR'] },
  ],
  actions: [{ id: 'run', label: 'Compute' }],
  random: () => {
    const r = () => Array.from({ length: 8 }, () => (Math.random() < 0.5 ? 0 : 1)).join('');
    return { a: r(), b: r() };
  },
  code: [
    'line up A and B (pad the shorter with leading 0s)',
    'for each bit position i, left to right:',
    '  result[i] = A[i] OP B[i]   (look up the truth table)',
    'if OP is XOR: result XOR B gives A back',
  ],
  generate(_, v) {
    const clean = (x, n) => {
      if (!/^[01]+$/.test(x.trim())) throw new Error(`${n} must contain only 0 and 1.`);
      return x.trim();
    };
    let a = clean(v.a, 'A');
    let b = clean(v.b, 'B');
    if (Math.max(a.length, b.length) > 32) throw new Error('Please use at most 32 bits.');
    const n = Math.max(a.length, b.length);
    a = a.padStart(n, '0');
    b = b.padStart(n, '0');
    const A = [...a].map(Number);
    const B = [...b].map(Number);
    const f = OPS[v.op];
    const R = A.map((x, i) => f(x, B[i]));
    const steps = [{ line: 0, i: -1, done: 0, msg: `Line up the two ${n}-bit numbers.` }];
    for (let i = 0; i < n; i++) {
      steps.push({ line: [1, 2], i, done: i + 1, dwell: 0.6, msg: `Bit ${i}: ${A[i]} ${v.op} ${B[i]} = ${kbd(R[i])}` });
    }
    steps.push({ line: null, i: -1, done: n, msg: `Result: ${kbd(R.join(''))}` });
    if (v.op === 'XOR') steps.push({ line: 3, i: -1, done: n, undo: true, msg: `Reversibility: ${R.join('')} ⊕ ${b} = ${kbd(a)} — we got A back. That is why XOR with a key can be undone with the same key.` });
    return { steps, ctx: { A, B, R } };
  },
  render(step, stage, ctx) {
    const { A, B, R } = ctx;
    const op = ctx.values.op;
    const cls = (i) => (i === step.i ? 'hl' : '');
    const res = R.map((x, i) => (i < step.done ? x : '·'));
    stage.append(
      h('div', { class: 'row' },
        h('div', { class: 'col' },
          bitRow('A', A, { group: A.length, clsFn: cls, hex: false }),
          bitRow('B', B, { group: B.length, clsFn: cls, hex: false }),
          h('div', { class: 'rule-line' }, op),
          bitRow('Result', res, { group: R.length, clsFn: (i) => (i === step.i ? 'dst new' : ''), hex: false }),
          step.undo && h('div', { class: 'col undo' },
            note('Now XOR the result with B again:'),
            bitRow('Result', R, { group: R.length, hex: false }),
            bitRow('B', B, { group: B.length, hex: false }),
            h('div', { class: 'rule-line' }, 'XOR'),
            bitRow('= A', R.map((x, i) => x ^ B[i]), { group: R.length, clsFn: () => 'dst', hex: false }))),
        h('div', { class: 'col' }, h('div', { class: 'grid-label' }, 'Truth table'), truthTable(op, A[step.i], B[step.i]))),
    );
  },
};
