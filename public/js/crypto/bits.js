// Bit / byte helpers shared by the modern ciphers.

export function hexToBytes(hex) {
  const clean = String(hex).replace(/\s+/g, '');
  if (!/^([0-9a-fA-F]{2})*$/.test(clean)) throw new Error(`Not valid hex: "${hex}"`);
  return Uint8Array.from(clean.match(/../g) || [], (b) => parseInt(b, 16));
}

export const bytesToHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

export const utf8 = (text) => new TextEncoder().encode(text);
export const fromUtf8 = (bytes) => new TextDecoder().decode(bytes);

export function bytesToBits(bytes) {
  const bits = [];
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  return bits;
}

export function bitsToBytes(bits) {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => (out[i >> 3] |= bit << (7 - (i & 7))));
  return out;
}

export const bitsToHex = (bits) => bytesToHex(bitsToBytes(bits));
export const hexToBits = (hex) => bytesToBits(hexToBytes(hex));
export const xorBits = (a, b) => a.map((bit, i) => bit ^ b[i]);
export const toBin = (n, width = 8) => (n >>> 0).toString(2).padStart(width, '0');
export const toHex = (n, width = 2) => (n >>> 0).toString(16).padStart(width, '0').toUpperCase();

/** Accept either hex or text input, returning exactly `size` bytes (text is zero padded). */
export function parseBlock(value, format, size, label = 'Input') {
  if (format === 'text') {
    const bytes = utf8(value);
    if (bytes.length > size) throw new Error(`${label} text must be at most ${size} bytes (got ${bytes.length})`);
    const out = new Uint8Array(size);
    out.set(bytes);
    return out;
  }
  const bytes = hexToBytes(value);
  if (bytes.length !== size) throw new Error(`${label} must be exactly ${size * 2} hex digits (got ${bytes.length * 2})`);
  return bytes;
}

export function printable(bytes) {
  return [...bytes].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join('');
}
