// The VisuAlgo-style shell: input panel, stage, status, pseudocode trace and playback controls.
import { h } from './render.js';

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4, 8];
const BASE_DELAY = 1400;

export class Player {
  constructor(root, mod) {
    this.mod = mod;
    this.steps = [];
    this.code = [];
    this.i = 0;
    this.timer = null;
    this.speed = 1;
    this.ctx = {};
    this.root = root;
    this.build();
    this.onKey = this.onKey.bind(this);
    document.addEventListener('keydown', this.onKey);
    this.run(mod.actions[0].id);
  }

  destroy() {
    this.pause();
    document.removeEventListener('keydown', this.onKey);
  }

  build() {
    const m = this.mod;
    this.fields = {};
    const form = h('form', { class: 'inputs', onsubmit: (e) => { e.preventDefault(); this.run(m.actions[0].id); } },
      m.inputs.map((inp) => this.field(inp)));
    const actions = h('div', { class: 'actions-btns' },
      m.actions.map((a) => h('button', { type: 'button', class: 'btn primary', onclick: () => this.run(a.id) }, a.label)),
      m.random && h('button', { type: 'button', class: 'btn', title: 'Fill in random inputs', onclick: () => this.randomize() }, '🎲 Random'));

    this.stage = h('div', { class: 'stage-inner', 'aria-live': 'polite' });
    this.status = h('div', { class: 'status' });
    this.codeEl = h('ol', { class: 'code' });
    this.counter = h('span', { class: 'counter' });
    this.progress = h('input', { type: 'range', min: 0, max: 0, value: 0, class: 'progress', 'aria-label': 'Step', oninput: (e) => { this.pause(); this.go(+e.target.value); } });
    this.playBtn = h('button', { class: 'ctl play', title: 'Play / pause (Space)', onclick: () => this.toggle() }, '▶');
    const speedSel = h('select', { class: 'speed', title: 'Animation speed', onchange: (e) => { this.speed = +e.target.value; if (this.timer) { this.pause(); this.play(); } } },
      SPEEDS.map((sp) => h('option', { value: sp, selected: sp === 1 }, `${sp}×`)));

    this.root.replaceChildren(
      h('div', { class: 'viz' },
        h('aside', { class: 'left' },
          h('section', { class: 'card' },
            h('h2', { class: 'card-title' }, 'Input'),
            form,
            actions),
          h('details', { class: 'card about', open: true },
            h('summary', {}, 'About this algorithm'),
            h('div', { class: 'about-body', html: m.about }))),
        h('main', { class: 'stage' }, this.stage),
        h('aside', { class: 'right' },
          h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'What is happening'), this.status),
          h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Pseudocode'), this.codeEl))),
      h('footer', { class: 'controls' },
        h('div', { class: 'ctl-group' },
          h('button', { class: 'ctl', title: 'First step (Home)', onclick: () => { this.pause(); this.go(0); } }, '⏮'),
          h('button', { class: 'ctl', title: 'Previous step (←)', onclick: () => { this.pause(); this.go(this.i - 1); } }, '◀'),
          this.playBtn,
          h('button', { class: 'ctl', title: 'Next step (→)', onclick: () => { this.pause(); this.go(this.i + 1); } }, '▶❘'),
          h('button', { class: 'ctl', title: 'Last step (End)', onclick: () => { this.pause(); this.go(this.steps.length - 1); } }, '⏭')),
        this.progress,
        this.counter,
        h('label', { class: 'speed-wrap' }, 'Speed ', speedSel)));
    this.syncVisibility();
  }

