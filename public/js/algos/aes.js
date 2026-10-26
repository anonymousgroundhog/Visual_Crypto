import { h, byteGrid, strip, table, kbd, op, note, math } from '../core/render.js';
import { aesTrace, SBOX, INV_SBOX, MIX, INV_MIX, gmul } from '../crypto/aes.js';
import { bytesToHex, parseBlock, printable, toHex } from '../crypto/bits.js';

const hx = (b) => toHex(b);
const word = (w) => w.map(hx).join('');

const EXPLAIN = {
  AddRoundKey: 'AddRoundKey: XOR every state byte with the matching round-key byte. This is the only step that uses the key.',
  SubBytes: 'SubBytes: replace each byte with its entry in the Rijndael S-box (high nibble = row, low nibble = column). This is the non-linear step.',
  ShiftRows: 'ShiftRows: row 0 stays, row 1 shifts left by 1, row 2 by 2, row 3 by 3. Bytes from one column spread across four columns.',
  MixColumns: 'MixColumns: each column is multiplied by a fixed matrix in GF(2⁸). Every output byte depends on all four input bytes of its column.',
  InvShiftRows: 'InvShiftRows: undo ShiftRows — row r shifts right by r.',
  InvSubBytes: 'InvSubBytes: look each byte up in the inverse S-box.',
  InvMixColumns: 'InvMixColumns: multiply each column by the inverse matrix (14, 11, 13, 9).',
};

function sboxTable(state, inv, focus) {
  const box = inv ? INV_SBOX : SBOX;
  const used = new Set(state);
  const fb = state[focus];
  const cells = [h('div', { class: 'sx-head' }, '')];
  for (let c = 0; c < 16; c++) cells.push(h('div', { class: `sx-head ${c === (fb & 15) ? 'on' : ''}` }, c.toString(16).toUpperCase()));
  for (let r = 0; r < 16; r++) {
    cells.push(h('div', { class: `sx-head ${r === fb >> 4 ? 'on' : ''}` }, r.toString(16).toUpperCase()));
    for (let c = 0; c < 16; c++) {
      const i = r * 16 + c;
      cells.push(h('div', { class: `sx-cell ${i === fb ? 'hit' : used.has(i) ? 'used' : ''}` }, hx(box[i])));
    }
  }
  return h('div', { class: 'col' }, h('div', { class: 'grid-label' }, `${inv ? 'Inverse S-box' : 'S-box'} — ${hx(fb)} → row ${(fb >> 4).toString(16).toUpperCase()}, col ${(fb & 15).toString(16).toUpperCase()} → ${hx(box[fb])}`), h('div', { class: 'sbox16' }, cells));
}

function mixDetail(before, after, inv) {
  const M = inv ? INV_MIX : MIX;
  const col = before.slice(0, 4);
  const lines = M.map((rowM, r) => `${rowM.map((m, k) => `${m}·${hx(col[k])}`).join(' ⊕ ')} = ${rowM.map((m, k) => hx(gmul(m, col[k]))).join(' ⊕ ')} = <b>${hx(after[r])}</b>`);
  return math(`Column 0:<br>${lines.join('<br>')}`);
}

