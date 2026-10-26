import { h, bitRow, strip, table, kbd, note, math, op } from '../core/render.js';
import { desBlock, IP, FP, E, P, PC1, PC2, SHIFTS, SBOX } from '../crypto/des.js';
import { bytesToBits, bitsToHex, parseBlock, printable, bitsToBytes } from '../crypto/bits.js';

export const nibbles = (bits) => {
  let out = '';
  for (let i = 0; i < bits.length; i += 4) out += parseInt(bits.slice(i, i + 4).join(''), 2).toString(16).toUpperCase();
  return out;
};

/** Permutation table: each cell shows which input bit it takes (small) and that bit (big). */
export function permTable(label, tbl, src, width = 8) {
  return h('div', { class: 'perm' },
    h('div', { class: 'grid-label' }, label),
    h('div', { class: 'perm-grid', style: { gridTemplateColumns: `repeat(${width}, 1fr)` } },
      tbl.map((p, i) => h('div', { class: `perm-cell b${src[p - 1]}`, title: `output bit ${i + 1} ← input bit ${p}` }, h('small', {}, p), src[p - 1]))));
}

function sboxPanel(box, s) {
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 16; c++) {
      const hit = r === box.row && c === box.col;
      cells.push(h('div', { class: `sb-cell ${hit ? 'hit' : r === box.row || c === box.col ? 'lane' : ''}` }, SBOX[s][r * 16 + c]));
    }
  }
  return h('div', { class: 'sb' },
    h('div', { class: 'sb-head' },
      h('b', {}, `S${s + 1}`),
      h('span', { class: 'sb-in' }, h('i', { class: 'outer' }, box.six[0]), h('i', { class: 'inner' }, box.six.slice(1, 5).join('')), h('i', { class: 'outer' }, box.six[5])),
      h('span', {}, `row ${box.row}, col ${box.col} → ${box.val} = ${box.four.join('')}`)),
    h('div', { class: 'sb-grid' }, cells));
}

export const roundStrip = (current, done) =>
  strip('Round', Array.from({ length: 16 }, (_, i) => ({ t: i + 1, cls: i + 1 === current ? 'hl' : i + 1 <= done ? 'done' : '' })), 'rounds');

const CODE = [
  'K₁…K₁₆ = key schedule(key)        // PC-1, shifts, PC-2',
  'L₀ ‖ R₀ = IP(block)                // initial permutation',
  'for i = 1 … 16:                    // (keys reversed to decrypt)',
  '  e = E(Rᵢ₋₁)                       // expand 32 → 48 bits',
  '  x = e ⊕ Kᵢ',
  '  s = S₁(x₁) ‖ … ‖ S₈(x₈)          // eight 6→4-bit S-boxes',
  '  f = P(s)                         // permute 32 bits',
  '  Lᵢ = Rᵢ₋₁;  Rᵢ = Lᵢ₋₁ ⊕ f',
  'output = FP(R₁₆ ‖ L₁₆)             // final permutation',
];

