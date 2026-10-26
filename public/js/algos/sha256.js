import { h, bitRow, strip, table, kbd, note, math } from '../core/render.js';
import { sha256Trace } from '../crypto/sha256.js';
import { utf8, bytesToBits, hexToBits, toHex } from '../crypto/bits.js';

const w32 = (x) => toHex(x, 8);
const REG = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function registers(before, after) {
  return h('div', { class: 'regs' }, REG.map((n, i) => h('div', { class: `reg ${after && (i === 0 || i === 4) ? 'new' : after ? 'moved' : ''}` },
    h('b', {}, n), h('code', {}, w32((after || before)[i])))));
}

function paddedView(padded, msgLen) {
  return h('div', { class: 'padview' }, [...padded].map((b, i) => {
    const cls = i < msgLen ? 'msg' : i === msgLen ? 'one' : i >= padded.length - 8 ? 'len' : 'zero';
    return h('span', { class: `pb ${cls}`, title: `byte ${i}` }, toHex(b));
  }));
}

export default {
  id: 'sha256',
  title: 'SHA-256 Hash',
  slides: '47',
  category: 'Hashes',
  blurb: 'One-way, fixed-length fingerprints. Padding, message schedule and 64 compression rounds.',
  about: `<p>A <b>cryptographic hash</b> maps any input to a fixed-length output and is designed to be:</p>
<ul><li><b>One-way</b> — you cannot "unhash" a digest.</li><li><b>Fixed length</b> — SHA-256 always gives 256 bits.</li><li><b>Collision resistant</b> — two inputs with the same digest should be practically impossible to find.</li></ul>
<p>Passwords are stored as hashes: at logon the system hashes what you type and compares (e.g. the Windows SAM file). MD5 and SHA-1 are broken for collisions; SHA-256 is the common choice today. Try <b>Avalanche</b> to see that changing one character flips about half of the output bits. <span class="ref">Ch. 5 slides 47, 58</span></p>`,
  inputs: [
    { id: 'text', label: 'Message', type: 'textarea', value: 'abc', rows: 2 },
    { id: 'text2', label: 'Second message (for Avalanche)', type: 'text', value: 'abd' },
    { id: 'detail', label: 'Round detail', type: 'select', value: '8', options: [['64', 'All 64 rounds'], ['8', 'First 8 rounds, then summary'], ['0', 'Summary only']] },
  ],
  actions: [{ id: 'hash', label: 'Hash' }, { id: 'avalanche', label: 'Avalanche' }],
  code: {
    hash: [
      'bytes = UTF-8(message)',
      'pad: append 0x80, zeros, then the 64-bit length → multiple of 64 bytes',
      'for each 64-byte block:',
      '  W[0..15] = block words; W[t] = σ1(W[t−2]) + W[t−7] + σ0(W[t−15]) + W[t−16]',
      '  a…h = H0…H7',
      '  for t = 0 … 63:',
      '    T1 = h + Σ1(e) + Ch(e,f,g) + K[t] + W[t];  T2 = Σ0(a) + Maj(a,b,c)',
      '    h=g, g=f, f=e, e=d+T1, d=c, c=b, b=a, a=T1+T2',
      '  H0…H7 += a…h',
      'digest = H0 ‖ H1 ‖ … ‖ H7',
    ],
    avalanche: ['d1 = SHA-256(message 1)', 'd2 = SHA-256(message 2)', 'diff = d1 XOR d2', 'count the 1 bits in diff (≈ 128 of 256 expected)'],
  },
  generate(action, v) {
    if (action === 'avalanche') {
      const d1 = sha256Trace(utf8(v.text)).digest;
      const d2 = sha256Trace(utf8(v.text2)).digest;
      const b1 = hexToBits(d1);
      const b2 = hexToBits(d2);
      const diff = b1.map((b, i) => b ^ b2[i]);
      const n = diff.reduce((a, b) => a + b, 0);
      return {
        steps: [
          { kind: 'av', show: 1, line: 0, d1, d2, b1, b2, diff, msg: `SHA-256(${kbd(v.text)}) = ${kbd(d1.slice(0, 16) + '…')}` },
          { kind: 'av', show: 2, line: 1, d1, d2, b1, b2, diff, msg: `SHA-256(${kbd(v.text2)}) = ${kbd(d2.slice(0, 16) + '…')}` },
          { kind: 'av', show: 3, line: [2, 3], d1, d2, b1, b2, diff, n, msg: `${kbd(n)} of 256 bits differ (${((n / 256) * 100).toFixed(1)}%). A tiny input change scrambles the whole digest — the <b>avalanche effect</b>.` },
        ],
      };
    }
    const bytes = utf8(v.text);
    if (bytes.length > 300) throw new Error('Please keep the message under 300 bytes.');
    const t = sha256Trace(bytes);
    const detail = Number(v.detail);
    const steps = [
      { kind: 'bytes', line: 0, msg: `${kbd(v.text)} is ${bytes.length} byte${bytes.length === 1 ? '' : 's'} (${bytes.length * 8} bits).` },
      { kind: 'pad', line: 1, msg: `Padding: one 1-bit (0x80), zeros, and the length ${bytes.length * 8} as a 64-bit number, to reach ${t.padded.length} bytes = ${t.blocks.length} block${t.blocks.length > 1 ? 's' : ''} of 512 bits.` },
    ];
    t.blocks.forEach((blk, bi) => {
      steps.push({ kind: 'sched', bi, line: [2, 3], msg: `Block ${bi + 1}: the 16 words of the block are W[0..15]; W[16..63] are mixed from earlier words.`, dwell: 1.4 });
      steps.push({ kind: 'init', bi, line: 4, msg: `Load the working registers a…h from the current hash value H${bi === 0 ? ' (the fractional parts of √2, √3, √5, …)' : ''}.` });
      blk.rounds.forEach((r) => {
        if (r.t < detail) steps.push({ kind: 'round', bi, r, line: [5, 6, 7], msg: `Round ${r.t}: T1 = ${w32(r.T1)}, T2 = ${w32(r.T2)}. New a = T1 + T2 = ${kbd(w32(r.after[0]))}, new e = d + T1 = ${kbd(w32(r.after[4]))}; the rest shift down.`, dwell: 0.9 });
      });
      if (detail < 64) steps.push({ kind: 'round', bi, r: blk.rounds[63], skipped: true, line: [5, 6, 7], msg: `…rounds ${detail}–63 run the same way. After round 63 the registers are shown here.` });
      steps.push({ kind: 'add', bi, line: 8, msg: `Add the registers into H (mod 2³²). This chaining is what makes the hash of the next block depend on everything before it.` });
    });
    steps.push({ kind: 'digest', line: 9, msg: `Digest: ${kbd(t.digest)}` });
    return { steps, ctx: { t, bytes } };
  },
  render(step, stage, ctx) {
    if (step.kind === 'av') {
      const parts = [bitRow('Digest 1', step.b1, { group: 32 })];
      if (step.show >= 2) parts.push(bitRow('Digest 2', step.b2, { group: 32 }));
      if (step.show >= 3) parts.push(bitRow('Differs', step.diff, { group: 32, clsFn: (i, b) => (b ? 'flip' : 'dim') }), math(`<b class="k">${step.n}</b> / 256 bits changed`));
      stage.append(h('div', { class: 'col' }, parts));
      return;
    }
    const { t, bytes } = ctx;
    const blk = t.blocks[step.bi];
    const parts = [];
    switch (step.kind) {
      case 'bytes':
        parts.push(strip('Bytes', [...bytes].map((b) => ({ t: toHex(b), sub: b >= 32 && b < 127 ? String.fromCharCode(b) : '' })), 'wrap'), bitRow('Bits', bytesToBits(bytes).slice(0, 256)));
        break;
      case 'pad':
        parts.push(paddedView(t.padded, bytes.length), h('div', { class: 'legend-inline' }, h('span', { class: 'sw msg' }), 'message ', h('span', { class: 'sw one' }), '0x80 ', h('span', { class: 'sw zero' }), 'zeros ', h('span', { class: 'sw len' }), 'length'));
        break;
      case 'sched':
        parts.push(h('div', { class: 'wsched' }, blk.W.map((w, i) => h('div', { class: `wcell ${i < 16 ? 'msg' : ''} ${i === 16 ? 'hl' : ''}` }, h('small', {}, `W${i}`), w32(w)))),
          math(`W[16] = σ1(W[14]) + W[9] + σ0(W[1]) + W[0] = ${w32(blk.W[16])}`),
          note('σ0(x) = (x ⋙ 7) ⊕ (x ⋙ 18) ⊕ (x ≫ 3) &nbsp;&nbsp; σ1(x) = (x ⋙ 17) ⊕ (x ⋙ 19) ⊕ (x ≫ 10)'));
        break;
      case 'init':
        parts.push(registers(blk.Hin));
        break;
      case 'round': {
        const r = step.r;
        parts.push(strip('Round', Array.from({ length: 64 }, (_, i) => ({ t: '', cls: i === r.t ? 'hl tick' : i < r.t ? 'done tick' : 'tick' })), 'ticks'));
        parts.push(h('div', { class: 'row' },
          h('div', { class: 'col' }, h('div', { class: 'grid-label' }, 'Before'), registers(r.before)),
          h('div', { class: 'col' }, h('div', { class: 'grid-label' }, `After round ${r.t}`), registers(r.before, r.after))));
        if (!step.skipped) {
          parts.push(table(['Term', 'Value'], [
            ['Σ1(e) = (e⋙6)⊕(e⋙11)⊕(e⋙25)', w32(r.S1)], ['Ch(e,f,g) = (e∧f)⊕(¬e∧g)', w32(r.CH)], [`K[${r.t}]`, w32(r.K)], [`W[${r.t}]`, w32(r.W)],
            ['T1 = h + Σ1 + Ch + K + W', w32(r.T1)], ['Σ0(a) = (a⋙2)⊕(a⋙13)⊕(a⋙22)', w32(r.S0)], ['Maj(a,b,c)', w32(r.MAJ)], ['T2 = Σ0 + Maj', w32(r.T2)],
          ], { compact: true }));
        }
        break;
      }
      case 'add':
        parts.push(table(['', 'H before', '+ register', '= H after'], blk.Hout.map((x, i) => [`H${i}`, w32(blk.Hin[i]), w32(blk.rounds[63].after[i]), h('b', {}, w32(x))]), { compact: true }));
        break;
      case 'digest':
        parts.push(math(`<b class="k digest">${t.digest}</b>`), bitRow('256 bits', hexToBits(t.digest), { group: 32 }));
        break;
    }
    stage.append(h('div', { class: 'col' }, parts));
  },
};