  field(inp) {
    const id = `in-${inp.id}`;
    let el;
    const onChange = () => this.syncVisibility();
    if (inp.type === 'select') {
      el = h('select', { id, onchange: onChange }, inp.options.map((o) => {
        const [value, label] = Array.isArray(o) ? o : [o, o];
        return h('option', { value, selected: String(value) === String(inp.value) }, label);
      }));
    } else if (inp.type === 'textarea') {
      el = h('textarea', { id, rows: inp.rows || 3, spellcheck: 'false' });
      el.value = inp.value ?? '';
    } else if (inp.type === 'file') {
      el = h('input', { id, type: 'file', accept: inp.accept || '' });
    } else {
      el = h('input', { id, type: inp.type === 'number' ? 'number' : 'text', value: inp.value ?? '', min: inp.min, max: inp.max, step: inp.step, spellcheck: 'false', autocomplete: 'off' });
    }
    this.fields[inp.id] = { el, inp, wrap: null };
    const wrap = h('label', { class: 'field', for: id }, h('span', { class: 'field-label' }, inp.label), el, inp.help && h('span', { class: 'field-help' }, inp.help));
    this.fields[inp.id].wrap = wrap;
    return wrap;
  }

  values() {
    const v = {};
    for (const [k, { el, inp }] of Object.entries(this.fields)) {
      if (inp.type === 'file') v[k] = el.files?.[0] || null;
      else if (inp.type === 'number') v[k] = el.value === '' ? NaN : Number(el.value);
      else v[k] = el.value;
    }
    return v;
  }

  syncVisibility() {
    const v = this.values();
    for (const { inp, wrap } of Object.values(this.fields)) {
      if (inp.when) wrap.hidden = !inp.when(v);
    }
  }

  randomize() {
    const vals = this.mod.random(this.values());
    for (const [k, val] of Object.entries(vals)) if (this.fields[k]) this.fields[k].el.value = val;
    this.syncVisibility();
    this.run(this.mod.actions[0].id);
  }

  async run(actionId) {
    this.pause();
    const values = this.values();
    try {
      const res = await this.mod.generate(actionId, values);
      if (!res.steps.length) throw new Error('Nothing to show - check the inputs.');
      this.ctx = { action: actionId, values, ...res.ctx };
      this.steps = res.steps;
      this.code = res.code || (Array.isArray(this.mod.code) ? this.mod.code : this.mod.code[actionId]) || [];
      this.codeEl.replaceChildren(...this.code.map((line) => h('li', {}, h('code', {}, line))));
      this.progress.max = this.steps.length - 1;
      this.go(0);
      if (res.autoplay !== false && this.steps.length > 1) this.play();
    } catch (err) {
      console.error(err);
      this.status.replaceChildren(h('div', { class: 'error' }, '⚠ ', err.message));
    }
  }

  go(i) {
    if (!this.steps.length) return;
    this.i = Math.max(0, Math.min(this.steps.length - 1, i));
    const step = this.steps[this.i];
    this.stage.replaceChildren();
    this.mod.render(step, this.stage, this.ctx);
    this.status.innerHTML = step.msg || '';
    const lines = step.line == null ? [] : [].concat(step.line);
    [...this.codeEl.children].forEach((li, j) => li.classList.toggle('active', lines.includes(j)));
    this.codeEl.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
    this.progress.value = this.i;
    this.counter.textContent = `Step ${this.i + 1} / ${this.steps.length}`;
    if (this.i === this.steps.length - 1) this.pause();
  }

  play() {
    if (this.i >= this.steps.length - 1) this.go(0);
    this.playBtn.textContent = '⏸';
    const tick = () => {
      const dwell = this.steps[this.i]?.dwell || 1;
      this.timer = setTimeout(() => {
        this.go(this.i + 1);
        if (this.timer) tick();
      }, (BASE_DELAY * dwell) / this.speed);
    };
    tick();
  }

  pause() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.playBtn) this.playBtn.textContent = '▶';
  }

  toggle() {
    this.timer ? this.pause() : this.play();
  }

  onKey(e) {
    if (e.target.closest('input, textarea, select')) return;
    if (e.target.closest('button') && e.key === ' ') return;
    const map = {
      ' ': () => this.toggle(),
      ArrowRight: () => { this.pause(); this.go(this.i + 1); },
      ArrowLeft: () => { this.pause(); this.go(this.i - 1); },
      Home: () => { this.pause(); this.go(0); },
      End: () => { this.pause(); this.go(this.steps.length - 1); },
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  }
}
