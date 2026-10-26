// Cryptanalysis helpers (slides 26, 55): frequency analysis, chi-square, Kasiski, IoC.
import { ALPHA, lettersOnly, caesar } from './classical.js';

// Relative frequency of letters in English text, percent.
export const ENGLISH = [8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153, 0.772, 4.025, 2.406, 6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056, 2.758, 0.978, 2.36, 0.15, 1.974, 0.074];

export function letterCounts(text) {
  const counts = Array(26).fill(0);
  for (const c of lettersOnly(text)) counts[c.charCodeAt(0) - 65]++;
  return counts;
}

export function chiSquare(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return Infinity;
  return counts.reduce((sum, obs, i) => {
    const exp = (ENGLISH[i] / 100) * total;
    return sum + (obs - exp) ** 2 / exp;
  }, 0);
}

/** Score each Caesar shift by decrypting with it and measuring chi-square. */
export function caesarScores(cipher) {
  const counts = letterCounts(cipher);
  return ALPHA.split('').map((_, k) => {
    // Decrypting by k rotates the counts left by k.
    const shifted = counts.map((_, i) => counts[(i + k) % 26]);
    return { shift: k, chi: chiSquare(shifted), preview: caesar(cipher, -k) };
  });
}

export function indexOfCoincidence(letters) {
  const counts = letterCounts(letters);
  const n = letters.length;
  if (n < 2) return 0;
  return counts.reduce((s, c) => s + c * (c - 1), 0) / (n * (n - 1));
}

export function columns(letters, L) {
  const cols = Array.from({ length: L }, () => '');
  [...letters].forEach((c, i) => (cols[i % L] += c));
  return cols;
}

/** Repeated sequences of length `len` with their positions and spacings. */
export function repeats(letters, len = 3) {
  const seen = new Map();
  for (let i = 0; i + len <= letters.length; i++) {
    const s = letters.slice(i, i + len);
    if (!seen.has(s)) seen.set(s, []);
    seen.get(s).push(i);
  }
  const out = [];
  for (const [seq, pos] of seen) {
    if (pos.length < 2) continue;
    const gaps = pos.slice(1).map((p, i) => p - pos[i]);
    out.push({ seq, pos, gaps });
  }
  return out.sort((a, b) => b.pos.length - a.pos.length || a.pos[0] - b.pos[0]);
}

export function factorCounts(gaps, maxFactor = 16) {
  const counts = Array(maxFactor + 1).fill(0);
  for (const g of gaps) for (let f = 2; f <= maxFactor; f++) if (g % f === 0) counts[f]++;
  return counts;
}

/**
 * Pick the key length: the shortest length whose average column IoC is close to English
 * (within 90% of the best average seen). Longer multiples of the true length score
 * equally well, so preferring the shortest avoids picking 10 when the key is 5.
 */
export function guessKeyLength(letters, maxLen = 12) {
  const scores = [];
  for (let L = 1; L <= maxLen; L++) {
    const cols = columns(letters, L);
    const avg = cols.reduce((s, c) => s + indexOfCoincidence(c), 0) / L;
    scores.push({ L, ioc: avg });
  }
  const best = Math.max(...scores.map((s) => s.ioc));
  const pick = scores.find((s) => s.ioc >= best * 0.9 && s.L > 1) || scores.reduce((a, b) => (b.ioc > a.ioc ? b : a));
  return { scores, length: pick.L };
}

export function breakVigenere(cipher) {
  const letters = lettersOnly(cipher);
  const { length } = guessKeyLength(letters);
  const key = columns(letters, length)
    .map((col) => {
      const best = caesarScores(col).reduce((a, b) => (b.chi < a.chi ? b : a));
      return ALPHA[best.shift];
    })
    .join('');
  return { length, key };
}