export default {
  id: 'aes',
  title: 'AES (Rijndael)',
  slides: '44–45',
  category: 'Symmetric ciphers',
  blurb: 'The Advanced Encryption Standard: SubBytes, ShiftRows, MixColumns, AddRoundKey on a 4×4 state.',
  about: `<p><b>Rijndael</b> by Joan Daemen and Vincent Rijmen won a 5-year, 15-candidate contest and became AES (FIPS 197) in 2001.</p>
<ul><li>Block: 128 bits. Keys: 128, 192 or 256 bits → 10, 12 or 14 rounds.</li>
<li><b>Not</b> a Feistel cipher: a substitution–permutation network on a 4 × 4 byte matrix called the <i>state</i> (filled column by column).</li>
<li>Initial AddRoundKey; each round SubBytes → ShiftRows → MixColumns → AddRoundKey; the final round skips MixColumns.</li></ul>
<p>Byte colours are a hash of the value, so you can watch a single change <b>diffuse</b> across the whole state within two rounds. NSA approves AES-256 for Top Secret data. <span class="ref">Ch. 5 slides 44–45</span></p>
<p>Default inputs are the FIPS-197 test vector (output <code>69C4E0D8…C55A</code>).</p>`,
  inputs: [
    { id: 'format', label: 'Block format', type: 'select', value: 'hex', options: [['hex', 'Hex (32 digits)'], ['text', 'Text (≤ 16 chars)']] },
    { id: 'block', label: 'Block', type: 'text', value: '00112233445566778899AABBCCDDEEFF' },
    { id: 'key', label: 'Key (32, 48 or 64 hex digits)', type: 'text', value: '000102030405060708090A0B0C0D0E0F' },
  ],
  actions: [{ id: 'encrypt', label: 'Encrypt' }, { id: 'decrypt', label: 'Decrypt' }],
  random: () => ({ format: 'hex', block: [...crypto.getRandomValues(new Uint8Array(16))].map(hx).join(''), key: [...crypto.getRandomValues(new Uint8Array(16))].map(hx).join('') }),
  code: {
    encrypt: [
      'w = KeyExpansion(key)',
      'state = block (column by column)',
      'AddRoundKey(state, w[0])',
      'for round = 1 … Nr−1:',
      '  SubBytes(state)',
      '  ShiftRows(state)',
      '  MixColumns(state)',
      '  AddRoundKey(state, w[round])',
      'SubBytes; ShiftRows; AddRoundKey(state, w[Nr])   // final round',
    ],
    decrypt: [
      'w = KeyExpansion(key)',
      'state = block (column by column)',
      'AddRoundKey(state, w[Nr])',
      'for round = Nr−1 … 1:',
      '  InvShiftRows(state)',
      '  InvSubBytes(state)',
      '  AddRoundKey(state, w[round])',
      '  InvMixColumns(state)',
      'InvShiftRows; InvSubBytes; AddRoundKey(state, w[0])',
    ],
  },
  generate(action, v) {
    const decrypt = action === 'decrypt';
    const block = parseBlock(v.block, decrypt ? 'hex' : v.format, 16, 'Block');
    const key = parseBlock(v.key, 'hex', String(v.key).replace(/\s/g, '').length / 2, 'Key');
    const t = aesTrace(block, key, decrypt);
    const { Nr, Nk } = t.schedule;
    const steps = [];
    steps.push({ kind: 'input', line: 1, round: -1, msg: `The 16 input bytes fill the 4 × 4 state <b>column by column</b>. AES-${Nk * 32}: ${Nr} rounds.` });
    steps.push({ kind: 'keys', line: 0, round: -1, msg: `Key expansion turns the ${Nk * 4}-byte key into ${Nr + 1} round keys (${4 * (Nr + 1)} words). Every ${Nk}th word goes through RotWord → SubWord → ⊕ Rcon.`, dwell: 1.5 });
    const lineOf = (o) => {
      const last = o.round === Nr;
      if (o.round === 0) return 2;
      if (last) return 8;
      const order = decrypt ? ['InvShiftRows', 'InvSubBytes', 'AddRoundKey', 'InvMixColumns'] : ['SubBytes', 'ShiftRows', 'MixColumns', 'AddRoundKey'];
      return [3, 4 + order.indexOf(o.op)];
    };
    for (const o of t.ops) {
      const label = o.round === 0 ? 'Initial round' : o.round === Nr ? `Final round ${Nr}` : `Round ${o.round}`;
      steps.push({ kind: 'op', o, round: o.round, line: lineOf(o), msg: `<b>${label}</b> — ${EXPLAIN[o.op]}${o.round === Nr && o.op === (decrypt ? 'InvSubBytes' : 'ShiftRows') ? ' (No MixColumns in the final round.)' : ''}` });
    }
    steps.push({ kind: 'output', line: null, round: Nr + 1, msg: `${decrypt ? 'Plaintext' : 'Ciphertext'}: ${kbd(bytesToHex(t.out))}${decrypt ? ` (text "${printable(t.out)}")` : ''}. Read the state column by column.` });
    return { steps, ctx: { t, block, decrypt } };
  },
  render(step, stage, ctx) {
    const { t } = ctx;
    const { Nr } = t.schedule;
    const rounds = strip('Round', Array.from({ length: Nr + 1 }, (_, i) => ({ t: i, cls: i === step.round ? 'hl' : i < step.round ? 'done' : '' })), 'rounds');
    const parts = [rounds];
    if (step.kind === 'input') {
      parts.push(h('div', { class: 'row center' },
        strip('Input bytes', [...ctx.block].map((b, i) => ({ t: hx(b), sub: i, cls: i % 4 === 0 ? 'src' : '' })), 'wrap'),
        byteGrid('State', [...ctx.block], { clsFn: (i) => 'new' })));
      parts.push(note('Byte 0 → row 0 col 0, byte 1 → row 1 col 0, … byte 4 → row 0 col 1. Index = row + 4 × column.'));
    } else if (step.kind === 'keys') {
      const { roundKeys, details } = t.schedule;
      const d = details[0];
      parts.push(h('div', { class: 'row' },
        table(['Round', 'Round key (4 words)'], roundKeys.map((k, i) => [i, h('code', {}, k.map(hx).join('').replace(/(.{8})/g, '$1 '))]), { compact: true }),
        h('div', { class: 'col' },
          h('div', { class: 'grid-label' }, `How w[${d.i}] is made`),
          math(`w[${d.i - 1}] = ${word(d.prev)}<br>RotWord → ${word(d.rot)}<br>SubWord → ${word(d.sub)}<br>⊕ Rcon ${hx(d.rcon)}000000 → ${word(d.temp)}<br>⊕ w[${d.i - t.schedule.Nk}] ${word(d.back)}<br>= <b class="k">${word(d.word)}</b>`),
          note(`Other words: w[i] = w[i−1] ⊕ w[i−${t.schedule.Nk}].`))));
    } else if (step.kind === 'op') {
      const { o } = step;
      const changed = (i) => (o.before[i] !== o.after[i] ? 'changed' : '');
      const shifting = o.op.includes('ShiftRows');
      const grids = [byteGrid('Before', o.before, { clsFn: shifting ? (i, r, c) => `fromc${c}` : () => '' })];
      if (o.op === 'AddRoundKey') grids.push(op('⊕'), byteGrid(`Round key ${o.keyIndex ?? o.round}`, o.key, { clsFn: () => 'key' }));
      else grids.push(op(o.op.includes('Shift') ? '⇆' : o.op.includes('Sub') ? 'S' : '×M'));
      const fromCol = (r, c) => (o.op === 'ShiftRows' ? (c + r) % 4 : (c - r + 4) % 4);
      const rowCls = shifting ? (i, r, c) => `fromc${fromCol(r, c)}` : o.op.includes('MixColumns') ? (i, r, c) => (c === 0 ? 'focus' : '') : (i) => changed(i);
      grids.push(op('='), byteGrid('After', o.after, { clsFn: rowCls }));
      parts.push(h('div', { class: 'row center' }, grids));
      if (o.op.includes('SubBytes')) parts.push(sboxTable(o.before, o.op === 'InvSubBytes', 0));
      if (o.op.includes('ShiftRows')) parts.push(note(`Colours mark each byte's original column: after the shift, every column holds one byte from each of the four original columns. Row r rotates ${o.op === 'ShiftRows' ? 'left' : 'right'} by r.`));
      if (o.op.includes('MixColumns')) parts.push(mixDetail(o.before, o.after, o.op === 'InvMixColumns'));
    } else {
      parts.push(h('div', { class: 'row center' }, byteGrid(ctx.decrypt ? 'Plaintext state' : 'Ciphertext state', t.out), math(`<b class="k">${bytesToHex(t.out)}</b>`)));
    }
    stage.append(h('div', { class: 'col' }, parts));
  },
};
