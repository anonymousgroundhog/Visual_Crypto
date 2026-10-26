import { h, math, row, kbd } from '../core/render.js';
import { ALPHA, isLetter, letterIndex, mod, shiftChar } from '../crypto/classical.js';
import { checkLength, cipherWheel, ioStrips } from './shared.js';

const code = (sign) => [
  'for each character c in the text:',
  '  if c is a letter:',
  '    p = index of c   (A=0 … Z=25)',
  `    x = (p ${sign} shift) mod 26`,
  '    output the letter at index x',
  '  else:',
  '    output c unchanged',
];

function shiftSteps(text, shift, decrypt) {
  const k = decrypt ? -shift : shift;
  const steps = [];
  let out = '';
  steps.push({ line: null, pos: -1, out, hi: -1, msg: `The inner wheel is rotated by ${kbd(`${shift >= 0 ? '+' : ''}${shift}`)}. To ${decrypt ? 'decrypt, read inner → outer' : 'encrypt, read outer → inner'}.` });
  [...text].forEach((c, pos) => {
    if (!isLetter(c)) {
      out += c;
      steps.push({ line: [5, 6], pos, out, hi: -1, dwell: 0.4, msg: `${kbd(c === ' ' ? 'space' : c)} is not a letter, so it is copied unchanged.` });
      return;
    }
    const p = letterIndex(c);
    const x = mod(p + k, 26);
    out += shiftChar(c, k);
    const plainIdx = decrypt ? x : p;
    steps.push({
      line: [2, 3, 4], pos, out, hi: plainIdx, p, x, c,
      msg: `${kbd(c)} has index ${p}. (${p} ${decrypt ? '−' : '+'} ${Math.abs(shift)}) mod 26 = ${x} → ${kbd(out.at(-1))}.`,
    });
  });
  steps.push({ line: null, pos: text.length, out, hi: -1, msg: `Done. ${decrypt ? 'Plaintext' : 'Ciphertext'}: ${kbd(out)}` });
  return steps;
}

export function makeShiftCipher({ id, title, blurb, fixedShift, about, slides }) {
  const inputs = [{ id: 'text', label: 'Text', type: 'textarea', value: fixedShift ? 'A CAT' : 'Attack at dawn', rows: 2 }];
  if (fixedShift == null) inputs.push({ id: 'shift', label: 'Shift (key)', type: 'number', value: 3, min: -25, max: 25, help: 'Julius Caesar reputedly used +3' });
  return {
    id, title, blurb, slides, category: 'Classical ciphers',
    about,
    inputs,
    actions: [{ id: 'encrypt', label: 'Encrypt' }, { id: 'decrypt', label: 'Decrypt' }],
    code: { encrypt: code('+'), decrypt: code('−') },
    random: () => ({ shift: 1 + Math.floor(Math.random() * 25) }),
    generate(action, v) {
      checkLength(v.text);
      const shift = fixedShift ?? v.shift;
      if (!Number.isInteger(shift)) throw new Error('Shift must be a whole number.');
      return { steps: shiftSteps(v.text, shift, action === 'decrypt'), ctx: { shift } };
    },
    render(step, stage, ctx) {
      const decrypt = ctx.action === 'decrypt';
      stage.append(
        row(
          h('div', { class: 'wheel-wrap' }, cipherWheel(ctx.shift, step.hi)),
          h('div', { class: 'col grow' },
            ioStrips(ctx.values.text, step.out, step.pos, { inLabel: decrypt ? 'Ciphertext' : 'Plaintext', outLabel: decrypt ? 'Plaintext' : 'Ciphertext' }),
            step.p != null && math(`index(${step.c.toUpperCase()}) = <b>${step.p}</b> &nbsp;→&nbsp; (${step.p} ${decrypt ? '−' : '+'} ${Math.abs(ctx.shift)}) mod 26 = <b>${step.x}</b> &nbsp;→&nbsp; <b class="k">${ALPHA[step.x]}</b>`),
            h('p', { class: 'hint' }, `Key space: only 26 possible shifts — a brute-force attack tries them all in seconds (see Frequency Analysis).`))),
      );
    },
  };
}

export default makeShiftCipher({
  id: 'caesar',
  title: 'Caesar Cipher',
  slides: '25–27',
  blurb: 'Shift every letter by a fixed amount. The simplest substitution cipher.',
  about: `<p>A <b>monoalphabetic substitution</b> cipher: every letter is shifted by the same number, the <i>key</i>. Past Z, wrap back to A.</p>
<p><code>A CAT</code> with +2 → <code>C ECV</code>; with +3 → <code>D FDW</code>.</p>
<p>Breaking it: brute force over a key space of just 26, or letter frequency (E, T, A…). <span class="ref">Ch. 5 slides 25–27</span></p>`,
});
