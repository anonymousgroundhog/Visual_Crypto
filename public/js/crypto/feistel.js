// A toy 16-bit Feistel cipher (slide 40): 8-bit halves, 4-bit S-box round function.
// Small enough to follow by hand; the structure is the same one DES uses.

export const SBOX4 = [0xe, 0x4, 0xd, 0x1, 0x2, 0xf, 0xb, 0x8, 0x3, 0xa, 0x6, 0xc, 0x5, 0x9, 0x0, 0x7];

const rotl8 = (x, n) => ((x << n) | (x >> (8 - n))) & 0xff;
const rotl16 = (x, n) => ((x << n) | (x >>> (16 - n))) & 0xffff;

/** Round key i is the high byte of the 16-bit key rotated left by 3*i. */
export const roundKeys = (key, rounds) => Array.from({ length: rounds }, (_, i) => rotl16(key, 3 * i) >> 8);

/** F(R, K) = rotl1( S(hi) || S(lo) ) of (R xor K). */
export function F(R, K) {
  const x = R ^ K;
  const s = (SBOX4[x >> 4] << 4) | SBOX4[x & 0xf];
  return { x, s, out: rotl8(s, 1) };
}

export function feistelTrace(block, key, rounds = 4, decrypt = false) {
  const keys = roundKeys(key, rounds);
  const order = decrypt ? [...keys].reverse() : keys;
  let L = block >> 8;
  let R = block & 0xff;
  const steps = [];
  order.forEach((K, i) => {
    const f = F(R, K);
    const newR = L ^ f.out;
    steps.push({ n: i + 1, L, R, K, f, newL: R, newR });
    [L, R] = [R, newR];
  });
  // Undo the last swap so that decryption is the same network with reversed keys.
  return { keys: order, steps, out: (R << 8) | L };
}
