// Number theory for RSA and Diffie-Hellman (slides 49-52). BigInt throughout.

export function toBig(v, label = 'Value') {
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) throw new Error(`${label} must be a non-negative whole number`);
  return BigInt(s);
}

export const bmod = (a, m) => ((a % m) + m) % m;

/** Euclid's algorithm; rows are { a, b, q, r } for a = q*b + r. */
export function gcdTrace(a, b) {
  const rows = [];
  while (b !== 0n) {
    const q = a / b;
    const r = a % b;
    rows.push({ a, b, q, r });
    [a, b] = [b, r];
  }
  return { gcd: a, rows };
}

/** Extended Euclid to find d with d*e ≡ 1 (mod m). Rows track (r, s, t) with s*e + t*m = r. */
export function modInverseTrace(e, m) {
  const rows = [{ q: null, r: m, s: 0n, t: 1n }, { q: null, r: e, s: 1n, t: 0n }];
  while (rows.at(-1).r !== 0n) {
    const [p, c] = rows.slice(-2);
    const q = p.r / c.r;
    rows.push({ q, r: p.r - q * c.r, s: p.s - q * c.s, t: p.t - q * c.t });
  }
  const last = rows.at(-2);
  if (last.r !== 1n) return { inverse: null, gcd: last.r, rows };
  return { inverse: bmod(last.s, m), gcd: 1n, rows };
}

/** Left-to-right square-and-multiply; rows show each exponent bit. */
export function modPowTrace(base, exp, m) {
  if (m === 1n) return { result: 0n, rows: [] };
  const bits = exp.toString(2);
  const rows = [];
  let acc = 1n;
  const b = bmod(base, m);
  for (const bit of bits) {
    const squared = (acc * acc) % m;
    acc = bit === '1' ? (squared * b) % m : squared;
    rows.push({ bit, squared, acc });
  }
  return { result: acc, rows, bits };
}

export const modPow = (b, e, m) => modPowTrace(b, e, m).result;

export function isProbablePrime(n) {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    s++;
  }
  outer: for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < s; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}

export function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Small e values coprime to m, for helpful error messages. */
export function suggestE(m, count = 6) {
  const out = [];
  for (let e = 3n; e < m && out.length < count; e += 2n) if (gcd(e, m) === 1n) out.push(e);
  return out;
}
