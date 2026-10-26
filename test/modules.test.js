import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHMS, CATEGORIES } from '../public/js/algos/index.js';

const defaults = (mod) => Object.fromEntries(mod.inputs.map((i) => [i.id, i.type === 'number' ? Number(i.value) : i.type === 'file' ? null : i.value ?? '']));

test('every module declares the shared interface', () => {
  const ids = new Set();
  for (const m of ALGORITHMS) {
    assert.ok(m.id && !ids.has(m.id), `unique id ${m.id}`);
    ids.add(m.id);
    for (const key of ['title', 'blurb', 'about', 'slides']) assert.ok(m[key], `${m.id}.${key}`);
    assert.ok(CATEGORIES.some((c) => c.name === m.category), `${m.id} category`);
    assert.equal(typeof m.generate, 'function');
    assert.equal(typeof m.render, 'function');
    assert.ok(m.actions.length);
  }
});

// The LSB module needs <canvas>; it is covered by the browser smoke test instead.
for (const m of ALGORITHMS.filter((a) => a.id !== 'lsb')) {
  for (const action of m.actions) {
    test(`${m.id} / ${action.id} generates steps with default inputs`, async () => {
      const res = await m.generate(action.id, defaults(m));
      assert.ok(res.steps.length > 0);
      const code = res.code || (Array.isArray(m.code) ? m.code : m.code[action.id]);
      assert.ok(code?.length, 'has pseudocode');
      for (const s of res.steps) {
        assert.equal(typeof s.msg, 'string');
        for (const ln of [].concat(s.line ?? [])) assert.ok(ln >= 0 && ln < code.length, `line ${ln} in range`);
      }
    });
  }
}

test('decrypting the default ciphertext round-trips', async () => {
  const byId = Object.fromEntries(ALGORITHMS.map((a) => [a.id, a]));
  const last = (r) => r.steps.at(-1);
  const des = byId.des;
  const enc = await des.generate('encrypt', defaults(des));
  assert.match(last(enc).msg, /85E813540F0AB405/);
  const aes = byId.aes;
  assert.match(last(await aes.generate('encrypt', defaults(aes))).msg, /69C4E0D86A7B0430D8CDB78070B4C55A/);
  const rsa = byId.rsa;
  assert.match((await rsa.generate('full', defaults(rsa))).steps.at(-1).msg, /Matches the original/);
  assert.match(last(await byId.kasiski.generate('run', defaults(byId.kasiski))).msg, /HORSE/);
});
