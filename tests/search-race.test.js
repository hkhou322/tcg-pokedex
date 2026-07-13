const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.className = '';
    this.style = {};
    this.listeners = {};
    this.children = [];
    this._html = '';
  }
  set innerHTML(value) { this._html = value; this.children = []; }
  get innerHTML() { return this._html; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  dispatch(type) { if (this.listeners[type]) this.listeners[type]({ target: this }); }
  appendChild(child) { this.children.push(child); }
  querySelectorAll(selector) {
    if (selector === '.skeleton' && this._html.includes('skeleton')) return new Array(10).fill({});
    return [];
  }
  querySelector() { return null; }
  getAttribute() { return null; }
}

const ids = ['card-grid', 'search', 'type-filter', 'set-filter', 'result-count', 'load-more', 'card-modal', 'modal-body'];
const elements = Object.fromEntries(ids.map(id => [id, new FakeElement(id)]));
const documentListeners = {};
const document = {
  body: { style: {} },
  querySelector(selector) {
    if (selector === 'meta[name="poketcg-api-key"]') return { content: '' };
    return null;
  },
  querySelectorAll() { return []; },
  getElementById(id) { return elements[id]; },
  createElement() { return new FakeElement(); },
  addEventListener(type, fn) { documentListeners[type] = fn; }
};

const requests = [];
function fetch(url) {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  requests.push({ url, resolve });
  return promise;
}
function response(data, totalCount) {
  return { ok: true, json: () => Promise.resolve({ data, totalCount }) };
}
function card(name) {
  return { name, hp: '60', types: ['Colorless'], number: '1', set: { name: 'Test' }, images: {} };
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

(async () => {
  const source = fs.readFileSync('app.js', 'utf8');
  const context = { document, fetch, AbortController, URLSearchParams, setTimeout, clearTimeout, console };
  vm.runInNewContext(source, context, { filename: 'app.js' });
  documentListeners.DOMContentLoaded();

  // Initial unfiltered request is requests[0]. Start a partial "P" query.
  elements.search.value = 'P';
  elements.search.dispatch('input');
  await sleep(380);
  assert(requests.some(r => r.url.includes('q=name%3AP*')), 'partial P query did not start');
  const pRequest = requests.find(r => r.url.includes('q=name%3AP*'));

  // User finishes typing before P* returns. The old response must be invalidated immediately,
  // not 350ms later when the replacement fetch starts.
  elements.search.value = 'Psyduck';
  elements.search.dispatch('input');
  pRequest.resolve(response([card('Pidgeot')], 1735));
  await sleep(0);
  await sleep(0);

  assert.notStrictEqual(
    elements['result-count'].textContent,
    'Showing 1 of 1735',
    'stale P* response rendered while textbox already said Psyduck'
  );

  await sleep(380);
  const psyduckRequest = requests.find(r => r.url.includes('q=name%3APsyduck*'));
  assert(psyduckRequest, 'Psyduck request did not start');
  psyduckRequest.resolve(response([card('Psyduck')], 38));
  await sleep(0);
  await sleep(0);
  assert.strictEqual(elements['result-count'].textContent, 'Showing 1 of 38');
  console.log('PASS: stale partial search cannot render after the input changes');
})().catch(err => { console.error(err.stack || err); process.exit(1); });
