import { h, math, kbd } from '../core/render.js';
import { ALPHA, atbashChar, isLetter, letterIndex } from '../crypto/classical.js';
import { alphaStrip, checkLength, ioStrips } from './shared.js';

const REV = [...ALPHA].reverse().join('');

export default {
  id: 'atbash',
  title: 'Atbash',
  slides: '28',
  category: 'Classical ciphers',
  blurb: 'Reverse the alphabet: A↔Z, B↔Y, C↔X. Used by Hebrew scribes.',
  about: `<p>Atbash maps the alphabet onto itself backwards: letter at index <i>p</i> becomes the letter at <b>25 − p</b>.</p>
<p>It is its own inverse — running it twice returns the plaintext — and has no key, so anyone who knows the method can read it. <span class="ref">Ch. 5 slide 28</span></p>`,
  inputs: [{ id: 'text', label: 'Text', type: 'textarea', value: 'Hidden message', rows: 2 }],
  actions: [{ id: 'encode', label: 'Encode / Decode' }],
  code: [
    'for each character c in the text:',
    '  if c is a letter:',
    '    p = index of c   (A=0 … Z=25)',
    '    output the letter at index 25 − p',
    '  else output c unchanged',
  ],
  generate(_, v) {
    checkLength(v.text);
    const steps = [{ line: null, pos: -1, out: '', p: -1, msg: 'Top row: the normal alphabet. Bottom row: the same alphabet reversed.' }];
    let out = '';
    [...v.text].forEach((c, pos) => {
      if (!isLetter(c)) {
        out += c;
        steps.push({ line: 4, pos, out, p: -1, dwell: 0.4, msg: `${kbd(c === ' ' ? 'space' : c)} is copied unchanged.` });
        return;
      }
      const p = letterIndex(c);
      out += atbashChar(c);
      steps.push({ line: [2, 3], pos, out, p, msg: `${kbd(c)} is index ${p}; 25 − ${p} = ${25 - p} → ${kbd(out.at(-1))}.` });
    });
    steps.push({ line: null, pos: v.text.length, out, p: -1, msg: `Done: ${kbd(out)}. Run it again on the output to get the original back.` });
    return { steps };
  },
  render(step, stage, ctx) {
    stage.append(
      h('div', { class: 'col' },
        h('div', { class: 'mirror' }, alphaStrip('Plain', ALPHA, step.p, 'hl'), alphaStrip('Cipher', REV, step.p, 'dst')),
        ioStrips(ctx.values.text, step.out, step.pos),
        step.p >= 0 && math(`${ALPHA[step.p]} (index ${step.p}) → 25 − ${step.p} = ${25 - step.p} → <b class="k">${ALPHA[25 - step.p]}</b>`)),
    );
  },
};
