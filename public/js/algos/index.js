// Every visualization, in the order they appear on the home page.
import caesar from './caesar.js';
import rot13 from './rot13.js';
import atbash from './atbash.js';
import scytale from './scytale.js';
import playfair from './playfair.js';
import multishift from './multishift.js';
import vigenere from './vigenere.js';
import enigma from './enigma.js';
import lsb from './lsb.js';
import binary from './binary.js';
import xorstream from './xorstream.js';
import feistel from './feistel.js';
import des from './des.js';
import tdes from './tdes.js';
import aes from './aes.js';
import sha256 from './sha256.js';
import rsa from './rsa.js';
import dh from './dh.js';
import frequency from './frequency.js';
import kasiski from './kasiski.js';

export const ALGORITHMS = [caesar, rot13, atbash, scytale, playfair, multishift, vigenere, enigma, lsb, binary, xorstream, feistel, des, tdes, aes, sha256, rsa, dh, frequency, kasiski];

export const CATEGORIES = [
  { name: 'Classical ciphers', icon: '📜', blurb: 'Pen-and-paper and mechanical ciphers. Not secure today, but they teach the core ideas.' },
  { name: 'Steganography', icon: '🖼️', blurb: 'Hiding that a message exists at all.' },
  { name: 'Symmetric ciphers', icon: '🔑', blurb: 'One shared key encrypts and decrypts. Bits, XOR, Feistel networks, DES and AES.' },
  { name: 'Hashes', icon: '#️⃣', blurb: 'One-way fingerprints of data.' },
  { name: 'Asymmetric ciphers', icon: '🔐', blurb: 'Public and private keys built on number theory.' },
  { name: 'Cryptanalysis', icon: '🕵️', blurb: 'Breaking ciphers without the key.' },
];

export const byId = (id) => ALGORITHMS.find((a) => a.id === id);
