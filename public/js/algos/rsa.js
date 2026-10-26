import { h, table, kbd, note, math } from '../core/render.js';
import { toBig, gcdTrace, modInverseTrace, modPowTrace, isProbablePrime, suggestE } from '../crypto/numtheory.js';

const keyCard = (kind, a, b) => h('div', { class: `keycard ${kind}` },
  h('div', { class: 'keycard-title' }, kind === 'pub' ? '🔓 Public key' : '🔐 Private key'),
  h('div', {}, kind === 'pub' ? 'e = ' : 'd = ', h('b', {}, String(a))),
  h('div', {}, 'n = ', h('b', {}, String(b))));

function keygen(v) {
  const p = toBig(v.p, 'p');
  const q = toBig(v.q, 'q');
  const e = toBig(v.e, 'e');
  if (!isProbablePrime(p)) throw new Error(`p = ${p} is not prime.`);
  if (!isProbablePrime(q)) throw new Error(`q = ${q} is not prime.`);
  if (p === q) throw new Error('p and q must be different primes.');
  const n = p * q;
  const m = (p - 1n) * (q - 1n);
  const g = gcdTrace(e, m);
  if (e <= 1n || e >= m) throw new Error(`e must be between 2 and m − 1 = ${m - 1n}.`);
  if (g.gcd !== 1n) throw new Error(`e = ${e} shares a factor ${g.gcd} with m = ${m}. Try e = ${suggestE(m).join(', ')}.`);
  const inv = modInverseTrace(e, m);
  return { p, q, e, n, m, g, inv, d: inv.inverse };
}

function parseMessage(v, n) {
  const parts = String(v.message).split(/[\s,]+/).filter(Boolean);
  if (!parts.length) throw new Error('Enter at least one number to encrypt.');
  if (parts.length > 6) throw new Error('Please use at most 6 numbers.');
  return parts.map((x) => {
    const M = toBig(x, 'Message');
    if (M >= n) throw new Error(`Each message number must be smaller than n = ${n} (got ${M}). Use bigger primes or smaller numbers.`);
    return M;
  });
}

