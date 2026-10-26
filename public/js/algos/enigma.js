import { h, s, strip, kbd } from '../core/render.js';
import { Enigma, ROTORS } from '../crypto/enigma.js';
import { ALPHA, lettersOnly } from '../crypto/classical.js';

const NAMES = Object.keys(ROTORS);
const STAGES = ['Plugboard', 'Rotor R', 'Rotor M', 'Rotor L', 'Reflector'];

/** Wiring diagram. Signal enters at the right (keyboard) and travels left, reflects, comes back. */
function diagram(press, positions) {
  const W = 760;
  const rowH = 15;
  const top = 34;
  const Hh = top + 26 * rowH + 10;
  const colW = 92;
  const gap = 46;
  // x ranges of components, right to left: plug, R, M, L, reflector
  const boxes = [0, 1, 2, 3, 4].map((k) => {
    const x1 = W - 70 - (k + 1) * colW - k * gap;
    return { x1, x2: x1 + colW };
  });
  const y = (i) => top + i * rowH + rowH / 2;
  const kids = [];
  boxes.forEach((b, k) => {
    kids.push(s('rect', { x: b.x1, y: top - 4, width: colW, height: 26 * rowH + 8, rx: 8, class: `en-box ${k === 4 ? 'refl' : ''}` }));
    kids.push(s('text', { x: (b.x1 + b.x2) / 2, y: top - 12, class: 'en-label' }, k >= 1 && k <= 3 ? `${STAGES[k]} · ${positions[3 - k]}` : STAGES[k]));
    for (let i = 0; i < 26; i++) {
      if (k === 0) kids.push(s('text', { x: b.x2 + 14, y: y(i) + 4, class: 'en-key' }, ALPHA[i]));
      if (k >= 1 && k <= 3) kids.push(s('text', { x: (b.x1 + b.x2) / 2, y: y(i) + 4, class: 'en-ring' }, ALPHA[(i + ALPHA.indexOf(positions[3 - k])) % 26]));
      kids.push(s('circle', { cx: b.x2, cy: y(i), r: 2.2, class: 'en-pin' }));
      if (k < 4) kids.push(s('circle', { cx: b.x1, cy: y(i), r: 2.2, class: 'en-pin' }));
    }
  });
  if (press) {
    const p = press.path; // [key, plug, R, M, L, refl, L', M', R', plug']
    const fwd = [];
    const back = [];
    // forward: keyboard -> plug -> R -> M -> L -> reflector
    fwd.push([W - 40, y(p[0])], [boxes[0].x2, y(p[0])], [boxes[0].x1, y(p[1])]);
    for (let k = 1; k <= 3; k++) fwd.push([boxes[k].x2, y(p[k])], [boxes[k].x1, y(p[k + 1])]);
    const rx = boxes[4].x1 + colW * 0.35;
    fwd.push([boxes[4].x2, y(p[4])], [rx, y(p[4])]);
    // back: reflector -> L -> M -> R -> plug -> lamp (each box entered on its left edge)
    back.push([rx, y(p[4])], [rx, y(p[5])], [boxes[4].x2, y(p[5])]);
    for (let k = 3; k >= 0; k--) back.push([boxes[k].x1, y(p[8 - k])], [boxes[k].x2, y(p[9 - k])]);
    back.push([W - 40, y(p[9])]);
    const d = (pts) => pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x},${yy}`).join(' ');
    kids.push(s('path', { d: d(fwd), class: 'en-path fwd' }), s('path', { d: d(back), class: 'en-path back' }));
    kids.push(s('circle', { cx: W - 40, cy: y(p[0]), r: 7, class: 'en-in' }), s('circle', { cx: W - 40, cy: y(p[9]), r: 7, class: 'en-out' }));
  }
  kids.push(s('text', { x: W - 40, y: top - 12, class: 'en-label' }, 'Keys/Lamps'));
  return s('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'enigma-svg', role: 'img', 'aria-label': 'Enigma signal path' }, kids);
}

const windows = (pos, moved) =>
  h('div', { class: 'en-windows' }, ['L', 'M', 'R'].map((n, i) => h('div', { class: `en-window ${moved?.[i] ? 'moved' : ''}` }, h('span', {}, pos[i]), h('small', {}, n))));

export default {
  id: 'enigma',
  title: 'Enigma Machine',
  slides: '33',
  category: 'Classical ciphers',
  blurb: 'WWII rotor machine. Follow the current through plugboard, rotors and reflector.',
  about: `<p>The German <b>Enigma</b> was an electromechanical multialphabet substitution machine. Each key press first <b>steps the rotors</b>, then sends current through the plugboard, three rotors, a reflector, and back out to a lamp.</p>
<p>Because the rotors move every press, the same key gives a different letter each time (A → F, then A → D). The reflector makes it <i>reciprocal</i>: typing the ciphertext with the same settings gives back the plaintext — and no letter ever encrypts to itself, a flaw the Allies exploited. <span class="ref">Ch. 5 slide 33</span></p>
<p>This is the Enigma I with reflector B. Note the middle rotor's <i>double step</i>.</p>`,
  inputs: [
    { id: 'text', label: 'Text', type: 'textarea', value: 'AAAAA', rows: 2 },
    { id: 'left', label: 'Left rotor', type: 'select', value: 'I', options: NAMES },
    { id: 'middle', label: 'Middle rotor', type: 'select', value: 'II', options: NAMES },
    { id: 'right', label: 'Right rotor', type: 'select', value: 'III', options: NAMES },
    { id: 'positions', label: 'Start positions (L M R)', type: 'text', value: 'AAA' },
    { id: 'rings', label: 'Ring settings (L M R)', type: 'text', value: 'AAA' },
    { id: 'plugboard', label: 'Plugboard pairs', type: 'text', value: '', help: 'e.g. AB CD EF (optional)' },
  ],
  actions: [{ id: 'run', label: 'Encrypt / Decrypt' }],
  code: [
    'for each letter typed:',
    '  step rotor R; if R was at its notch, step M',
    '  if M is at its notch, step M and L (double step)',
    '  c = plugboard(letter)',
    '  c = R(c); c = M(c); c = L(c)        forward',
    '  c = reflector(c)',
    '  c = L⁻¹(c); c = M⁻¹(c); c = R⁻¹(c)  backward',
    '  light the lamp plugboard(c)',
  ],
  generate(_, v) {
    const letters = lettersOnly(v.text);
    if (!letters) throw new Error('Please enter some letters.');
    if (letters.length > 80) throw new Error('Please keep the text under 80 letters.');
    const machine = new Enigma({ rotors: [v.left, v.middle, v.right], positions: v.positions, rings: v.rings, plugboard: v.plugboard });
    const steps = [{ line: null, pos: -1, out: '', positions: machine.positions, msg: `Rotors ${v.left}-${v.middle}-${v.right} at ${kbd(machine.positions)}, rings ${kbd(v.rings.toUpperCase())}.` }];
    let out = '';
    for (const [pos, ch] of [...letters].entries()) {
      const r = machine.press(ch);
      const which = ['L', 'M', 'R'].filter((_, i) => r.moved[i]).join(', ');
      steps.push({ line: r.moved[0] ? [1, 2] : 1, pos, out, positions: r.after, moved: r.moved, msg: `Key ${kbd(ch)} pressed. Rotors step first (${which}): ${kbd(r.before)} → ${kbd(r.after)}.${r.moved[0] ? ' The middle rotor double-stepped!' : ''}`, dwell: 0.7 });
      out += r.output;
      const p = r.path.map((i) => ALPHA[i]);
      steps.push({ line: [3, 4, 5, 6, 7], pos, out, positions: r.after, press: r, msg: `Signal: ${p[0]} → plug ${p[1]} → R ${p[2]} → M ${p[3]} → L ${p[4]} → reflector ${p[5]} → L ${p[6]} → M ${p[7]} → R ${p[8]} → plug ${p[9]}. Lamp ${kbd(r.output)} lights.` });
    }
    steps.push({ line: null, pos: letters.length, out, positions: machine.positions, msg: `Done: ${kbd(out)}. Reset to the same start positions and type this to decrypt.` });
    return { steps, ctx: { letters } };
  },
  render(step, stage, ctx) {
    stage.append(
      h('div', { class: 'col' },
        h('div', { class: 'row center' }, windows(step.positions, step.moved),
          step.press && h('div', { class: 'en-lamp' }, h('span', {}, step.press.output), h('small', {}, 'lamp'))),
        h('div', { class: 'enigma-wrap' }, diagram(step.press, step.positions)),
        h('div', { class: 'legend-inline' }, h('span', { class: 'sw fwd' }), 'forward path ', h('span', { class: 'sw back' }), 'return path'),
        strip('Input', [...ctx.letters].map((c, i) => ({ t: c, cls: i === step.pos ? 'hl' : i < step.pos ? 'done' : '' })), 'wrap'),
        strip('Output', [...ctx.letters].map((_, i) => ({ t: step.out[i] || '', cls: i === step.out.length - 1 && step.press ? 'dst new' : i >= step.out.length ? 'empty' : '' })), 'wrap')),
    );
  },
};
