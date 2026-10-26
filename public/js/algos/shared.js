// Pieces reused by several of the letter-cipher visualizations.
import { h, s, strip } from '../core/render.js';
import { ALPHA } from '../crypto/classical.js';

export const MAX_CHARS = 400;

export function checkLength(text, max = MAX_CHARS) {
  if (!text.length) throw new Error('Please enter some text.');
  if (text.length > max) throw new Error(`Please keep the text under ${max} characters so the animation stays watchable.`);
}

/** Input and output strips with the current character highlighted. */
export function ioStrips(input, output, pos, { inLabel = 'Input', outLabel = 'Output', sub } = {}) {
  const inItems = [...input].map((c, i) => ({ t: c === ' ' ? '␣' : c, cls: `${i === pos ? 'hl' : i < pos ? 'done' : ''} ${/[A-Za-z]/.test(c) ? '' : 'dim'}`, sub: sub?.(i) }));
  const outItems = [...input].map((c, i) => ({ t: i < output.length ? (output[i] === ' ' ? '␣' : output[i]) : '', cls: `${i === pos ? 'dst new' : ''} ${i >= output.length ? 'empty' : ''}` }));
  return h('div', { class: 'io' }, strip(inLabel, inItems, 'wrap'), strip(outLabel, outItems, 'wrap'));
}

/** Cipher wheel: outer ring = plaintext alphabet, inner ring = shifted alphabet. */
export function cipherWheel(shift, highlight = -1, { size = 320 } = {}) {
  const c = size / 2;
  const ang = (i) => ((-90 + (i * 360) / 26) * Math.PI) / 180;
  const at = (i, r) => [c + r * Math.cos(ang(i)), c + r * Math.sin(ang(i))];
  const kids = [
    s('circle', { cx: c, cy: c, r: c - 6, class: 'wheel-outer' }),
    s('circle', { cx: c, cy: c, r: c - 52, class: 'wheel-inner' }),
    s('circle', { cx: c, cy: c, r: c - 96, class: 'wheel-hub' }),
  ];
  if (highlight >= 0) {
    // Wedge spanning the highlighted letter on both rings.
    const [ax, ay] = at(highlight - 0.5, c - 6);
    const [bx, by] = at(highlight + 0.5, c - 6);
    const [cx2, cy2] = at(highlight + 0.5, c - 96);
    const [dx, dy] = at(highlight - 0.5, c - 96);
    kids.push(s('path', { d: `M${ax},${ay} A${c - 6},${c - 6} 0 0 1 ${bx},${by} L${cx2},${cy2} A${c - 96},${c - 96} 0 0 0 ${dx},${dy} Z`, class: 'wheel-wedge' }));
  }
  for (let i = 0; i < 26; i++) {
    const [x1, y1] = at(i + 0.5, c - 6);
    const [x2, y2] = at(i + 0.5, c - 96);
    kids.push(s('line', { x1, y1, x2, y2, class: 'wheel-spoke' }));
  }
  for (let i = 0; i < 26; i++) {
    const on = i === highlight;
    const [ox, oy] = at(i, c - 29);
    const [ix, iy] = at(i, c - 74);
    kids.push(
      s('text', { x: ox, y: oy, class: `wheel-letter outer ${on ? 'on' : ''}` }, ALPHA[i]),
      s('text', { x: ix, y: iy, class: `wheel-letter inner ${on ? 'on' : ''}` }, ALPHA[(i + shift + 26 * 10) % 26]),
    );
  }
  kids.push(
    s('text', { x: c, y: c - 6, class: 'wheel-center' }, `shift`),
    s('text', { x: c, y: c + 22, class: 'wheel-center big' }, `${shift >= 0 ? '+' : ''}${shift}`),
  );
  return s('svg', { viewBox: `0 0 ${size} ${size}`, class: 'wheel', role: 'img', 'aria-label': `Cipher wheel with shift ${shift}` }, kids);
}

/** Fixed-order alphabet strip with one index highlighted. */
export const alphaStrip = (label, letters, hi, cls = 'hl') =>
  strip(label, [...letters].map((ch, i) => ({ t: ch, cls: i === hi ? cls : '', sub: i })));
