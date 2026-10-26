import { makeShiftCipher } from './caesar.js';

export default makeShiftCipher({
  id: 'rot13',
  title: 'ROT13',
  slides: '28',
  fixedShift: 13,
  blurb: 'Caesar with a fixed shift of 13. Applying it twice gives back the original.',
  about: `<p>ROT13 is a Caesar cipher whose shift is always <b>13</b> — half the alphabet — so encrypting and decrypting are the same operation.</p>
<p><code>A CAT</code> → <code>N PNG</code>. There is no key at all, so it only hides text from a casual glance (spoilers, puzzle answers). <span class="ref">Ch. 5 slide 28</span></p>`,
});
