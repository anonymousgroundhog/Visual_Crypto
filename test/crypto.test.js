import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes, getCiphers } from 'node:crypto';

import * as C from '../public/js/crypto/classical.js';
import { Enigma } from '../public/js/crypto/enigma.js';
import { desHex, tdesStages } from '../public/js/crypto/des.js';
import { aesTrace } from '../public/js/crypto/aes.js';
import { sha256Hex } from '../public/js/crypto/sha256.js';
import { hexToBytes, bytesToHex, utf8 } from '../public/js/crypto/bits.js';
import { modInverseTrace, modPow, isProbablePrime } from '../public/js/crypto/numtheory.js';
import { feistelTrace } from '../public/js/crypto/feistel.js';
import { embed, extract } from '../public/js/crypto/lsb.js';
import { caesarScores, breakVigenere } from '../public/js/crypto/analysis.js';
import { SAMPLE_TEXT } from '../public/js/core/samples.js';

test('Caesar, ROT13, Atbash match slides 25 and 28', () => {
  assert.equal(C.caesar('A CAT', 2), 'C ECV');
  assert.equal(C.caesar('A CAT', 3), 'D FDW');
  assert.equal(C.rot13('A CAT'), 'N PNG');
  assert.equal(C.atbash('ABC'), 'ZYX');
  assert.equal(C.caesar(C.caesar('Hello, World', 7), -7), 'Hello, World');
});

test('Multialphabet substitution matches slide 31', () => {
  assert.equal(C.multiShift('A CAT', [2, -2, 3]), 'C ADV');
});

test('Vigenère matches slide 32 and round-trips', () => {
  assert.equal(C.vigenere('cat', 'horse'), 'jok');
  const ct = C.vigenere('Attack at dawn!', 'LEMON');
  assert.equal(ct, 'Lxfopv ef rnhr!');
  assert.equal(C.vigenere(ct, 'LEMON', true), 'Attack at dawn!');
});

test('Playfair matches slides 29-30', () => {
  const t = C.playfairTable('falcon');
  assert.equal(t.join(''), 'FALCONBDEGHIKMPQRSTUVWXYZ');
  assert.equal(C.playfairPair(t, 'A', 'T').out, 'CR');
  assert.deepEqual(C.playfairPrepare('dollar').map((p) => p.a + p.b), ['DO', 'LX', 'AR']);
  assert.deepEqual(C.playfairPrepare('attack at dawn').map((p) => p.a + p.b), ['AT', 'TA', 'CK', 'AT', 'DA', 'WN']);
  const ct = C.playfair('attack at dawn', 'falcon');
  assert.equal(C.playfair(ct, 'falcon', true), 'ATTACKATDAWN');
});

test('Scytale round-trips', () => {
  const ct = C.scytale('HELP ME I AM UNDER ATTACK', 4);
  assert.equal(C.scytale(ct, 4, true), 'HELPMEIAMUNDERATTACK');
});

