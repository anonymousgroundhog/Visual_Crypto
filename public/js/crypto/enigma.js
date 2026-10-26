// Enigma I (slide 33): three rotors, reflector B, optional plugboard.

export const ROTORS = {
  I: { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  II: { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
  IV: { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
  V: { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' },
};
export const REFLECTOR_B = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';

const A = 65;
const idx = (c) => c.charCodeAt(0) - A;
const chr = (i) => String.fromCharCode(A + i);
const mod26 = (n) => ((n % 26) + 26) % 26;

export function parsePlugboard(str) {
  const map = [...Array(26).keys()];
  const pairs = String(str || '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  for (const p of pairs) {
    if (p.length !== 2 || p[0] === p[1]) throw new Error(`Bad plugboard pair "${p}" (use pairs like AB CD)`);
    const [x, y] = [idx(p[0]), idx(p[1])];
    if (map[x] !== x || map[y] !== y) throw new Error(`Letter reused in plugboard: ${p}`);
    map[x] = y;
    map[y] = x;
  }
  return map;
}

export class Enigma {
  /**
   * @param {string[]} rotors left, middle, right rotor names (e.g. ['I','II','III'])
   * @param {string} positions 3 letters, left..right
   * @param {string} rings 3 letters, left..right
   */
  constructor({ rotors = ['I', 'II', 'III'], positions = 'AAA', rings = 'AAA', plugboard = '' } = {}) {
    const pos = String(positions).toUpperCase();
    const ring = String(rings).toUpperCase();
    if (!/^[A-Z]{3}$/.test(pos)) throw new Error('Rotor positions must be 3 letters, e.g. AAA');
    if (!/^[A-Z]{3}$/.test(ring)) throw new Error('Ring settings must be 3 letters, e.g. AAA');
    this.rotors = rotors.map((name, i) => {
      const r = ROTORS[name];
      if (!r) throw new Error(`Unknown rotor ${name}`);
      const fwd = [...r.wiring].map(idx);
      const inv = Array(26);
      fwd.forEach((o, i2) => (inv[o] = i2));
      return { name, fwd, inv, notch: idx(r.notch), pos: idx(pos[i]), ring: idx(ring[i]) };
    });
    this.reflector = [...REFLECTOR_B].map(idx);
    this.plug = parsePlugboard(plugboard);
  }

  get positions() {
    return this.rotors.map((r) => chr(r.pos)).join('');
  }

  /** Step rotors (with the middle-rotor double step) and return which moved. */
  step() {
    const [L, M, R] = this.rotors;
    const moved = [false, false, true];
    if (M.pos === M.notch) {
      moved[0] = moved[1] = true;
    } else if (R.pos === R.notch) {
      moved[1] = true;
    }
    if (moved[0]) L.pos = mod26(L.pos + 1);
    if (moved[1]) M.pos = mod26(M.pos + 1);
    R.pos = mod26(R.pos + 1);
    return moved;
  }

  static pass(rotor, c, table) {
    const shift = rotor.pos - rotor.ring;
    return mod26(table[mod26(c + shift)] - shift);
  }

  /**
   * Encipher one letter. Returns the letter plus a full trace of contact indices
   * (0-25, fixed frame) so the signal path can be drawn.
   */
  press(letter) {
    const before = this.positions;
    const moved = this.step();
    const after = this.positions;
    const [L, M, R] = this.rotors;
    const key = idx(letter.toUpperCase());
    const path = [key];
    let c = this.plug[key];
    path.push(c); // after plugboard
    c = Enigma.pass(R, c, R.fwd); path.push(c);
    c = Enigma.pass(M, c, M.fwd); path.push(c);
    c = Enigma.pass(L, c, L.fwd); path.push(c);
    c = this.reflector[c]; path.push(c);
    c = Enigma.pass(L, c, L.inv); path.push(c);
    c = Enigma.pass(M, c, M.inv); path.push(c);
    c = Enigma.pass(R, c, R.inv); path.push(c);
    c = this.plug[c]; path.push(c);
    return { input: chr(key), output: chr(c), before, after, moved, path };
  }

  encrypt(text) {
    return [...String(text).toUpperCase()].filter((ch) => /[A-Z]/.test(ch)).map((ch) => this.press(ch).output).join('');
  }
}
