// Small DOM toolkit shared by every visualization.

const SVG_NS = 'http://www.w3.org/2000/svg';

function build(el, attrs, kids, isSvg) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') isSvg ? el.setAttribute('class', v) : (el.className = v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const h = (tag, attrs, ...kids) => build(document.createElement(tag), attrs, kids, false);
export const s = (tag, attrs, ...kids) => build(document.createElementNS(SVG_NS, tag), attrs, kids, true);

/** One labelled box. `cls` adds state classes like "hl", "src", "dst", "dim", "new". */
export const cell = (text, cls = '', sub = null, top = null) =>
  h('div', { class: `cell ${cls}` }, top != null && h('span', { class: 'cell-top' }, top), h('span', { class: 'cell-main' }, text), sub != null && h('span', { class: 'cell-sub' }, sub));

/** A labelled row of cells. items: array of strings or { t, cls, sub, top }. */
export function strip(label, items, extraClass = '') {
  return h(
    'div',
    { class: `strip ${extraClass}` },
    label && h('div', { class: 'strip-label' }, label),
    h('div', { class: 'strip-cells' }, items.map((it) => (typeof it === 'object' ? cell(it.t, it.cls, it.sub, it.top) : cell(it)))),
  );
}

/** Bits rendered in groups. clsFn(i, bit) -> class string. */
export function bitRow(label, bits, { group = 8, clsFn = () => '', hex = true } = {}) {
  const groups = [];
  for (let i = 0; i < bits.length; i += group) {
    const g = bits.slice(i, i + group);
    let hexLabel = null;
    if (hex && group % 4 === 0) {
      hexLabel = '';
      for (let j = 0; j < g.length; j += 4) hexLabel += parseInt(g.slice(j, j + 4).join(''), 2).toString(16).toUpperCase();
    }
    groups.push(
      h('div', { class: 'bit-group' },
        h('div', { class: 'bits' }, g.map((b, j) => h('span', { class: `bit b${b} ${clsFn(i + j, b)}` }, b))),
        hexLabel != null && h('div', { class: 'bit-hex' }, hexLabel)),
    );
  }
  return h('div', { class: 'bitrow' }, label && h('div', { class: 'strip-label' }, label), h('div', { class: 'bit-groups' }, groups));
}

export const panel = (title, ...kids) => h('section', { class: 'panel' }, title && h('h3', { class: 'panel-title' }, title), ...kids);
export const row = (...kids) => h('div', { class: 'row' }, ...kids);
export const col = (...kids) => h('div', { class: 'col' }, ...kids);
export const note = (html) => h('div', { class: 'note', html });
export const op = (sym) => h('div', { class: 'op-sym' }, sym);
export const math = (html) => h('div', { class: 'math', html });

/** Plain table. rows: arrays of cell content; rowCls(i) for highlighting. */
export function table(headers, rows, { rowCls = () => '', cellCls = () => '', compact = false } = {}) {
  return h('table', { class: `data ${compact ? 'compact' : ''}` },
    headers && h('thead', {}, h('tr', {}, headers.map((x) => h('th', {}, x)))),
    h('tbody', {}, rows.map((r, i) => h('tr', { class: rowCls(i) }, r.map((c, j) => h('td', { class: cellCls(i, j) }, c))))));
}

/** Byte background tint so diffusion is visible at a glance. */
export const byteHue = (b) => `hsl(${Math.round((b / 256) * 360)} 70% 50% / 0.28)`;

/** 4x4 AES-style byte grid; state[r + 4c]. */
export function byteGrid(label, bytes, { clsFn = () => '', tint = true } = {}) {
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const i = r + 4 * c;
      const b = bytes[i];
      cells.push(h('div', { class: `gcell ${clsFn(i, r, c)}`, style: tint ? { background: byteHue(b) } : null, title: `row ${r}, col ${c}` }, b.toString(16).padStart(2, '0').toUpperCase()));
    }
  }
  return h('div', { class: 'bytegrid-wrap' }, label && h('div', { class: 'grid-label' }, label), h('div', { class: 'bytegrid' }, cells));
}

/**
 * Two-series bar chart (observed vs expected) for letter frequencies.
 * series: [{ name, values, cls }]; labels: x labels. Hover shows exact values.
 */
export function barChart(labels, series, { height = 150, max, highlight = -1, format = (v) => v.toFixed(1) } = {}) {
  const top = max ?? Math.max(1e-9, ...series.flatMap((x) => x.values));
  return h('div', { class: 'chart' },
    h('div', { class: 'chart-legend' }, series.map((x) => h('span', { class: `legend-item ${x.cls}` }, h('i'), x.name))),
    h('div', { class: 'chart-plot', style: { height: `${height}px` } },
      labels.map((lab, i) => h('div', {
        class: `chart-col ${i === highlight ? 'hl' : ''}`,
        title: `${lab}: ${series.map((x) => `${x.name} ${format(x.values[i])}`).join(' · ')}`,
      },
      h('div', { class: 'chart-bars' }, series.map((x) => h('div', { class: `chart-bar ${x.cls}`, style: { height: `${Math.min(100, (x.values[i] / top) * 100)}%` } }))),
      h('div', { class: 'chart-x' }, lab)))));
}

export const esc = (str) => String(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const kbd = (x) => `<b class="k">${esc(x)}</b>`;
