// Least-significant-bit steganography (slides 6-8) on RGBA pixel buffers.
// Payload bits go into R, G, B in order; alpha is untouched. A 0x00 byte terminates.

export const capacityBytes = (pixels) => Math.floor(((pixels.length / 4) * 3) / 8) - 1;

/** Channel byte offset for the n-th usable (non-alpha) channel. */
export const channelOffset = (n) => Math.floor(n / 3) * 4 + (n % 3);

export function embed(pixels, payload) {
  const bytes = [...payload, 0];
  if (payload.length > capacityBytes(pixels)) {
    throw new Error(`Message needs ${payload.length} bytes but this image only holds ${capacityBytes(pixels)}`);
  }
  const out = new Uint8ClampedArray(pixels);
  const writes = [];
  let n = 0;
  for (const byte of bytes) {
    for (let b = 7; b >= 0; b--) {
      const bit = (byte >> b) & 1;
      const off = channelOffset(n++);
      const before = out[off];
      out[off] = (before & 0xfe) | bit;
      writes.push({ off, bit, before, after: out[off] });
    }
  }
  return { pixels: out, writes };
}

export function extract(pixels, maxBytes = 4096) {
  const bytes = [];
  let n = 0;
  const total = (pixels.length / 4) * 3;
  while (n + 8 <= total && bytes.length < maxBytes) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (pixels[channelOffset(n++)] & 1);
    if (byte === 0) return { bytes: Uint8Array.from(bytes), terminated: true };
    bytes.push(byte);
  }
  return { bytes: Uint8Array.from(bytes), terminated: false };
}
