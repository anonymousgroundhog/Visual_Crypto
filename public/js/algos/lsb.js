import { h, table, kbd, note, math, strip, esc } from '../core/render.js';
import { embed, extract, capacityBytes, channelOffset } from '../crypto/lsb.js';
import { utf8, fromUtf8, toBin, toHex } from '../crypto/bits.js';

const DETAIL_BYTES = 4;
const CH = ['R', 'G', 'B'];
let lastStego = null;

function makeCanvas(w, hgt) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  return c;
}

/** A small procedurally drawn landscape so there is always a carrier image. */
function sampleImage() {
  const c = makeCanvas(120, 80);
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 80);
  sky.addColorStop(0, '#2b5fa8');
  sky.addColorStop(1, '#f3b57a');
  g.fillStyle = sky;
  g.fillRect(0, 0, 120, 80);
  g.fillStyle = '#ffd95a';
  g.beginPath();
  g.arc(86, 30, 11, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3b6b3a';
  g.beginPath();
  g.moveTo(0, 62);
  g.quadraticCurveTo(30, 40, 62, 60);
  g.quadraticCurveTo(92, 44, 120, 58);
  g.lineTo(120, 80);
  g.lineTo(0, 80);
  g.fill();
  g.fillStyle = '#2a4d2a';
  g.fillRect(0, 70, 120, 10);
  // Clear every LSB so the sample's LSB plane starts black and the payload stands out.
  const data = g.getImageData(0, 0, 120, 80);
  for (let i = 0; i < data.data.length; i++) if (i % 4 !== 3) data.data[i] &= 0xfe;
  return data;
}

async function fileImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that image file.'));
      i.src = url;
    });
    const scale = Math.min(1, 200 / img.width, 200 / img.height);
    const w = Math.max(1, Math.round(img.width * scale));
    const hgt = Math.max(1, Math.round(img.height * scale));
    const c = makeCanvas(w, hgt);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, w, hgt);
    return g.getImageData(0, 0, w, hgt);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toURL(pixels, w, hgt) {
  const c = makeCanvas(w, hgt);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels), w, hgt), 0, 0);
  return c.toDataURL('image/png');
}

function diffMap(a, b) {
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i += 4) {
    const changed = a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2];
    out.set(changed ? [248, 81, 73, 255] : [a[i] / 4, a[i + 1] / 4, a[i + 2] / 4, 255], i);
  }
  return out;
}

function lsbPlane(pixels) {
  const out = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    for (let k = 0; k < 3; k++) out[i + k] = (pixels[i + k] & 1) * 255;
    out[i + 3] = 255;
  }
  return out;
}

const img = (src, label, cls = '') => h('figure', { class: `stego-fig ${cls}` }, h('img', { src, alt: label }), h('figcaption', {}, label));

function pixelSwatches(before, after, from, count) {
  const out = [];
  for (let p = from; p < from + count; p++) {
    const i = p * 4;
    out.push(h('div', { class: 'px-pair' },
      h('div', { class: 'px', style: { background: `rgb(${before[i]},${before[i + 1]},${before[i + 2]})` } }),
      h('div', { class: 'px', style: { background: `rgb(${after[i]},${after[i + 1]},${after[i + 2]})` } }),
      h('small', {}, `px ${p}`)));
  }
  return h('div', { class: 'px-row' }, h('div', { class: 'px-legend' }, h('small', {}, 'before'), h('small', {}, 'after')), out);
}

