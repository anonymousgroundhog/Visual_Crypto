// AES / Rijndael (FIPS 197) with a step trace (slides 44-45).
// The state is a flat 16-byte array in input order: index = row + 4*col.

const rotl8 = (x, s) => ((x << s) | (x >> (8 - s))) & 0xff;

export const SBOX = new Uint8Array(256);
export const INV_SBOX = new Uint8Array(256);
(function buildSbox() {
  let p = 1;
  let q = 1;
  do {
    p = p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0);
    q ^= q << 1;
    q ^= q << 2;
    q ^= q << 4;
    q &= 0xff;
    if (q & 0x80) q ^= 0x09;
    const x = q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4);
    SBOX[p] = x ^ 0x63;
  } while (p !== 1);
  SBOX[0] = 0x63;
  for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;
})();

export function gmul(a, b) {
  let r = 0;
  while (b) {
    if (b & 1) r ^= a;
    a = (a << 1) ^ (a & 0x80 ? 0x11b : 0);
    b >>= 1;
  }
  return r & 0xff;
}

export const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d];
export const MIX = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]];
export const INV_MIX = [[14, 11, 13, 9], [9, 14, 11, 13], [13, 9, 14, 11], [11, 13, 9, 14]];

export function expandKey(key) {
  const Nk = key.length / 4;
  if (![4, 6, 8].includes(Nk)) throw new Error('AES key must be 16, 24 or 32 bytes (32, 48 or 64 hex digits)');
  const Nr = Nk + 6;
  const words = [];
  const details = [];
  for (let i = 0; i < Nk; i++) words.push([...key.slice(4 * i, 4 * i + 4)]);
  for (let i = Nk; i < 4 * (Nr + 1); i++) {
    let temp = [...words[i - 1]];
    const d = { i, prev: [...temp], back: words[i - Nk] };
    if (i % Nk === 0) {
      d.rot = [temp[1], temp[2], temp[3], temp[0]];
      d.sub = d.rot.map((b) => SBOX[b]);
      d.rcon = RCON[i / Nk];
      temp = [d.sub[0] ^ d.rcon, d.sub[1], d.sub[2], d.sub[3]];
    } else if (Nk > 6 && i % Nk === 4) {
      d.sub = temp.map((b) => SBOX[b]);
      temp = d.sub;
    }
    const w = words[i - Nk].map((b, j) => b ^ temp[j]);
    d.temp = temp;
    d.word = w;
    words.push(w);
    details.push(d);
  }
  const roundKeys = [];
  for (let r = 0; r <= Nr; r++) roundKeys.push(words.slice(4 * r, 4 * r + 4).flat());
  return { Nk, Nr, words, details, roundKeys };
}

export const subBytes = (s, inv = false) => s.map((b) => (inv ? INV_SBOX : SBOX)[b]);

export function shiftRows(s, inv = false) {
  const out = Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (inv) out[r + 4 * ((c + r) % 4)] = s[r + 4 * c];
      else out[r + 4 * c] = s[r + 4 * ((c + r) % 4)];
    }
  }
  return out;
}

export function mixColumns(s, inv = false) {
  const M = inv ? INV_MIX : MIX;
  const out = Array(16);
  for (let c = 0; c < 4; c++) {
    const col = s.slice(4 * c, 4 * c + 4);
    for (let r = 0; r < 4; r++) {
      out[r + 4 * c] = M[r].reduce((acc, m, k) => acc ^ gmul(m, col[k]), 0);
    }
  }
  return out;
}

export const addRoundKey = (s, k) => s.map((b, i) => b ^ k[i]);

/** Encrypt or decrypt one block; returns { ops, out, schedule } where ops are the visual steps. */
export function aesTrace(block, key, decrypt = false) {
  const schedule = expandKey(key);
  const { Nr, roundKeys } = schedule;
  const ops = [];
  let s = [...block];
  const apply = (round, op, fn, extra = {}) => {
    const before = s;
    s = fn(s);
    ops.push({ round, op, before, after: s, ...extra });
  };

  if (!decrypt) {
    apply(0, 'AddRoundKey', (x) => addRoundKey(x, roundKeys[0]), { key: roundKeys[0] });
    for (let r = 1; r <= Nr; r++) {
      apply(r, 'SubBytes', (x) => subBytes(x));
      apply(r, 'ShiftRows', (x) => shiftRows(x));
      if (r !== Nr) apply(r, 'MixColumns', (x) => mixColumns(x));
      apply(r, 'AddRoundKey', (x) => addRoundKey(x, roundKeys[r]), { key: roundKeys[r] });
    }
  } else {
    apply(0, 'AddRoundKey', (x) => addRoundKey(x, roundKeys[Nr]), { key: roundKeys[Nr], keyIndex: Nr });
    for (let r = 1; r <= Nr; r++) {
      const k = Nr - r;
      apply(r, 'InvShiftRows', (x) => shiftRows(x, true));
      apply(r, 'InvSubBytes', (x) => subBytes(x, true));
      apply(r, 'AddRoundKey', (x) => addRoundKey(x, roundKeys[k]), { key: roundKeys[k], keyIndex: k });
      if (r !== Nr) apply(r, 'InvMixColumns', (x) => mixColumns(x, true));
    }
  }
  return { ops, out: s, schedule };
}
