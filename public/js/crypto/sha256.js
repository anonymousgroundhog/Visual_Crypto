// SHA-256 (FIPS 180-4) with a trace of padding, message schedule and rounds (slide 47).

export const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
export const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
export const bigSigma0 = (x) => (rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22)) >>> 0;
export const bigSigma1 = (x) => (rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25)) >>> 0;
export const smallSigma0 = (x) => (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
export const smallSigma1 = (x) => (rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10)) >>> 0;
export const ch = (e, f, g) => ((e & f) ^ (~e & g)) >>> 0;
export const maj = (a, b, c) => ((a & b) ^ (a & c) ^ (b & c)) >>> 0;

export function pad(bytes) {
  const len = bytes.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const out = new Uint8Array(total);
  out.set(bytes);
  out[len] = 0x80;
  const bitLen = BigInt(len) * 8n;
  for (let i = 0; i < 8; i++) out[total - 1 - i] = Number((bitLen >> BigInt(8 * i)) & 0xffn);
  return out;
}

export function sha256Trace(bytes) {
  const padded = pad(bytes);
  const blocks = [];
  let H = [...H0];
  for (let off = 0; off < padded.length; off += 64) {
    const W = [];
    for (let t = 0; t < 16; t++) {
      const i = off + 4 * t;
      W.push(((padded[i] << 24) | (padded[i + 1] << 16) | (padded[i + 2] << 8) | padded[i + 3]) >>> 0);
    }
    for (let t = 16; t < 64; t++) {
      W.push((smallSigma1(W[t - 2]) + W[t - 7] + smallSigma0(W[t - 15]) + W[t - 16]) >>> 0);
    }
    let [a, b, c, d, e, f, g, h] = H;
    const rounds = [];
    for (let t = 0; t < 64; t++) {
      const S1 = bigSigma1(e);
      const CH = ch(e, f, g);
      const T1 = (h + S1 + CH + K[t] + W[t]) >>> 0;
      const S0 = bigSigma0(a);
      const MAJ = maj(a, b, c);
      const T2 = (S0 + MAJ) >>> 0;
      const before = [a, b, c, d, e, f, g, h];
      h = g; g = f; f = e; e = (d + T1) >>> 0;
      d = c; c = b; b = a; a = (T1 + T2) >>> 0;
      rounds.push({ t, before, after: [a, b, c, d, e, f, g, h], S1, CH, T1, S0, MAJ, T2, W: W[t], K: K[t] });
    }
    const Hin = H;
    const final = [a, b, c, d, e, f, g, h];
    H = H.map((x, i) => (x + final[i]) >>> 0);
    blocks.push({ W, rounds, Hin, Hout: H, offset: off });
  }
  const digest = H.map((x) => x.toString(16).padStart(8, '0')).join('');
  return { padded, blocks, digest };
}

export const sha256Hex = (bytes) => sha256Trace(bytes).digest;