export default {
  id: 'lsb',
  title: 'LSB Steganography',
  slides: '6–8, 15–18',
  category: 'Steganography',
  blurb: 'Hide a message in the least significant bits of an image — invisible to the eye.',
  about: `<p><b>Steganography</b> hides that a message exists at all. The most common method is changing the <b>least significant bit (LSB)</b> of each colour byte: 11111111 (255) → 11111110 (254) is a change nobody can see.</p>
<p>Each pixel has three bytes (R, G, B), so a pixel hides 3 bits. The <i>payload</i> is the message; the <i>carrier</i> is the image. If an LSB already equals the payload bit, nothing changes at all.</p>
<p><b>Steganalysis:</b> only a bit-by-bit comparison with the original reveals it. Look at the amplified LSB planes at the end — the hidden data shows up as noise in the top rows. Chi-square tests and close-colour-pair counts detect exactly this. <span class="ref">Ch. 5 slides 6–8, 15–18</span></p>`,
  inputs: [
    { id: 'message', label: 'Secret message', type: 'textarea', value: 'Meet at noon', rows: 2 },
    { id: 'carrier', label: 'Carrier image', type: 'select', value: 'sample', options: [['sample', 'Built-in sample'], ['upload', 'Upload my own…']] },
    { id: 'file', label: 'Image file', type: 'file', accept: 'image/*', when: (v) => v.carrier === 'upload', help: 'Large images are scaled down to 200 px. To extract later, use the PNG you download here.' },
  ],
  actions: [{ id: 'hide', label: 'Hide message' }, { id: 'extract', label: 'Extract message' }],
  code: {
    hide: [
      'bits = bytes of the message + a 0x00 terminator',
      'for each payload bit, in order:',
      '  pick the next colour byte (R, G, B, skip alpha)',
      '  byte = (byte AND 11111110) OR bit     // replace the LSB',
      'save the image (PNG — lossless!)',
    ],
    extract: [
      'for each colour byte (R, G, B, skip alpha):',
      '  collect its LSB',
      '  every 8 bits make one byte',
      '  stop at a 0x00 byte',
    ],
  },
  async generate(action, v) {
    let carrier;
    if (action === 'extract' && lastStego && v.carrier !== 'upload') carrier = lastStego;
    else if (v.carrier === 'upload') {
      if (!v.file) throw new Error('Choose an image file first.');
      carrier = await fileImage(v.file);
    } else carrier = sampleImage();
    const { width: w, height: hgt } = carrier;
    const px = carrier.data;

    if (action === 'extract') {
      const { bytes, terminated } = extract(px);
      const steps = [];
      for (let b = 0; b < Math.min(DETAIL_BYTES, bytes.length + 1); b++) {
        const reads = Array.from({ length: 8 }, (_, j) => { const off = channelOffset(b * 8 + j); return { off, val: px[off], bit: px[off] & 1 }; });
        const val = reads.reduce((a, r) => (a << 1) | r.bit, 0);
        steps.push({ kind: 'read', reads, val, line: [0, 1, 2], msg: `Bits ${b * 8}–${b * 8 + 7}: ${reads.map((r) => r.bit).join('')} = ${toHex(val)}${val ? ` = ${kbd(esc(String.fromCharCode(val)))}` : ' → terminator, stop.'}` });
      }
      const text = fromUtf8(bytes);
      steps.push({ kind: 'found', text, url: toURL(px, w, hgt), plane: toURL(lsbPlane(px), w, hgt), line: 3, msg: terminated ? `Recovered message: ${kbd(text)}` : 'No terminator found — this image probably holds no message (the LSBs are just image noise).' });
      return { steps, ctx: { w, hgt } };
    }

    const payload = utf8(v.message);
    if (!payload.length) throw new Error('Enter a message to hide.');
    if (payload.length > capacityBytes(px)) throw new Error(`This image can hold ${capacityBytes(px)} bytes; the message is ${payload.length}.`);
    const { pixels, writes } = embed(px, payload);
    lastStego = new ImageData(new Uint8ClampedArray(pixels), w, hgt);
    const all = [...payload, 0];
    const changed = writes.filter((x) => x.before !== x.after).length;
    const steps = [{ kind: 'bits', all, line: 0, msg: `${payload.length} byte${payload.length > 1 ? 's' : ''} + terminator = ${all.length * 8} bits to hide. The image has ${w}×${hgt} pixels → room for ${capacityBytes(px)} bytes.` }];
    for (let b = 0; b < Math.min(DETAIL_BYTES, all.length); b++) {
      const ws = writes.slice(b * 8, b * 8 + 8);
      const label = all[b] ? `${kbd(esc(String.fromCharCode(all[b])))} (${toBin(all[b])})` : 'the 0x00 terminator';
      steps.push({ kind: 'write', b, ws, line: [1, 2, 3], msg: `Hide ${label} in 8 colour bytes. ${ws.filter((x) => x.before !== x.after).length} of them actually change, each by exactly 1.` });
    }
    if (all.length > DETAIL_BYTES) steps.push({ kind: 'bits', all, upto: DETAIL_BYTES, line: [1, 2, 3], msg: `…the remaining ${all.length - DETAIL_BYTES} bytes are written the same way.` });
    steps.push({
      kind: 'done', line: 4,
      orig: toURL(px, w, hgt), stego: toURL(pixels, w, hgt), pOrig: toURL(lsbPlane(px), w, hgt), pStego: toURL(lsbPlane(pixels), w, hgt), diff: toURL(diffMap(px, pixels), w, hgt), sample: v.carrier !== 'upload',
      changed, total: writes.length,
      msg: `Done. Only ${changed} of ${(px.length / 4) * 3} colour bytes changed, each by ±1. The images look identical; the amplified LSB planes give it away. Press <b>Extract message</b> to read it back.`,
    });
    return { steps, ctx: { w, hgt, px, pixels, all } };
  },
  render(step, stage, ctx) {
    const parts = [];
    if (step.kind === 'bits') {
      parts.push(strip('Payload', step.all.map((b, i) => ({ t: b ? String.fromCharCode(b) : '∅', sub: toBin(b), cls: step.upto != null && i < step.upto ? 'done' : step.upto != null ? 'hl' : '' })), 'wrap payload'));
    } else if (step.kind === 'write') {
      const firstPx = Math.floor(step.ws[0].off / 4);
      const lastPx = Math.floor(step.ws[7].off / 4);
      parts.push(table(['pixel', 'channel', 'original byte', 'payload bit', 'new byte', ''], step.ws.map((x) => [
        Math.floor(x.off / 4), CH[x.off % 4],
        h('code', { html: `${toBin(x.before).slice(0, 7)}<b class="lsb">${x.before & 1}</b> (${x.before})` }),
        h('b', {}, x.bit),
        h('code', { html: `${toBin(x.after).slice(0, 7)}<b class="lsb ${x.before !== x.after ? 'flip' : ''}">${x.after & 1}</b> (${x.after})` }),
        x.before === x.after ? 'no change' : '±1',
      ]), { compact: true, rowCls: (i) => (step.ws[i].before !== step.ws[i].after ? 'changed' : '') }));
      parts.push(pixelSwatches(ctx.px, ctx.pixels, firstPx, lastPx - firstPx + 1), note('Can you see a difference between the before and after colours? Neither can anyone else.'));
    } else if (step.kind === 'done') {
      parts.push(h('div', { class: 'stego-grid' }, img(step.orig, 'Original'), img(step.stego, 'With hidden message'), img(step.pOrig, 'LSB plane ×255 (original)', 'plane'), img(step.pStego, 'LSB plane ×255 (stego)', 'plane'), img(step.diff, 'Changed pixels (red)', 'plane')),
        step.sample && note('The built-in sample was prepared with every LSB = 0, so its LSB plane is black and the payload appears as a coloured band at the top. Real photos have noisy LSBs that hide the payload much better — try uploading one.'),
        math(`${step.total} payload bits → <b>${step.changed}</b> bytes changed (bits that already matched cost nothing)`),
        h('a', { class: 'btn primary', href: step.stego, download: 'visualcrypto-stego.png' }, '⬇ Download stego PNG'));
    } else if (step.kind === 'read') {
      parts.push(table(['byte offset', 'channel', 'value', 'LSB'], step.reads.map((r) => [r.off, CH[r.off % 4], h('code', { html: `${toBin(r.val).slice(0, 7)}<b class="lsb">${r.bit}</b>` }), h('b', {}, r.bit)]), { compact: true }),
        math(`${step.reads.map((r) => r.bit).join('')} = 0x${toHex(step.val)}`));
    } else if (step.kind === 'found') {
      parts.push(h('div', { class: 'stego-grid' }, img(step.url, 'Carrier image'), img(step.plane, 'Its LSB plane', 'plane')), math(`Message: <b class="k">${esc(step.text) || '(none)'}</b>`));
    }
    stage.append(h('div', { class: 'col' }, parts));
  },
};
