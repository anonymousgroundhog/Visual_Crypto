import { h, math, strip, kbd } from '../core/render.js';
import { ALPHA, isLetter, letterIndex, mod, parseShifts, shiftChar } from '../crypto/classical.js';
import { checkLength, ioStrips } from './shared.js';

const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);

export default {
  id: 'multishift',
  title: 'Multialphabet Substitution',
  slides: '31',
  category: 'Classical ciphers',
  blurb: 'Several Caesar shifts used in rotation, so the same letter encrypts differently.',
  about: `<p>Instead of one shift, use a <b>list of shifts in rotation</b>. Slide example: shifts (+2, −2, +3) turn <code>A CAT</code> into <code>C ADV</code> — the first A becomes C, the second becomes D.</p>
<p>Harder than Caesar, but still breakable with pen and paper, and trivial for a computer. <span class="ref">Ch. 5 slide 31</span></p>`,
  inputs: [
    { id: 'text', label: 'Text', type: 'textarea', value: 'A CAT', rows: 2 },
    { id: 'shifts', label: 'Shifts (in rotation)', type: 'text', value: '+2, -2, +3' },
  ],
  actions: [{ id: 'encrypt', label: 'Encrypt' }, { id: 'decrypt', label: 'Decrypt' }],
  code: [
    'j = 0',
    'for each character c in the text:',
    '  if c is a letter:',
    '    k = shifts[j mod len(shifts)]   (negate to decrypt)',
    '    output (index(c) + k) mod 26',
    '    j = j + 1',
    '  else output c unchanged',
  ],
  generate(action, v) {
    checkLength(v.text);
    const shifts = parseShifts(v.shifts);
    const sign = action === 'decrypt' ? -1 : 1;
    const steps = [{ line: 0, pos: -1, out: '', j: -1, msg: `Shift schedule: ${shifts.map(fmt).join(', ')}. Spaces and punctuation do not use up a shift.` }];
    let out = '';
    let j = 0;
    [...v.text].forEach((c, pos) => {
      if (!isLetter(c)) {
        out += c;
        steps.push({ line: 6, pos, out, j: -1, dwell: 0.4, msg: `${kbd(c === ' ' ? 'space' : c)} copied; the shift pointer stays put.` });
        return;
      }
      const slot = j % shifts.length;
      const k = sign * shifts[slot];
      const p = letterIndex(c);
      out += shiftChar(c, k);
      steps.push({ line: [3, 4, 5], pos, out, j: slot, p, k, msg: `Letter #${j + 1} uses shift ${kbd(fmt(k))}: ${kbd(c)} (${p}) → (${p} ${k >= 0 ? '+' : '−'} ${Math.abs(k)}) mod 26 = ${mod(p + k, 26)} → ${kbd(out.at(-1))}.` });
      j++;
    });
    steps.push({ line: null, pos: v.text.length, out, j: -1, msg: `Done: ${kbd(out)}` });
    return { steps, ctx: { shifts, sign } };
  },
  render(step, stage, ctx) {
    stage.append(
      h('div', { class: 'col' },
        strip('Shifts', ctx.shifts.map((k, i) => ({ t: fmt(ctx.sign * k), cls: i === step.j ? 'hl' : '', sub: `#${i + 1}` }))),
        ioStrips(ctx.values.text, step.out, step.pos),
        step.p != null && math(`${ALPHA[step.p]} (${step.p}) ${step.k >= 0 ? '+' : '−'} ${Math.abs(step.k)} = ${step.p + step.k} → mod 26 = <b>${mod(step.p + step.k, 26)}</b> → <b class="k">${ALPHA[mod(step.p + step.k, 26)]}</b>`)),
    );
  },
};
