import { h, table, kbd, note } from '../core/render.js';
import { tdesStages } from '../crypto/des.js';
import { bytesToHex, parseBlock, printable, hexToBytes } from '../crypto/bits.js';
import { nibbles } from './des.js';

function pipeline(stages, current) {
  return h('div', { class: 'pipeline' },
    h('div', { class: 'pipe-io' }, h('small', {}, 'in'), stages[0].inHex),
    stages.map((st, i) => [
      h('div', { class: 'pipe-arrow' }, '→'),
      h('div', { class: `pipe-stage ${st.op === 'E' ? 'enc' : 'dec'} ${i === current ? 'hl' : i < current ? 'done' : ''}` },
        h('b', {}, `${st.op === 'E' ? 'Encrypt' : 'Decrypt'}`), h('span', {}, `with ${st.name}`), h('code', {}, st.key)),
      h('div', { class: 'pipe-arrow' }, '→'),
      h('div', { class: `pipe-io ${i < current || current === 3 ? 'on' : i === current ? 'new' : ''}` }, h('small', {}, i === 2 ? 'out' : `step ${i + 1}`), i <= current ? st.outHex : '?'),
    ]));
}

export default {
  id: 'tdes',
  title: 'Triple DES (3DES)',
  slides: '43',
  category: 'Symmetric ciphers',
  blurb: 'Encrypt–Decrypt–Encrypt with up to three DES keys: the interim fix for DES\'s short key.',
  about: `<p>While a DES replacement was being chosen, <b>3DES</b> ran DES three times: <b>Encrypt with K₁ → Decrypt with K₂ → Encrypt with K₃</b> (EDE).</p>
<table class="data compact"><tr><th>Option</th><th>Keys</th><th>Security</th></tr><tr><td>1</td><td>all three different</td><td>most secure</td></tr><tr><td>2</td><td>K₁ = K₃</td><td>middle</td></tr><tr><td>3</td><td>all three the same</td><td>least — equals single DES</td></tr></table>
<p>Why decrypt in the middle? With all keys equal, E-D-E collapses to a single DES encryption, so 3DES hardware stays backward compatible. 2DES is barely stronger (meet-in-the-middle attack). <span class="ref">Ch. 5 slide 43</span></p>`,
  inputs: [
    { id: 'block', label: 'Block (16 hex digits)', type: 'text', value: '0123456789ABCDEF' },
    { id: 'option', label: 'Keying option', type: 'select', value: '1', options: [['1', 'Option 1: K₁, K₂, K₃ all different'], ['2', 'Option 2: K₁ = K₃'], ['3', 'Option 3: all the same']] },
    { id: 'k1', label: 'K₁', type: 'text', value: '133457799BBCDFF1' },
    { id: 'k2', label: 'K₂', type: 'text', value: '0E329232EA6D0D73', when: (v) => v.option !== '3' },
    { id: 'k3', label: 'K₃', type: 'text', value: 'A1B2C3D4E5F60718', when: (v) => v.option === '1' },
  ],
  actions: [{ id: 'encrypt', label: 'Encrypt' }, { id: 'decrypt', label: 'Decrypt' }],
  code: {
    encrypt: ['a = DES_encrypt(K₁, plaintext)', 'b = DES_decrypt(K₂, a)', 'c = DES_encrypt(K₃, b)', 'return c'],
    decrypt: ['a = DES_decrypt(K₃, ciphertext)', 'b = DES_encrypt(K₂, a)', 'p = DES_decrypt(K₁, b)', 'return p'],
  },
  generate(action, v) {
    const decrypt = action === 'decrypt';
    const block = bytesToHex(parseBlock(v.block, 'hex', 8, 'Block'));
    const k1 = bytesToHex(parseBlock(v.k1, 'hex', 8, 'K₁'));
    const k2 = v.option === '3' ? k1 : bytesToHex(parseBlock(v.k2, 'hex', 8, 'K₂'));
    const k3 = v.option === '1' ? bytesToHex(parseBlock(v.k3, 'hex', 8, 'K₃')) : k1;
    const stages = tdesStages(block, [k1, k2, k3], decrypt);
    const steps = [{ stage: -1, line: null, msg: `${decrypt ? 'Ciphertext' : 'Plaintext'} ${kbd(block)} passes through three full 16-round DES operations.${v.option === '3' ? ' With all keys equal the middle decrypt undoes the first encrypt — watch.' : ''}` }];
    stages.forEach((st, i) => {
      steps.push({ stage: i, line: i, msg: `Stage ${i + 1}: DES ${st.op === 'E' ? 'encrypt' : 'decrypt'} ${kbd(st.inHex)} with ${st.name} → ${kbd(st.outHex)}.${v.option === '3' && i === 1 ? ' Back to the original input!' : ''}`, dwell: 1.6 });
    });
    const out = stages[2].outHex;
    steps.push({ stage: 3, line: 3, msg: `Result: ${kbd(out)}${decrypt ? ` (text "${printable(hexToBytes(out))}")` : ''}. Effective key length: ${v.option === '1' ? '168 bits (112 bits of real strength)' : v.option === '2' ? '112 bits' : '56 bits — no better than DES'}.` });
    return { steps, ctx: { stages } };
  },
  render(step, stage, ctx) {
    const st = ctx.stages[Math.min(step.stage, 2)];
    stage.append(h('div', { class: 'col' },
      pipeline(ctx.stages, step.stage),
      step.stage >= 0 && step.stage <= 2 && h('div', { class: 'col' },
        h('div', { class: 'grid-label' }, `Stage ${step.stage + 1}: the 16 DES rounds (${st.op === 'E' ? 'keys K₁…K₁₆' : 'keys reversed K₁₆…K₁'})`),
        table(['Round', 'Key used', 'Lᵢ', 'Rᵢ'], st.trace.rounds.map((r) => [r.n, `K${r.keyIndex}`, nibbles(r.newL), nibbles(r.newR)]), { compact: true })),
      step.stage === 3 && note('Each stage is a complete DES operation — open the <a href="#/des">DES visualizer</a> to see inside one.')));
  },
};