test('Enigma I known vector AAAAA -> BDZGO and reciprocity', () => {
  assert.equal(new Enigma().encrypt('AAAAA'), 'BDZGO');
  const cfg = { rotors: ['IV', 'II', 'V'], positions: 'QEV', rings: 'BUL', plugboard: 'AB CD EF' };
  const ct = new Enigma(cfg).encrypt('THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG');
  assert.equal(new Enigma(cfg).encrypt(ct), 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG');
});

test('Enigma double-step: ADU -> ADV -> AEW -> BFX', () => {
  const m = new Enigma({ positions: 'ADU' });
  const seen = [];
  for (let i = 0; i < 3; i++) seen.push(m.press('A').after);
  assert.deepEqual(seen, ['ADV', 'AEW', 'BFX']);
});

test('DES known vector', () => {
  assert.equal(desHex('0123456789ABCDEF', '133457799BBCDFF1'), '85E813540F0AB405');
  assert.equal(desHex('85E813540F0AB405', '133457799BBCDFF1', true), '0123456789ABCDEF');
});

test('3DES matches node:crypto des-ede3', { skip: !getCiphers().includes('des-ede3') }, () => {
  const keys = ['0123456789ABCDEF', '23456789ABCDEF01', '456789ABCDEF0123'];
  const pt = '5468652071756663';
  const c = createCipheriv('des-ede3', Buffer.from(keys.join(''), 'hex'), null).setAutoPadding(false);
  const expected = Buffer.concat([c.update(Buffer.from(pt, 'hex')), c.final()]).toString('hex').toUpperCase();
  const stages = tdesStages(pt, keys);
  assert.equal(stages[2].outHex, expected);
  assert.equal(tdesStages(expected, keys, true)[2].outHex, pt);
});

test('AES FIPS-197 vectors (128/192/256) and decryption', () => {
  const pt = hexToBytes('00112233445566778899aabbccddeeff');
  const vectors = [
    ['000102030405060708090a0b0c0d0e0f', '69C4E0D86A7B0430D8CDB78070B4C55A'],
    ['000102030405060708090a0b0c0d0e0f1011121314151617', 'DDA97CA4864CDFE06EAF70A0EC0D7191'],
    ['000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', '8EA2B7CA516745BFEAFC49904B496089'],
  ];
  for (const [key, ct] of vectors) {
    const k = hexToBytes(key);
    assert.equal(bytesToHex(aesTrace(pt, k).out), ct);
    assert.equal(bytesToHex(aesTrace(hexToBytes(ct), k, true).out), bytesToHex(pt));
  }
});

test('AES-128 matches node:crypto on random blocks', () => {
  for (let i = 0; i < 20; i++) {
    const key = randomBytes(16);
    const pt = randomBytes(16);
    const c = createCipheriv('aes-128-ecb', key, null).setAutoPadding(false);
    const expected = Buffer.concat([c.update(pt), c.final()]).toString('hex').toUpperCase();
    assert.equal(bytesToHex(aesTrace(pt, key).out), expected);
  }
});

test('SHA-256 matches node:crypto', () => {
  for (const msg of ['', 'abc', 'password', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(200), 'héllo wörld']) {
    assert.equal(sha256Hex(utf8(msg)), createHash('sha256').update(msg).digest('hex'), JSON.stringify(msg));
  }
});

test('RSA toy example from slide 51', () => {
  const { inverse } = modInverseTrace(3n, 40n);
  assert.equal(inverse, 27n);
  assert.equal(modPow(2n, 3n, 55n), 8n);
  assert.equal(modPow(8n, 27n, 55n), 2n);
  assert.equal(modInverseTrace(4n, 40n).inverse, null);
  assert.ok(isProbablePrime(61n) && !isProbablePrime(55n) && isProbablePrime(2147483647n));
});

test('Toy Feistel round-trips', () => {
  for (const [block, key] of [[0x4849, 0xa3f1], [0x0000, 0xffff], [0xbeef, 0x1234]]) {
    const ct = feistelTrace(block, key, 4).out;
    assert.equal(feistelTrace(ct, key, 4, true).out, block);
  }
});

test('LSB embed/extract round-trips and changes each byte by at most 1', () => {
  const px = Uint8ClampedArray.from({ length: 4 * 100 }, (_, i) => (i * 37) & 255);
  const { pixels } = embed(px, utf8('Meet at noon'));
  assert.equal(new TextDecoder().decode(extract(pixels).bytes), 'Meet at noon');
  assert.ok(pixels.every((v, i) => Math.abs(v - px[i]) <= 1));
  assert.ok(pixels.every((v, i) => i % 4 !== 3 || v === px[i]));
});

test('Frequency analysis recovers a Caesar shift', () => {
  const ct = C.caesar(SAMPLE_TEXT, 11);
  const best = caesarScores(ct).reduce((a, b) => (b.chi < a.chi ? b : a));
  assert.equal(best.shift, 11);
});

test('Kasiski/IoC attack recovers a Vigenère key', () => {
  assert.deepEqual(breakVigenere(C.vigenere(SAMPLE_TEXT, 'HORSE')), { length: 5, key: 'HORSE' });
});

test('Scytale pads a ragged final column with X', () => {
  assert.equal(C.scytale(C.scytale('ATTACKNOW', 4), 4, true), 'ATTACKNOWXXX');
});
