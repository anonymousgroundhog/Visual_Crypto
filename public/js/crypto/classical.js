// Classical ciphers from Chapter 5 (slides 24-33). Pure functions, no DOM.

export const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const mod = (n, m) => ((n % m) + m) % m;
export const isLetter = (c) => /^[A-Za-z]$/.test(c);
export const letterIndex = (c) => c.toUpperCase().charCodeAt(0) - 65;
export const lettersOnly = (text) => text.toUpperCase().replace(/[^A-Z]/g, '');

export function shiftChar(c, k) {
  if (!isLetter(c)) return c;
  const base = c <= 'Z' ? 65 : 97;
  return String.fromCharCode(base + mod(c.charCodeAt(0) - base + k, 26));
}

export const caesar = (text, k) => [...text].map((c) => shiftChar(c, k)).join('');
export const rot13 = (text) => caesar(text, 13);

export function atbashChar(c) {
  if (!isLetter(c)) return c;
  const base = c <= 'Z' ? 65 : 97;
  return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
}
export const atbash = (text) => [...text].map(atbashChar).join('');

// Multialphabet substitution: shifts used in rotation; non-letters do not consume a shift.
export function multiShift(text, shifts) {
  if (!shifts.length) throw new Error('Need at least one shift');
  let j = 0;
  return [...text].map((c) => (isLetter(c) ? shiftChar(c, shifts[j++ % shifts.length]) : c)).join('');
}

export function parseShifts(str) {
  const shifts = String(str).split(/[\s,]+/).filter(Boolean).map(Number);
  if (!shifts.length || shifts.some((n) => !Number.isInteger(n))) {
    throw new Error('Shifts must be a list of whole numbers, e.g. "+2, -2, +3"');
  }
  return shifts;
}

export function vigenereShifts(key) {
  const k = lettersOnly(key);
  if (!k) throw new Error('Keyword must contain at least one letter');
  return [...k].map(letterIndex);
}

export const vigenere = (text, key, decrypt = false) =>
  multiShift(text, vigenereShifts(key).map((s) => (decrypt ? -s : s)));

// ---------- Playfair (slides 29-30) ----------

/** 25-letter table, row-major (index = row*5 + col). I and J share a cell. */
export function playfairTable(keyword) {
  const seen = new Set();
  const table = [];
  for (const ch of lettersOnly(keyword).replace(/J/g, 'I') + ALPHA.replace('J', '')) {
    if (!seen.has(ch)) {
      seen.add(ch);
      table.push(ch);
    }
  }
  return table;
}

/**
 * Split into digraphs using the rules on slide 30: a doubled letter inside a pair
 * has its second letter replaced by X ("dollar" -> "DO LX AR"), and an odd
 * trailing letter is padded with Z.
 */
export function playfairPrepare(text) {
  const letters = lettersOnly(text).replace(/J/g, 'I');
  const pairs = [];
  for (let i = 0; i < letters.length; i += 2) {
    let a = letters[i];
    let b = letters[i + 1];
    let note = '';
    if (b === undefined) {
      b = a === 'Z' ? 'X' : 'Z';
      note = `odd letter at the end, padded with ${b}`;
    } else if (a === b) {
      b = a === 'X' ? 'Q' : 'X';
      note = `doubled letter ${a}${a}, second becomes ${b}`;
    }
    pairs.push({ a, b, note });
  }
  return pairs;
}

export function playfairPair(table, a, b, decrypt = false) {
  const dir = decrypt ? -1 : 1;
  const pa = table.indexOf(a);
  const pb = table.indexOf(b);
  if (pa < 0 || pb < 0) throw new Error(`Letter not in table: ${a}${b}`);
  const [ra, ca, rb, cb] = [Math.floor(pa / 5), pa % 5, Math.floor(pb / 5), pb % 5];
  let rule;
  let ia;
  let ib;
  if (ra === rb) {
    rule = 'row';
    ia = ra * 5 + mod(ca + dir, 5);
    ib = rb * 5 + mod(cb + dir, 5);
  } else if (ca === cb) {
    rule = 'column';
    ia = mod(ra + dir, 5) * 5 + ca;
    ib = mod(rb + dir, 5) * 5 + cb;
  } else {
    rule = 'rectangle';
    ia = ra * 5 + cb;
    ib = rb * 5 + ca;
  }
  return { rule, from: [pa, pb], to: [ia, ib], out: table[ia] + table[ib] };
}

export function playfair(text, keyword, decrypt = false) {
  const table = playfairTable(keyword);
  const pairs = decrypt
    ? (lettersOnly(text).replace(/J/g, 'I').match(/../g) || []).map((p) => ({ a: p[0], b: p[1] }))
    : playfairPrepare(text);
  return pairs.map(({ a, b }) => playfairPair(table, a, b, decrypt).out).join('');
}

// ---------- Scytale (slide 28) ----------

/** rows = number of letters around the rod. Encrypt writes row-wise, reads column-wise. */
export function scytaleGrid(text, rows, decrypt = false) {
  const letters = lettersOnly(text);
  if (!Number.isInteger(rows) || rows < 2) throw new Error('Rod size must be a whole number ≥ 2');
  const cols = Math.max(1, Math.ceil(letters.length / rows));
  const padded = letters.padEnd(rows * cols, 'X');
  const grid = Array.from({ length: rows }, () => Array(cols).fill(''));
  for (let i = 0; i < padded.length; i++) {
    if (decrypt) grid[i % rows][Math.floor(i / rows)] = padded[i];
    else grid[Math.floor(i / cols)][i % cols] = padded[i];
  }
  return { grid, rows, cols, padded };
}

export function scytale(text, rows, decrypt = false) {
  const { grid, cols } = scytaleGrid(text, rows, decrypt);
  let out = '';
  if (decrypt) for (const row of grid) out += row.join('');
  else for (let c = 0; c < cols; c++) for (const row of grid) out += row[c];
  return out;
}