export default {
  id: 'des',
  title: 'DES',
  slides: '41–42',
  category: 'Symmetric ciphers',
  blurb: 'The Data Encryption Standard: a 16-round Feistel cipher with eight S-boxes.',
  about: `<p>Designed at <b>IBM</b> in the early 1970s from Feistel's <i>Lucifer</i> (altered with the NSA). The U.S. standard until the late 1990s.</p>
<ul><li>64-bit blocks, 16 rounds, 56-bit key (8 parity bits are dropped).</li>
<li>Round keys: 56-bit key split into 28-bit halves, each shifted 1–2 bits per round, 48 bits selected by PC-2.</li>
<li>Round function F: expand 32 → 48 bits, XOR the round key, eight <b>S-boxes</b> (6 bits in → 4 out), permute.</li></ul>
<p>The algorithm is sound; the <b>key is too short</b>. 2⁵⁶ keys can be brute-forced today. <span class="ref">Ch. 5 slides 41–42</span></p>
<p>Default inputs are the classic textbook vector: key <code>133457799BBCDFF1</code>, plaintext <code>0123456789ABCDEF</code> → <code>85E813540F0AB405</code>.</p>`,
  inputs: [
    { id: 'format', label: 'Block format', type: 'select', value: 'hex', options: [['hex', 'Hex (16 digits)'], ['text', 'Text (≤ 8 chars)']] },
    { id: 'block', label: 'Block', type: 'text', value: '0123456789ABCDEF' },
    { id: 'key', label: 'Key (16 hex digits)', type: 'text', value: '133457799BBCDFF1' },
    { id: 'detail', label: 'Detail', type: 'select', value: 'all', options: [['all', 'Every round in detail'], ['first', 'Round 1 in detail, then summaries'], ['summary', 'Round summaries only']] },
  ],
  actions: [{ id: 'encrypt', label: 'Encrypt' }, { id: 'decrypt', label: 'Decrypt' }],
  code: CODE,
  generate(action, v) {
    const decrypt = action === 'decrypt';
    const block = bytesToBits(parseBlock(v.block, decrypt ? 'hex' : v.format, 8, 'Block'));
    const key = bytesToBits(parseBlock(v.key, 'hex', 8, 'Key'));
    const t = desBlock(block, key, decrypt);
    const steps = [];
    steps.push({ kind: 'input', line: null, msg: `64-bit ${decrypt ? 'ciphertext' : 'plaintext'} ${kbd(bitsToHex(block))} and key ${kbd(bitsToHex(key))}. Every 8th key bit (dimmed) is a parity bit and is thrown away.` });
    steps.push({ kind: 'pc1', line: 0, msg: `Key schedule: PC-1 picks 56 of the 64 key bits and splits them into C₀ = ${kbd(nibbles(t.schedule.C[0]))} and D₀ = ${kbd(nibbles(t.schedule.D[0]))}.` });
    steps.push({ kind: 'schedule', line: 0, msg: `Each round rotates C and D left by 1 or 2 bits, then PC-2 selects 48 bits as the round key Kᵢ.${decrypt ? ' To decrypt, the keys are used in reverse order K₁₆ … K₁.' : ''}` });
    steps.push({ kind: 'ip', line: 1, msg: `Initial permutation IP shuffles the 64 bits. L₀ = ${kbd(nibbles(t.ip.slice(0, 32)))}, R₀ = ${kbd(nibbles(t.ip.slice(32)))}.` });
    for (const r of t.rounds) {
      const detailed = v.detail === 'all' || (v.detail === 'first' && r.n === 1);
      if (detailed) {
        steps.push({ kind: 'E', r, line: [2, 3], msg: `Round ${r.n}: expansion E copies some of R's 32 bits twice to make 48 bits (the edge bits of each 4-bit group are duplicated).` });
        steps.push({ kind: 'xor', r, line: 4, msg: `XOR the expanded half with round key K${r.keyIndex} = ${kbd(nibbles(r.k))}.` });
        steps.push({ kind: 'sbox', r, line: 5, msg: `Eight S-boxes: for each 6-bit chunk, the outer bits (violet) choose the row and the middle 4 bits (blue) choose the column. Output: ${kbd(nibbles(r.f.sOut))}.`, dwell: 1.6 });
        steps.push({ kind: 'P', r, line: 6, msg: `Permutation P scatters the S-box outputs: f = ${kbd(nibbles(r.f.out))}.` });
      }
      steps.push({ kind: 'swap', r, line: 7, msg: `R${r.n} = L${r.n - 1} ⊕ f = ${kbd(nibbles(r.newR))}; L${r.n} = R${r.n - 1} = ${kbd(nibbles(r.newL))}.`, dwell: detailed ? 1 : 0.7 });
    }
    steps.push({ kind: 'fp', line: 8, msg: `Swap back to R₁₆ ‖ L₁₆ and apply the final permutation FP = IP⁻¹. Result: ${kbd(bitsToHex(t.out))}${decrypt ? ` (text: "${printable(bitsToBytes(t.out))}")` : ''}.` });
    return { steps, ctx: { t, key, decrypt } };
  },
  render(step, stage, ctx) {
    const { t } = ctx;
    const r = step.r;
    const done = r ? r.n - (step.kind === 'swap' ? 0 : 1) : step.kind === 'fp' ? 16 : 0;
    const parts = [roundStrip(r?.n, done)];
    switch (step.kind) {
      case 'input':
        parts.push(bitRow(ctx.decrypt ? 'Ciphertext' : 'Plaintext', t.input), bitRow('Key', ctx.key, { clsFn: (i) => (i % 8 === 7 ? 'dim' : '') }));
        break;
      case 'pc1':
        parts.push(h('div', { class: 'row' }, permTable('PC-1 (56 of 64 key bits)', PC1, ctx.key, 7),
          h('div', { class: 'col' }, bitRow('C₀', t.schedule.C[0], { group: 4 }), bitRow('D₀', t.schedule.D[0], { group: 4 }))));
        break;
      case 'schedule':
        parts.push(table(['Round', 'Shift', 'Cᵢ', 'Dᵢ', 'Kᵢ (48 bits)'], SHIFTS.map((sh, i) => [i + 1, sh, nibbles(t.schedule.C[i + 1]), nibbles(t.schedule.D[i + 1]), nibbles(t.schedule.K[i + 1])]), { compact: true }), note(`PC-2 picks bits ${PC2.slice(0, 6).join(', ')}, … from Cᵢ ‖ Dᵢ (8 of the 56 bits are dropped).`));
        break;
      case 'ip':
        parts.push(h('div', { class: 'row' }, permTable('IP', IP, t.input),
          h('div', { class: 'col' }, bitRow('L₀', t.ip.slice(0, 32), { clsFn: () => 'lhalf' }), bitRow('R₀', t.ip.slice(32), { clsFn: () => 'rhalf' }))));
        break;
      case 'E':
        parts.push(h('div', { class: 'row' }, permTable('Expansion E (32 → 48)', E, r.R, 6),
          h('div', { class: 'col' }, bitRow(`R${r.n - 1}`, r.R, { clsFn: () => 'rhalf', group: 4 }), op('↓ E'), bitRow('E(R)', r.f.expanded, { group: 6, hex: false }))));
        break;
      case 'xor':
        parts.push(bitRow('E(R)', r.f.expanded, { group: 6, hex: false }), bitRow(`K${r.keyIndex}`, r.k, { group: 6, hex: false, clsFn: () => 'src' }), h('div', { class: 'rule-line' }, 'XOR'),
          bitRow('x', r.f.mixed, { group: 6, hex: false, clsFn: (i) => (i % 6 === 0 || i % 6 === 5 ? 'outer' : 'inner') }));
        break;
      case 'sbox':
        parts.push(h('div', { class: 'sb-wrap' }, r.f.boxes.map((b, i) => sboxPanel(b, i))), bitRow('S-box output', r.f.sOut, { group: 4 }));
        break;
      case 'P':
        parts.push(h('div', { class: 'row' }, permTable('P (32 → 32)', P, r.f.sOut, 8),
          h('div', { class: 'col' }, bitRow('S-box out', r.f.sOut, { group: 4 }), op('↓ P'), bitRow('f', r.f.out, { group: 4, clsFn: () => 'src' }))));
        break;
      case 'swap':
        parts.push(h('div', { class: 'col' },
          bitRow(`L${r.n - 1}`, r.L, { group: 4, clsFn: () => 'lhalf' }),
          bitRow('f(R, K)', r.f.out, { group: 4, clsFn: () => 'src' }),
          h('div', { class: 'rule-line' }, 'XOR'),
          bitRow(`R${r.n}`, r.newR, { group: 4, clsFn: () => 'dst new' }),
          bitRow(`L${r.n} = R${r.n - 1}`, r.newL, { group: 4, clsFn: () => 'lhalf' })));
        break;
      case 'fp':
        parts.push(h('div', { class: 'row' }, permTable('FP = IP⁻¹', FP, t.preout),
          h('div', { class: 'col' }, bitRow('R₁₆ ‖ L₁₆', t.preout), op('↓ FP'), bitRow(ctx.decrypt ? 'Plaintext' : 'Ciphertext', t.out, { clsFn: () => 'dst' }), math(`<b class="k">${bitsToHex(t.out)}</b>`))));
        break;
    }
    stage.append(h('div', { class: 'col' }, parts));
  },
};
