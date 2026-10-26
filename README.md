# VisualCrypto

Step-by-step animated visualizations of the cryptographic algorithms in **IT 360, Chapter 5 – Understanding Techniques for Hiding and Scrambling Information**, in the spirit of [VisuAlgo](https://visualgo.net/en).

Students pick an algorithm, type their own input, and then play, pause or step through it one operation at a time. The current pseudocode line is highlighted and a status panel explains each step.

## Running it

Requires Node.js 18 or later. There are no dependencies to install.

```bash
npm start            # http://127.0.0.1:3000
PORT=8080 npm start  # different port
HOST=0.0.0.0 npm start   # serve to other machines in a lab
npm test             # algorithm test vectors + module smoke tests
```

## Algorithms

| Category | Visualizations | Slides |
|---|---|---|
| Classical ciphers | Caesar, ROT13, Atbash, Scytale, Playfair, Multialphabet substitution, Vigenère, Enigma I | 24–33 |
| Steganography | LSB image steganography (hide, extract, LSB-plane steganalysis, PNG download) | 6–8, 15–18 |
| Symmetric ciphers | Binary AND/OR/XOR, XOR stream cipher, toy Feistel network, DES (all 16 rounds), 3DES (EDE, keying options 1–3), AES-128/192/256 | 37–45 |
| Hashes | SHA-256 (padding, message schedule, 64 rounds, avalanche effect) | 47 |
| Asymmetric ciphers | RSA (key generation, Euclid, extended Euclid, square-and-multiply), Diffie–Hellman | 49–52 |
| Cryptanalysis | Frequency analysis / chi-square Caesar break, Kasiski examination + IoC Vigenère break | 26, 55 |

The real ciphers are checked against published test vectors: FIPS-197 for AES, the classic DES vector, `BDZGO` for Enigma, and `node:crypto` for SHA-256, AES and 3DES. The slide examples are checked too, for example `A CAT` → `C ECV`, `cat` + `horse` → `jok`, and Playfair `falcon` AT → CR.

## Controls

| Key | Action |
|---|---|
| Space | Play / pause |
| ← / → | Previous / next step |
| Home / End | First / last step |

The speed selector runs from 0.25× to 8×. The ☀/☾ button switches between the light and dark themes.

## Project layout

```
server.js                 zero-dependency static server
public/index.html         app shell
public/css/style.css      all styles (light + dark tokens)
public/js/app.js          hash router (#/ = catalogue, #/<id> = visualizer)
public/js/core/player.js  input panel, playback controls, pseudocode trace
public/js/core/render.js  DOM/SVG helpers (cells, bit rows, byte grids, charts)
public/js/crypto/         pure algorithm implementations with traces (no DOM)
public/js/algos/          one module per visualization
test/                     node:test suites
```

### Adding a visualization

Create `public/js/algos/<id>.js` that exports:

```js
export default {
  id, title, category, blurb, slides, about,   // metadata (about is HTML)
  inputs: [{ id, label, type, value, options?, when? }],
  actions: [{ id, label }],
  code: [...lines] | { [actionId]: [...lines] },  // pseudocode
  generate(actionId, values) { return { steps: [{ line, msg, ...state }], ctx } },
  render(step, stageElement, ctx) { /* draw one step */ },
};
```

Then add it to `public/js/algos/index.js`. Steps are snapshots, so stepping backwards is free. Put the algorithm itself in `public/js/crypto/` so it can be tested in Node.
