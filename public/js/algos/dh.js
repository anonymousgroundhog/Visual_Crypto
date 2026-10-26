import { h, table, kbd, note } from '../core/render.js';
import { toBig, modPowTrace, isProbablePrime } from '../crypto/numtheory.js';

const swatch = (val, p, label) => h('div', { class: 'paint', style: { background: `hsl(${Number((val * 360n) / p)} 65% 50%)` }, title: label }, String(val));

function party(name, cls, items) {
  return h('div', { class: `party ${cls}` }, h('h4', {}, name), items.filter(Boolean).map(([k, v, secret]) => h('div', { class: `pv ${secret ? 'secret' : ''}` }, h('small', {}, k), v)));
}

export default {
  id: 'dh',
  title: 'Diffie–Hellman',
  slides: '52',
  category: 'Asymmetric ciphers',
  blurb: 'Two strangers agree on a shared secret key over a channel everyone can hear.',
  about: `<p><b>Diffie and Hellman</b> (1976; Malcolm Williamson at GCHQ found it first, but it was classified). Two parties establish a <b>shared key over an insecure channel</b> — usually then used as the key for a fast symmetric cipher like AES.</p>
<ol><li>Agree publicly on a prime p and generator g.</li><li>Alice picks secret a, sends A = gᵃ mod p. Bob picks secret b, sends B = gᵇ mod p.</li><li>Alice computes Bᵃ mod p, Bob computes Aᵇ mod p — the same number, gᵃᵇ mod p.</li></ol>
<p>Eve sees p, g, A and B, but recovering a or b is the <i>discrete logarithm problem</i>. The colours are the classic "paint mixing" analogy. <span class="ref">Ch. 5 slide 52</span></p>`,
  inputs: [
    { id: 'p', label: 'Public prime p', type: 'text', value: '23' },
    { id: 'g', label: 'Public generator g', type: 'text', value: '5' },
    { id: 'a', label: "Alice's secret a", type: 'text', value: '6' },
    { id: 'b', label: "Bob's secret b", type: 'text', value: '15' },
  ],
  actions: [{ id: 'run', label: 'Exchange keys' }],
  random: () => {
    const primes = [23, 47, 59, 83, 107, 167, 227, 359, 467, 563];
    const p = primes[Math.floor(Math.random() * primes.length)];
    return { p, g: 5, a: 2 + Math.floor(Math.random() * (p - 3)), b: 2 + Math.floor(Math.random() * (p - 3)) };
  },
  code: [
    'Alice and Bob publicly agree on p and g',
    'Alice: secret a;  A = gᵃ mod p  → send A',
    'Bob:   secret b;  B = gᵇ mod p  → send B',
    'Alice: s = Bᵃ mod p',
    'Bob:   s = Aᵇ mod p',
    'both now hold s = gᵃᵇ mod p',
  ],
  generate(_, v) {
    const p = toBig(v.p, 'p');
    const g = toBig(v.g, 'g');
    const a = toBig(v.a, 'a');
    const b = toBig(v.b, 'b');
    if (!isProbablePrime(p)) throw new Error(`p = ${p} must be prime.`);
    if (g < 2n || g >= p) throw new Error('g must be between 2 and p − 1.');
    if (a < 1n || b < 1n) throw new Error('Secrets must be at least 1.');
    const A = modPowTrace(g, a, p);
    const B = modPowTrace(g, b, p);
    const sA = modPowTrace(B.result, a, p);
    const sB = modPowTrace(A.result, b, p);
    const k = { p, g, a, b, A: A.result, B: B.result, sA: sA.result, sB: sB.result };
    return {
      steps: [
        { stage: 0, k, line: 0, msg: `Public parameters p = ${kbd(p)}, g = ${kbd(g)}. Everyone — including eavesdropper Eve — knows them.` },
        { stage: 1, k, tr: A, base: g, exp: a, line: 1, msg: `Alice picks secret a = ${a} and computes A = ${g}^${a} mod ${p} = ${kbd(A.result)}. She sends A in the clear.` },
        { stage: 2, k, tr: B, base: g, exp: b, line: 2, msg: `Bob picks secret b = ${b} and computes B = ${g}^${b} mod ${p} = ${kbd(B.result)}. He sends B in the clear.` },
        { stage: 3, k, tr: sA, base: B.result, exp: a, line: 3, msg: `Alice combines Bob's public B with her secret: ${B.result}^${a} mod ${p} = ${kbd(sA.result)}.` },
        { stage: 4, k, tr: sB, base: A.result, exp: b, line: 4, msg: `Bob combines Alice's public A with his secret: ${A.result}^${b} mod ${p} = ${kbd(sB.result)}.` },
        { stage: 5, k, line: 5, msg: `Shared secret ${kbd(sA.result)} ${sA.result === sB.result ? '✔' : '✘'} — and it was never sent. Eve only has p, g, A, B; she would need to solve a discrete logarithm.` },
      ],
    };
  },
  render(step, stage) {
    const { k } = step;
    const st = step.stage;
    stage.append(h('div', { class: 'col' },
      h('div', { class: 'parties' },
        party('Alice', 'alice', [
          ['public p, g', `${k.p}, ${k.g}`],
          st >= 1 && ['secret a', swatch(k.a, k.p, 'a'), true],
          st >= 1 && ['A = gᵃ mod p', swatch(k.A, k.p, 'A')],
          st >= 2 && ['received B', swatch(k.B, k.p, 'B')],
          st >= 3 && ['shared s = Bᵃ mod p', swatch(k.sA, k.p, 's')],
        ]),
        party('Public channel (Eve sees all)', 'eve', [
          ['p, g', `${k.p}, ${k.g}`],
          st >= 1 && ['A →', swatch(k.A, k.p, 'A')],
          st >= 2 && ['← B', swatch(k.B, k.p, 'B')],
          st >= 5 && ['s', h('span', { class: 'unknown' }, '??? (discrete log)')],
        ]),
        party('Bob', 'bob', [
          ['public p, g', `${k.p}, ${k.g}`],
          st >= 2 && ['secret b', swatch(k.b, k.p, 'b'), true],
          st >= 2 && ['B = gᵇ mod p', swatch(k.B, k.p, 'B')],
          st >= 1 && ['received A', swatch(k.A, k.p, 'A')],
          st >= 4 && ['shared s = Aᵇ mod p', swatch(k.sB, k.p, 's')],
        ])),
      step.tr && table(['bit of exponent', 'square', 'acc'], step.tr.rows.map((r) => [r.bit, String(r.squared), h('b', {}, String(r.acc))]), { compact: true }),
      step.tr && note(`${step.base}<sup>${step.exp}</sup> mod ${k.p} by square-and-multiply (exponent ${step.exp} = ${step.tr.bits}₂).`)));
  },
};