export default {
  id: 'rsa',
  title: 'RSA',
  slides: '49–51',
  category: 'Asymmetric ciphers',
  blurb: 'Public-key encryption from two primes. Key generation, Mᵉ mod n and Cᵈ mod n.',
  about: `<p><b>Rivest, Shamir and Adleman</b> (MIT, 1977). The most widely used public-key algorithm. Its security rests on how hard it is to <b>factor</b> n back into p and q.</p>
<ol><li>Pick primes p, q. n = p × q.</li><li>m = (p − 1)(q − 1) — Euler's totient.</li><li>Pick e coprime to m.</li><li>Find d with (d × e) mod m = 1.</li></ol>
<p>Public key (e, n), private key (d, n). <b>Encrypt</b> C = Mᵉ mod n, <b>decrypt</b> P = Cᵈ mod n.</p>
<p>Slide example: p = 5, q = 11 → n = 55, m = 40, e = 3, d = 27. M = 2 → C = 8 → back to 2. Real keys are 2,048–4,096 bits. <span class="ref">Ch. 5 slides 49–51</span></p>`,
  inputs: [
    { id: 'p', label: 'Prime p', type: 'text', value: '5' },
    { id: 'q', label: 'Prime q', type: 'text', value: '11' },
    { id: 'e', label: 'Public exponent e', type: 'text', value: '3' },
    { id: 'message', label: 'Message M (numbers < n, comma separated)', type: 'text', value: '2' },
  ],
  actions: [{ id: 'full', label: 'Generate keys + encrypt + decrypt' }, { id: 'keygen', label: 'Key generation only' }],
  random: () => {
    const primes = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61];
    const pick = () => primes[Math.floor(Math.random() * primes.length)];
    let p = pick();
    let q = pick();
    while (q === p) q = pick();
    return { p, q, e: suggestE(BigInt((p - 1) * (q - 1)))[1] ?? 3, message: String(Math.floor(Math.random() * Math.min(p * q - 1, 200)) + 2) };
  },
  code: [
    'check p and q are prime',
    'n = p × q',
    'm = (p − 1)(q − 1)',
    'check gcd(e, m) = 1            // Euclid',
    'd = e⁻¹ mod m                  // extended Euclid',
    'public = (e, n); private = (d, n)',
    'C = Mᵉ mod n                   // square and multiply',
    'P = Cᵈ mod n',
  ],
  generate(action, v) {
    const k = keygen(v);
    const steps = [
      { kind: 'primes', k, line: 0, msg: `p = ${kbd(k.p)} and q = ${kbd(k.q)} are prime.` },
      { kind: 'n', k, line: 1, msg: `n = p × q = ${k.p} × ${k.q} = ${kbd(k.n)}. n is public; p and q must stay secret.` },
      { kind: 'm', k, line: 2, msg: `m = (p − 1)(q − 1) = ${k.p - 1n} × ${k.q - 1n} = ${kbd(k.m)}.` },
      { kind: 'gcd', k, line: 3, msg: `Euclid's algorithm: gcd(${k.e}, ${k.m}) = ${kbd(k.g.gcd)}, so e = ${k.e} is a valid public exponent.` },
      { kind: 'inv', k, line: 4, msg: `Extended Euclid finds d = ${kbd(k.d)}: ${k.d} × ${k.e} = ${k.d * k.e} and ${k.d * k.e} mod ${k.m} = 1 ✔` },
      { kind: 'keys', k, line: 5, msg: `Publish (e, n) = (${k.e}, ${k.n}). Keep d = ${k.d} secret.` },
    ];
    if (action === 'full') {
      for (const M of parseMessage(v, k.n)) {
        const enc = modPowTrace(M, k.e, k.n);
        const C = enc.result;
        const dec = modPowTrace(C, k.d, k.n);
        steps.push({ kind: 'pow', k, M, label: 'Encrypt', base: M, exp: k.e, tr: enc, line: 6, msg: `Encrypt M = ${M}: C = ${M}^${k.e} mod ${k.n} = ${kbd(C)}. Anyone can do this with the public key.` });
        steps.push({ kind: 'pow', k, M, C, label: 'Decrypt', base: C, exp: k.d, tr: dec, line: 7, msg: `Decrypt C = ${C}: P = ${C}^${k.d} mod ${k.n} = ${kbd(dec.result)} — only the holder of d can do this. ${dec.result === M ? '✔ Matches the original message.' : ''}` });
      }
    }
    return { steps };
  },
  render(step, stage) {
    const { k } = step;
    const facts = h('div', { class: 'facts' },
      ['p', 'q', 'n', 'm', 'e', 'd'].map((x) => h('div', { class: `fact ${knownBy(step.kind, x) ? 'on' : ''} ${x === 'd' || x === 'p' || x === 'q' || x === 'm' ? 'secret' : ''}` }, h('small', {}, x === 'm' ? 'm = φ(n)' : x), h('b', {}, knownBy(step.kind, x) ? String(k[x]) : '?'))));
    const parts = [facts];
    if (step.kind === 'gcd') {
      parts.push(table(['a', '=', 'q × b', '+ r'], k.g.rows.map((r) => [String(r.a), '=', `${r.q} × ${r.b}`, `+ ${r.r}`]), { compact: true, rowCls: (i) => (i === k.g.rows.length - 1 ? 'hl' : '') }), note('The last non-zero remainder is the gcd.'));
    }
    if (step.kind === 'inv') {
      parts.push(table(['quotient', 'remainder r', 's (coeff. of e)', 't (coeff. of m)'], k.inv.rows.map((r) => [r.q == null ? '' : String(r.q), String(r.r), String(r.s), String(r.t)]), { compact: true, rowCls: (i) => (i === k.inv.rows.length - 2 ? 'hl' : '') }),
        note(`Each row keeps s·e + t·m = r. When r reaches 1, s is the inverse (taken mod m): d = ${k.d}.`));
    }
    if (step.kind === 'keys' || step.kind === 'pow') parts.push(h('div', { class: 'row center' }, keyCard('pub', k.e, k.n), keyCard('priv', k.d, k.n)));
    if (step.kind === 'pow') {
      parts.push(math(`${step.label}: ${step.base}<sup>${step.exp}</sup> mod ${k.n} — exponent in binary: <b>${step.tr.bits}</b>`),
        table(['bit', 'square: acc² mod n', 'multiply if bit = 1', 'acc'], step.tr.rows.map((r) => [r.bit, String(r.squared), r.bit === '1' ? `× ${step.base} mod ${k.n}` : '—', h('b', {}, String(r.acc))]), { compact: true, rowCls: (i) => (i === step.tr.rows.length - 1 ? 'hl' : '') }),
        note('Square-and-multiply needs only about 2 × (number of bits) multiplications, even for 2,048-bit exponents.'));
    }
    stage.append(h('div', { class: 'col' }, parts));
  },
};

function knownBy(kind, x) {
  const order = ['primes', 'n', 'm', 'gcd', 'inv', 'keys', 'pow'];
  const at = { p: 'primes', q: 'primes', n: 'n', m: 'm', e: 'gcd', d: 'inv' }[x];
  return order.indexOf(kind) >= order.indexOf(at);
}
