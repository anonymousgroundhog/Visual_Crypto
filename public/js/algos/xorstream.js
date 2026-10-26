import { h, bitRow, strip, kbd, esc } from '../core/render.js';
import { bytesToHex, hexToBytes, toBin, toHex, utf8, fromUtf8, bytesToBits } from '../crypto/bits.js';

export default {
  id: 'xorstream',
  title: 'XOR Stream Cipher',
  slides: '38–39',
  category: 'Symmetric ciphers',
  blurb: 'XOR every byte of a message with a repeating key — and XOR again to decrypt.',
  about: `<p>A <b>stream cipher</b> encrypts data a little at a time by XOR-ing it with a <i>keystream</i>. Here the keystream is just your key repeated, which is weak (a short repeating key falls to the same Kasiski-style attacks as Vigenère), but it shows the mechanism.</p>
<p>Real stream ciphers (e.g. ChaCha20) generate a long pseudo-random keystream from the key. If the keystream is truly random and never reused, this is a <b>one-time pad</b> — provably unbreakable. <span class="ref">Ch. 5 slides 38–39</span></p>`,
  inputs: [
    { id: 'text', label: 'Plaintext (for Encrypt)', type: 'textarea', value: 'HI THERE', rows: 2 },
    { id: 'cipher', label: 'Ciphertext hex (for Decrypt)', type: 'text', value: '030C791F0D1C1900' },
    { id: 'key', label: 'Key (text)', type: 'text', value: 'KEY' },
  ],
  actions: [{ id: 'encrypt', label: 'Encrypt' }, { id: 'decrypt', label: 'Decrypt' }],
  code: [
    'convert text and key to bytes',
    'for each byte i of the data:',
    '  k = key[i mod len(key)]',
    '  out[i] = data[i] XOR k',
    'encrypt → show as hex;  decrypt → show as text',
  ],
  generate(action, v) {
    const key = utf8(v.key);
    if (!key.length) throw new Error('Key cannot be empty.');
    const decrypt = action === 'decrypt';
    const data = decrypt ? hexToBytes(v.cipher) : utf8(v.text);
    if (!data.length) throw new Error('Please enter some data.');
    if (data.length > 48) throw new Error('Please keep the data under 48 bytes.');
    const out = data.map((b, i) => b ^ key[i % key.length]);
    const steps = [{ line: 0, i: -1, msg: `${decrypt ? 'Ciphertext' : 'Plaintext'} is ${data.length} bytes; key ${kbd(v.key)} is ${key.length} bytes and repeats.` }];
    for (let i = 0; i < data.length; i++) {
      const k = key[i % key.length];
      steps.push({ line: [2, 3], i, msg: `Byte ${i}: ${toHex(data[i])} ⊕ ${toHex(k)} = ${kbd(toHex(out[i]))}${decrypt ? ` → ${kbd(esc(String.fromCharCode(out[i])))}` : ''}` });
    }
    const result = decrypt ? fromUtf8(out) : bytesToHex(out);
    steps.push({ line: 4, i: data.length, msg: `${decrypt ? 'Plaintext' : 'Ciphertext (hex)'}: ${kbd(result)}${decrypt ? '' : '. Paste this hex into the ciphertext field and press Decrypt to reverse it.'}` });
    return { steps, ctx: { data, key, out, decrypt } };
  },
  render(step, stage, ctx) {
    const { data, key, out, decrypt } = ctx;
    const ch = (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·');
    const i = Math.min(step.i, data.length - 1);
    const kb = (j) => key[j % key.length];
    stage.append(
      h('div', { class: 'col' },
        strip(decrypt ? 'Cipher' : 'Data', [...data].map((b, j) => ({ t: decrypt ? toHex(b) : ch(b), sub: decrypt ? null : toHex(b), cls: j === step.i ? 'hl' : j < step.i ? 'done' : '' })), 'wrap'),
        strip('Key', [...data].map((_, j) => ({ t: ch(kb(j)), sub: toHex(kb(j)), cls: j === step.i ? 'src' : '' })), 'wrap'),
        strip(decrypt ? 'Plain' : 'Cipher', [...data].map((_, j) => ({ t: j < step.i || (j === step.i) ? (decrypt ? ch(out[j]) : toHex(out[j])) : '', cls: j === step.i ? 'dst new' : j > step.i ? 'empty' : '' })), 'wrap'),
        step.i >= 0 && step.i < data.length && h('div', { class: 'col xor-detail' },
          bitRow(`data ${toHex(data[i])}`, [...toBin(data[i])].map(Number), { hex: false }),
          bitRow(`key  ${toHex(kb(i))}`, [...toBin(kb(i))].map(Number), { hex: false }),
          h('div', { class: 'rule-line' }, 'XOR'),
          bitRow(`out  ${toHex(out[i])}`, [...toBin(out[i])].map(Number), { hex: false, clsFn: (j) => (data[i] >> (7 - j) & 1) !== (out[i] >> (7 - j) & 1) ? 'flip' : '' })),
        step.i >= data.length && bitRow('All output bits', bytesToBits(out), { group: 8 })),
    );
  },
};
