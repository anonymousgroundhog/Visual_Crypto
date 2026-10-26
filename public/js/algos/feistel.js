import { h, s, bitRow, strip, kbd, math } from '../core/render.js';
import { feistelTrace, SBOX4 } from '../crypto/feistel.js';
import { toBin, toHex } from '../crypto/bits.js';

const bits8 = (n) => [...toBin(n)].map(Number);

/** One Feistel round as a ladder diagram. */
function ladder(st, phase) {
  const W = 570;
  const Hh = 250;
  const box = (x, y, w, label, val, cls = '') => [
    s('rect', { x, y, width: w, height: 44, rx: 8, class: `fe-box ${cls}` }),
    s('text', { x: x + w / 2, y: y + 18, class: 'fe-name' }, label),
    s('text', { x: x + w / 2, y: y + 36, class: 'fe-val' }, val),
  ];
  const wire = (d, hot) => s('path', { d, class: `fe-wire ${hot ? 'hot' : ''}` });
  const kids = [
    // R feeds F; F's output feeds the XOR with L; the halves then cross (swap).
    wire('M405,54 L405,96', phase >= 1),
    wire('M490,118 L450,118', phase >= 1),
    wire('M360,118 L129,118', phase >= 1),
    wire('M115,54 L115,104', phase >= 2),
    wire('M115,132 L115,150 L405,192', phase >= 2),
    wire('M345,54 L345,150 L115,192', phase >= 2),
    ...box(40, 10, 150, `L${st.n - 1}`, `${toHex(st.L)} · ${toBin(st.L)}`, phase >= 2 ? 'used' : ''),
    ...box(330, 10, 150, `R${st.n - 1}`, `${toHex(st.R)} · ${toBin(st.R)}`, phase >= 1 ? 'used' : ''),
    ...box(360, 96, 90, 'F', phase >= 1 ? toHex(st.f.out) : '?', phase >= 1 ? 'f on' : 'f'),
    ...box(490, 96, 70, `K${st.n}`, toHex(st.K), 'key'),
    s('circle', { cx: 115, cy: 118, r: 14, class: `fe-xor ${phase >= 2 ? 'on' : ''}` }),
    s('text', { x: 115, y: 124, class: 'fe-xor-t' }, '⊕'),
  ];
  if (phase >= 2) {
    kids.push(...box(40, 196, 150, `L${st.n} = R${st.n - 1}`, toHex(st.newL), 'out'), ...box(330, 196, 150, `R${st.n} = L ⊕ F`, toHex(st.newR), 'out'));
  }
  return s('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'feistel-svg', role: 'img', 'aria-label': `Feistel round ${st.n}` }, kids);
}

export default {
  id: 'feistel',
  title: 'Feistel Network',
  slides: '40',
  category: 'Symmetric ciphers',
  blurb: 'Split, scramble one half, XOR into the other, swap. The skeleton of DES.',
  about: `<p><b>Horst Feistel</b>'s structure underlies most block ciphers, including DES:</p>
<ol><li>Split the block into halves L₀ and R₀.</li><li>Apply a round function F to one half with a round key.</li><li>XOR F's output into the other half.</li><li>Swap the halves. Repeat for N rounds.</li></ol>
<p>The magic: <b>F never needs to be reversible</b>. Decryption is the same network with the round keys in reverse order. Feistel ciphers differ only in F and the number of rounds.</p>
<p>This toy uses a 16-bit block, an 8-bit round function (XOR key → 4-bit S-boxes → rotate) and is small enough to check by hand. <span class="ref">Ch. 5 slide 40</span></p>`,
  inputs: [
    { id: 'block', label: 'Block (4 hex digits = 16 bits)', type: 'text', value: '4849', help: '4849 = "HI" in ASCII' },
    { id: 'key', label: 'Key (4 hex digits)', type: 'text', value: 'A3F1' },
    { id: 'rounds', label: 'Rounds', type: 'number', value: 4, min: 1, max: 8 },
  ],
  actions: [{ id: 'encrypt', label: 'Encrypt' }, { id: 'decrypt', label: 'Decrypt' }],
  random: () => ({ block: toHex(Math.floor(Math.random() * 65536), 4), key: toHex(Math.floor(Math.random() * 65536), 4) }),
  code: [
    'L, R = left and right 8 bits of the block',
    'for round i = 1 … N   (keys reversed to decrypt):',
    '  f = F(R, Kᵢ) = rotl1( S-box( R ⊕ Kᵢ ) )',
    '  L, R = R, L ⊕ f        (XOR, then swap)',
    'output R ‖ L             (undo the final swap)',
  ],
  generate(action, v) {
    const parse = (x, n) => {
      if (!/^[0-9a-fA-F]{4}$/.test(x.trim())) throw new Error(`${n} must be exactly 4 hex digits.`);
      return parseInt(x, 16);
    };
    const block = parse(v.block, 'Block');
    const key = parse(v.key, 'Key');
    if (!(v.rounds >= 1 && v.rounds <= 8)) throw new Error('Rounds must be 1–8.');
    const decrypt = action === 'decrypt';
    const t = feistelTrace(block, key, v.rounds, decrypt);
    const steps = [{ line: 0, msg: `Split ${kbd(toHex(block, 4))} into L₀ = ${kbd(toHex(block >> 8))} and R₀ = ${kbd(toHex(block & 0xff))}. Round keys${decrypt ? ' (reversed for decryption)' : ''}: ${t.keys.map((k) => toHex(k)).join(', ')}.` }];
    for (const st of t.steps) {
      steps.push({ line: 2, st, phase: 1, msg: `Round ${st.n}: F(R, K${st.n}) — R ⊕ K = ${toHex(st.f.x)}, S-boxes → ${toHex(st.f.s)}, rotate left 1 → ${kbd(toHex(st.f.out))}.` });
      steps.push({ line: 3, st, phase: 2, msg: `New R = L ⊕ f = ${toHex(st.L)} ⊕ ${toHex(st.f.out)} = ${kbd(toHex(st.newR))}. Old R becomes new L = ${kbd(toHex(st.newL))}.` });
    }
    steps.push({ line: 4, final: true, msg: `Output ${kbd(toHex(t.out, 4))}. ${decrypt ? 'This is the original plaintext.' : 'Press Decrypt with this block and the same key: the same network, keys reversed, gets the plaintext back.'}` });
    return { steps, ctx: { t, block } };
  },
  render(step, stage, ctx) {
    const { t } = ctx;
    const roundsStrip = strip('Rounds', t.steps.map((st) => ({ t: st.n, sub: toHex(st.K), cls: step.st?.n === st.n ? 'hl' : step.final || (step.st && st.n < step.st.n) ? 'done' : '' })));
    if (!step.st) {
      stage.append(h('div', { class: 'col' }, roundsStrip,
        bitRow(step.final ? 'Output' : 'Input block', bits8(step.final ? t.out >> 8 : ctx.block >> 8).concat(bits8(step.final ? t.out & 0xff : ctx.block & 0xff)), { group: 8, clsFn: (i) => (i < 8 ? 'lhalf' : 'rhalf') }),
        h('p', { class: 'hint' }, 'Left half (L) is tinted violet, right half (R) blue.')));
      return;
    }
    const { st } = step;
    stage.append(h('div', { class: 'row' },
      h('div', { class: 'col' }, roundsStrip, ladder(st, step.phase)),
      h('div', { class: 'col' },
        bitRow('R', bits8(st.R), { hex: false }),
        bitRow(`K${st.n}`, bits8(st.K), { hex: false }),
        bitRow('R ⊕ K', bits8(st.f.x), { hex: false }),
        math(`S-box: ${toHex(st.f.x >> 4, 1)} → ${toHex(SBOX4[st.f.x >> 4], 1)}, ${toHex(st.f.x & 15, 1)} → ${toHex(SBOX4[st.f.x & 15], 1)}`),
        bitRow('S-box out', bits8(st.f.s), { hex: false }),
        bitRow('f (rotl 1)', bits8(st.f.out), { hex: false, clsFn: () => 'src' }),
        step.phase >= 2 && bitRow('L', bits8(st.L), { hex: false }),
        step.phase >= 2 && bitRow('L ⊕ f', bits8(st.newR), { hex: false, clsFn: () => 'dst new' }))));
  },
};
