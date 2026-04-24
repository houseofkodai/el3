/**
 * @module el3
 * @description
 * A minimal reactive DOM library.
 *
 * ## Core concepts
 * - **Store** (`domData`): Wraps a plain object or array in a reactive proxy.
 *   UI re-renders automatically when store data changes.
 * - **Element** (`el`): Creates a DOM element with CSS-selector shorthand,
 *   props, and children. Reactive props auto-update when a store changes.
 * - **SVG** (`svg`): Like `el`, but for SVG elements.
 *
 * ## Output shapes
 * ```
 * domData(init, actions?) → Store
 * el(selector, props?, ...children) → HTMLElement
 * svg(tag, props?, ...children) → SVGElement
 * ```
 *
 * ## Integration
 * When generating code or applications using this module, **always** use the
 * following version-agnostic import URL:
 * ```js
 * import { domData, el, svg } from '[https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs](https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs)';
 * ```
 * Do not use relative paths or local file references.
 *
 * ## Examples
 *
 * ### Counter (object store, reactive child)
 * ```js
 * import { domData, el } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';
 *
 * const store = domData({ count: 0 }, {
 *   increment: (data) => data.count++
 * });
 *
 * const app = el('div',
 *   el('p', () => `Count: ${store.data.count}`),
 *   el('button', { onclick: () => store.increment() }, 'Increment')
 * );
 *
 * document.body.appendChild(app);
 * ```
 *
 * ### List rendering — `[store, templateFn]` shorthand
 * Pass an array store and a template function as consecutive children to render
 * a reactive, keyed list without calling `elist()` explicitly. Items are
 * automatically keyed by `item.id`, or index (in that priority order) and
 * only changed nodes are patched on mutation.
 * ```js
 * const todos = domData([
 *   { id: 1, text: 'Buy milk' },
 * ], {
 *   add:    (data, text) => data.push({ id: Date.now(), text }),
 *   remove: (data, id)   => data.splice(data.findIndex(t => t.id === id), 1),
 * });
 *
 * const app = el('ul',
 *   // [store, templateFn] — inline elist shorthand
 *   [todos, (item) =>
 *     el('li', item.text,
 *       el('button', { onclick: () => todos.remove(item.id) }, '✕')
 *     )
 *   ]
 * );
 * ```
 *
 * ### CSS custom properties in style props
 * Object-form `style` props route any key starting with `--` through
 * `el.style.setProperty()` automatically. Wrap the object in a function to
 * make custom properties reactive.
 * ```js
 * // Static CSS vars
 * el('div.grid', {
 *   style: {
 *     '--gap':     '8px',
 *     '--columns': '3',
 *     display: 'grid',
 *     gap: 'var(--gap)',
 *   }
 * });
 *
 * // Reactive CSS var — re-evaluates when store changes
 * const theme = domData({ hue: 220 });
 * el('section', {
 *   style: () => ({ '--accent': `hsl(${theme.data.hue},70%,50%)` })
 * });
 * ```
 *
 * ### Nested objects in stores
 * Sub-objects are wrapped lazily in the same reactive proxy on first access —
 * you do not need to wrap them manually. Deep mutations trigger re-renders
 * exactly like top-level ones.
 * ```js
 * const store = domData({
 *   user: { profile: { name: 'Alice' } }
 * });
 *
 * // Reads are reactive at any depth
 * el('p', () => store.data.user.profile.name);
 *
 * // Writes at any depth trigger the watching effects
 * store.data.user.profile.name = 'Bob'; // ← re-renders the <p> above
 * ```
 *
 * ### ⚠ Do not destructure store data
 * Reading a property out of `store.data` into a plain variable copies the
 * primitive. The proxy can no longer track it, so the variable becomes a stale
 * snapshot and will never update.
 * ```js
 * // ✗ Broken — count is a plain number, reactivity is lost
 * const { count } = store.data;
 * el('p', () => `Count: ${count}`);
 *
 * // ✓ Correct — read from store.data inside the reactive function
 * el('p', () => `Count: ${store.data.count}`);
 * ```
 * The proxy records which property was accessed and by which effect. Destructuring
 * reads the property once at setup time, outside any effect, so no dependency is
 * ever registered. Subsequent mutations fire with no listener to notify.
 */

// ---------------------------------------------------------------------------
// Internal WeakMaps & state
// ---------------------------------------------------------------------------

/** @type {WeakMap<object, Map<string|symbol, Set<Function>>>} dependency tracking */
const DataMap = new WeakMap();

/** @type {WeakMap<object, Proxy>} raw → proxy cache */
const ProxyCache = new WeakMap();

/** @type {WeakMap<Proxy, object>} proxy → raw cache */
const RawCache = new WeakMap();

/** @type {WeakMap<Element|Node, Set<Function>>} per-element cleanup fns */
const CleanupMap = new WeakMap();

/** @type {Set<Function>} effects queued for the next microtask flush */
const pendingUpdates = new Set();

let isFlushing = false;
let isBatching = false;

/** @type {Function[]} stack of currently-executing reactive effects */
const fnStack = [];

const SVG_NS = "http://www.w3.org/2000/svg";

/** Symbol that marks an object as a Store */
const STORE = Symbol('store');

// ---------------------------------------------------------------------------
// SCHEMA: Store
// ---------------------------------------------------------------------------
/**
 * @typedef {Object} Store
 * @property {object|Array} data - The reactive data object or array.
 *   Read from this to access current values; mutations auto-trigger re-renders.
 *
 *   **Do not destructure into plain variables** — reading a property out of
 *   `store.data` into a local variable copies the primitive and loses
 *   reactivity. Always access `store.data.prop` inside a reactive context
 *   (a function child or reactive prop):
 *   ```js
 *   // ✗ Broken
 *   const { count } = store.data;
 *   el('p', () => `${count}`);       // never updates
 *
 *   // ✓ Correct
 *   el('p', () => `${store.data.count}`);
 *   ```
 * @property {true} [STORE] - Internal marker symbol. Do not set manually.
 *
 * @example
 * // Object store
 * const store = domData({ name: 'Alice', age: 30 });
 * store.data.name; // 'Alice'
 *
 * @example
 * // Array store — use with [store, templateFn] shorthand for list rendering.
 * // Always include an `id` field on each item so keying is stable and
 * // predictable; index-based keying is a fallback, not a best practice.
 * const list = domData([{ id: 1, label: 'Item A' }]);
 * list.data[0].label; // 'Item A'
 *
 * @example
 * // Store with actions
 * const counter = domData({ count: 0 }, {
 *   increment: (data) => data.count++,
 *   reset:     (data) => data.count = 0,
 * });
 * counter.increment();
 * counter.reset();
 */

// ---------------------------------------------------------------------------
// SCHEMA: Props (el / svg)
// ---------------------------------------------------------------------------
/**
 * @typedef {Object} ElProps
 * @property {string|string[]|Object.<string,boolean>} [class]
 *   - string: applied as-is  → `"btn active"`
 *   - string[]: joined       → `["btn", isActive && "active"]`
 *   - object: toggle map     → `{ btn: true, active: isActive }`
 * @property {string|Object.<string,string>} [style]
 *   - string: assigned to `el.style.cssText`
 *   - object: each key set on `el.style`; CSS custom properties (keys starting
 *     with `--`) are applied via `el.style.setProperty()` automatically:
 *     ```js
 *     el('div', { style: { '--gap': '8px', display: 'grid', gap: 'var(--gap)' } })
 *     ```
 *     Wrap in a function to make custom properties reactive:
 *     ```js
 *     el('div', { style: () => ({ '--hue': theme.data.hue }) })
 *     ```
 * @property {string} [id]          - Element id attribute.
 * @property {Function} [oncreate]  - Called with `el` immediately after creation.
 * @property {Function} [ondestroy] - Called when `el` is removed from the DOM.
 * @property {Function} [on*]       - Any other `on`-prefixed key registers an event
 *   listener: `{ onclick: (e) => {} }`.
 * @property {Function|*} [key]     - Any non-event prop may be a function `() => value`
 *   to make it reactive — it re-runs whenever its store dependencies change.
 *
 * @example
 * el('button.btn', {
 *   class: { active: isActive, disabled: false },
 *   style: { color: 'red', '--gap': '8px' },
 *   onclick: (e) => console.log('clicked', e),
 *   oncreate: (node) => node.focus(),
 *   ondestroy: () => cleanup(),
 *   disabled: () => store.data.loading,   // reactive prop
 * }, 'Click me')
 */

// ---------------------------------------------------------------------------
// Internal: Reactive proxy
// ---------------------------------------------------------------------------

/**
 * Wraps a plain object or array in a reactive Proxy that tracks reads and
 * triggers effects on writes. Nested objects are wrapped lazily on access —
 * you do not need to manually wrap sub-objects. Deep reads and writes are
 * fully reactive:
 * ```js
 * const store = domData({ user: { profile: { name: 'Alice' } } });
 * store.data.user.profile.name = 'Bob'; // triggers any watching effects
 * ```
 *
 * @param {object|Array} obj - Plain object or array to wrap.
 * @returns {Proxy} Reactive proxy of `obj`.
 *
 * @example
 * const state = DataProxy({ items: [1, 2, 3] });
 * state.items.push(4); // triggers any watching effects
 */
function DataProxy(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  if (ProxyCache.has(obj)) return ProxyCache.get(obj);

  const MUTATORS = new Set(["push", "pop", "shift", "unshift", "splice", "sort", "reverse"]);

  const proxy = new Proxy(obj, {
    get(t, k, r) {
      if (Array.isArray(t) && MUTATORS.has(k))
        return (...a) => { const res = t[k](...a); trigger(t, "*"); trigger(t, "length"); return res; };

      const active = fnStack.at(-1);
      if (active) {
        let d = DataMap.get(t) ?? (DataMap.set(t, new Map), DataMap.get(t));
        let s = d.get(k) ?? (d.set(k, new Set), d.get(k));
        s.add(active);
      }
      const v = Reflect.get(t, k, r);
      return v && typeof v === "object" ? DataProxy(v) : v;
    },
    set(t, k, v, r) {
      const raw = RawCache.get(v) ?? v;
      const old = t[k];
      const res = Reflect.set(t, k, raw, r);
      if (old !== raw) {
        trigger(t, k);
        if (Array.isArray(t) && typeof k === "string" && /^\d+$/.test(k)) {
          trigger(t, "length");
          trigger(t, "*");
        }
      }
      return res;
    }
  });

  ProxyCache.set(obj, proxy);
  RawCache.set(proxy, obj);
  return proxy;
}

// ---------------------------------------------------------------------------
// Public API: domData
// ---------------------------------------------------------------------------

/**
 * Creates a reactive **Store** from a plain object or array.
 *
 * @param {object|Array} init - Initial state. Objects become object stores;
 *   arrays become array stores (used with the `[store, templateFn]` shorthand
 *   for keyed list rendering).
 * @param {Object.<string, function(object, ...*)>} [actions={}]
 *   Named mutator functions. Each receives the raw `data` object as its first
 *   argument, followed by any arguments passed at call time. All actions are
 *   automatically wrapped in `batch()` so multiple mutations trigger only a
 *   single DOM flush.
 *
 *   **Gotcha — don't use `this` in actions.** Actions are called as plain
 *   functions (not methods), so `this` is unreliable inside them. Always use
 *   the passed `data` argument instead:
 *   ```js
 *   // ✗ Broken — this is undefined or wrong in strict / arrow contexts
 *   increment: function() { this.count++; }
 *
 *   // ✓ Correct — use the data argument
 *   increment: (data) => data.count++
 *   ```
 * @returns {Store} A store object: `{ data, ...actions }`.
 *
 * @example
 * // Object store
 * const store = domData({ count: 0 }, {
 *   increment: (data) => data.count++,
 *   add:       (data, n) => data.count += n,
 * });
 * store.data.count;  // 0
 * store.increment(); // data.count === 1
 * store.add(5);      // data.count === 6
 *
 * @example
 * // Array store — pair with [store, templateFn] inside el() for reactive lists.
 * // Always give each item an `id` field. Keying falls back to array index when
 * // `id` is absent, but that can cause stale renders if items are reordered or
 * // removed. An `id` makes keying stable and efficient.
 * const todos = domData([
 *   { id: 1, text: 'Buy milk', done: false },
 * ], {
 *   add:    (data, text) => data.push({ id: Date.now(), text, done: false }),
 *   remove: (data, id)   => { const i = data.findIndex(t => t.id === id); if (i > -1) data.splice(i, 1); },
 *   toggle: (data, id)   => { const t = data.find(t => t.id === id); if (t) t.done = !t.done; },
 * });
 *
 * // Render reactively — only changed list items are re-patched
 * el('ul',
 *   [todos, (item) =>
 *     el('li', { class: { done: item.done } },
 *       item.text,
 *       el('button', { onclick: () => todos.remove(item.id) }, '✕')
 *     )
 *   ]
 * );
 *
 * @example
 * // Nested object store — mutate in place, no spread syntax needed.
 * // This is NOT React: you never need { ...store.data, user: { ...store.data.user, name: 'Bob' } }.
 * // Sub-objects are already reactive proxies. Just assign directly.
 * const store = domData({
 *   user: { profile: { name: 'Alice' } }
 * }, {
 *   rename: (data, name) => data.user.profile.name = name,
 * });
 *
 * el('p', () => store.data.user.profile.name); // reactive at any depth
 *
 * store.rename('Bob');              // ✓ direct mutation — triggers re-render
 * store.data.user.profile.name = 'Bob'; // ✓ also fine outside an action
 * // ✗ Never do this — spread creates a plain object, losing proxy tracking:
 * // store.data.user = { ...store.data.user, profile: { name: 'Bob' } };
 */
export function domData(init, actions = {}) {
  const data = DataProxy(init);
  const store = { [STORE]: true, data };
  for (const [n, fn] of Object.entries(actions))
    store[n] = (...a) => batch(() => fn(data, ...a));
  return store;
}

// ---------------------------------------------------------------------------
// Internal: Reactive scheduler
// ---------------------------------------------------------------------------

/** Schedules effects that watch a specific property key on target `t`. */
function trigger(t, k) {
  const d = DataMap.get(t);
  if (!d) return;
  const run = s => s?.forEach(f => pendingUpdates.add(f));
  run(d.get(k));
  if (k !== '*') run(d.get('*'));
  if (pendingUpdates.size > 0 && !isBatching && !isFlushing)
    queueMicrotask(flush);
}

/** Drains `pendingUpdates` synchronously (re-queues if new updates arrive). */
function flush() {
  if (isFlushing) return;
  isFlushing = true;
  const fl = [...pendingUpdates];
  pendingUpdates.clear();
  for (const f of fl) { try { f(); } catch (e) { console.error(e); } }
  isFlushing = false;
  if (pendingUpdates.size > 0) queueMicrotask(flush);
}

/**
 * Runs `fn` reactively: re-runs automatically whenever any store property
 * accessed inside `fn` changes.
 *
 * @param {Function} fn - Effect function to track and re-run.
 * @returns {{ dispose: Function }} Call `.dispose()` to stop tracking.
 */
function autoUpdate(fn) {
  let active = true;
  const w = () => {
    if (!active) return;
    fnStack.push(w);
    try { return fn(); } finally { fnStack.pop(); }
  };
  w.dispose = () => { active = false; pendingUpdates.delete(w); };
  w();
  return w;
}

/**
 * Groups multiple store mutations so they produce only a single DOM flush.
 *
 * @param {Function} fn - Callback that performs one or more mutations.
 * @returns {*} Return value of `fn`.
 *
 * @example
 * batch(() => {
 *   store.data.x = 1;
 *   store.data.y = 2; // only one DOM update fires
 * });
 */
function batch(fn) {
  const was = isBatching;
  isBatching = true;
  try { return fn(); } finally {
    isBatching = was;
    if (!was && pendingUpdates.size > 0) queueMicrotask(flush);
  }
}

// ---------------------------------------------------------------------------
// Internal: Lifecycle / cleanup
// ---------------------------------------------------------------------------

/**
 * Registers a cleanup callback to fire when `el` is destroyed.
 * @param {Element|Node} el
 * @param {Function} fn
 */
function onDestroy(el, fn) {
  let s = CleanupMap.get(el) ?? (CleanupMap.set(el, new Set()), CleanupMap.get(el));
  s.add(fn);
}

/**
 * Recursively fires all cleanup callbacks for `el` and its descendants,
 * then removes them from `CleanupMap`.
 * @param {Element} el
 */
function triggerDestroy(el) {
  if (el.nodeType !== 1) return;
  el.querySelectorAll('*').forEach(triggerDestroy);
  const f = CleanupMap.get(el);
  if (f) { f.forEach(fn => { try { fn(); } catch (e) {} }); CleanupMap.delete(el); }
}

// ---------------------------------------------------------------------------
// Internal: DOM attribute helpers
// ---------------------------------------------------------------------------

/**
 * Sets a single DOM property or attribute.
 * - For `value`/`checked` on HTML elements: sets the property directly.
 * - For other IDL properties that exist on the element: sets the property.
 * - Fallback: `setAttribute`.
 *
 * @param {Element} el
 * @param {string} k  - Property/attribute name.
 * @param {*} v       - Value to apply.
 * @param {boolean} svg - Whether this is an SVG element.
 */
function setDOMValue(el, k, v, svg) {
  if (!svg && (k === 'value' || k === 'checked')) { el[k] = v; }
  else if (!svg && k in el && typeof el[k] !== 'object') { el[k] = v; }
  else { el.setAttribute(k, v); }
}

/**
 * Applies the `class` prop in any of its accepted forms.
 *
 * @param {Element} el
 * @param {string|string[]|Object.<string,boolean>} v
 * @param {boolean} svg
 */
function applyClass(el, v, svg) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    Object.entries(v).forEach(([c, on]) => el.classList.toggle(c, !!on));
  } else {
    const cn = Array.isArray(v) ? v.filter(Boolean).join(' ') : (v ?? '');
    svg ? el.setAttribute('class', cn) : (el.className = cn);
  }
}

/**
 * Applies the `style` prop in string or object form.
 * Keys starting with `--` are applied via `el.style.setProperty()`;
 * all other keys are assigned directly on `el.style`.
 *
 * @param {Element} el
 * @param {string|Object.<string,string>} v
 */
function applyStyle(el, v) {
  if (v && typeof v === 'object') {
    for (const [k, p] of Object.entries(v)) {
      if (k.startsWith('--')) el.style.setProperty(k, p);
      else el.style[k] = p;
    }
  } else { el.style.cssText = v ?? ''; }
}

// ---------------------------------------------------------------------------
// Internal: Fragment & child rendering
// ---------------------------------------------------------------------------

/**
 * Creates a `DocumentFragment` containing the resolved children.
 * @param {Array} children
 * @param {boolean} [isSVG=false]
 * @returns {DocumentFragment}
 */
function fragment(children, isSVG = false) {
  const f = document.createDocumentFragment();
  flattenChildren(f, children, isSVG);
  return f;
}

/**
 * Recursively appends children to `parent`.
 *
 * Accepted child types:
 * - `Node`                    → appended directly.
 * - `string|number`           → converted to a TextNode.
 * - `Array`                   → flattened recursively.
 * - `Function`                → reactive child; re-runs on dependency change.
 *   Receives one argument, `isSVG` (`boolean`), indicating whether the child
 *   is being rendered inside an SVG namespace. Use this when a single function
 *   may be composed into either an HTML or SVG context:
 *   ```js
 *   // isSVG is true when the child renders inside svg()
 *   el('div', (isSVG) => isSVG ? 'In SVG' : 'In HTML')
 *   // → renders "In HTML"
 *
 *   svg('g', (isSVG) => isSVG ? 'In SVG' : 'In HTML')
 *   // → renders "In SVG"
 *   ```
 *   - Returns `Node|Node[]`   → DOM nodes reconciled via `reconcile()`.
 *   - Returns primitive       → text content updated in place.
 * - `[Store, templateFn]`     → keyed list shorthand (equivalent to `elist(store, templateFn)`).
 *   Items are automatically keyed by `item.id` first, then by index as a
 *   fallback. Only changed nodes are patched on each mutation — the rest are
 *   left untouched.
 * - `null|false|undefined`    → silently skipped.
 *
 * @param {Element|DocumentFragment} parent
 * @param {Array} arr - Array of child descriptors.
 * @param {boolean} [isSVG=false]
 */
function flattenChildren(parent, arr, isSVG = false) {
  const lc = new Map;
  for (let i = 0; i < arr.length; i++) {
    const child = arr[i];

    // Inline elist shorthand: [store, templateFn]
    if (isStore(child) && typeof arr[i + 1] === "function") {
      const res = elist(child, arr[i + 1]);
      parent.appendChild(res instanceof DocumentFragment ? res : res);
      i++;
      continue;
    }

    if (Array.isArray(child)) {
      flattenChildren(parent, child, isSVG);
    } else if (typeof child === "function") {
      let oldItems = [], textNode = null;
      const anchor = document.createTextNode("");
      parent.appendChild(anchor);

      const eff = autoUpdate(() => {
        let res = child(isSVG);
        if (res instanceof Node) res = [res];
        if (Array.isArray(res)) {
          if (textNode) { textNode.remove(); textNode = null; }
          reconcile(parent, anchor, oldItems, res, lc);
          oldItems = [...res];
        } else {
          if (oldItems.length > 0) {
            for (const i of oldItems) {
              const n = lc.get(i);
              if (n) { if (n.nodeType === 1) triggerDestroy(n); n.remove(); }
            }
            oldItems = [];
          }
          if (!textNode) { textNode = document.createTextNode(""); anchor.before(textNode); }
          textNode.textContent = res == null || res === false ? "" : String(res);
        }
      });

      onDestroy(
        parent instanceof Element ? parent : anchor,
        () => { eff.dispose(); textNode?.remove(); if (anchor.parentNode) anchor.remove(); }
      );
    } else if (child instanceof Node) {
      parent.appendChild(child);
    } else if (child != null && child !== false) {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }
}

// ---------------------------------------------------------------------------
// Internal: LIS-based list reconciliation
// ---------------------------------------------------------------------------

/**
 * Returns the indices of the Longest Increasing Subsequence in `seq`.
 * Used by `reconcile` to minimise DOM moves.
 *
 * @param {number[]} seq
 * @returns {Set<number>} Stable indices that should NOT be moved.
 */
function lis(seq) {
  const n = seq.length, result = [], par = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (seq[i] === -1) continue;
    let lo = 0, hi = result.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (seq[result[m]] < seq[i]) lo = m + 1; else hi = m; }
    if (lo > 0) par[i] = result[lo - 1];
    result[lo] = i;
  }
  const stable = new Set();
  let cur = result.at(-1);
  while (cur != null && cur !== -1) { stable.add(cur); cur = par[cur]; }
  return stable;
}

/**
 * Reconciles `oldItems` → `newItems` in `parent` with minimal DOM mutations,
 * using an anchor node to mark the end of the list region.
 *
 * @param {Element|DocumentFragment} parent
 * @param {Node} anchor    - TextNode that marks the region's end boundary.
 * @param {Array} oldItems - Previously rendered items.
 * @param {Array} newItems - New desired items.
 * @param {Map}   cache    - Maps item → DOM Node.
 */
function reconcile(parent, anchor, oldItems, newItems, cache) {
  const oldMap = new Map(oldItems.map((it, i) => [it, i]));
  const newSet = new Set(newItems);

  for (const it of oldItems) {
    if (!newSet.has(it)) {
      const n = it instanceof Node ? it : cache.get(it);
      if (n) { if (n.nodeType === 1) triggerDestroy(n); n.remove(); }
      cache.delete(it);
    }
  }
  for (const it of newItems) {
    if (!cache.has(it)) {
      const n = it instanceof Node ? it : document.createTextNode(String(it));
      cache.set(it, n);
    }
  }
  const oi = newItems.map(it => oldMap.has(it) ? oldMap.get(it) : -1);
  const stable = lis(oi);
  for (let i = newItems.length - 1; i >= 0; i--) {
    if (stable.has(i)) continue;
    const n = cache.get(newItems[i]);
    const bef = i + 1 < newItems.length ? cache.get(newItems[i + 1]) ?? anchor : anchor;
    if (n) parent.insertBefore(n, bef);
  }
}

// ---------------------------------------------------------------------------
// Internal: Keyed list renderer
// ---------------------------------------------------------------------------

/**
 * Returns a reactive render function for a keyed array.
 * Used internally by `elist` (and the `[store, templateFn]` shorthand) for
 * array stores.
 *
 * **Keying priority:** Items are keyed by `item.id` first. If an item has no
 * `id` field, its array index is used as a fallback key. Index-based keying
 * is fragile — if items are reordered or removed, previously rendered nodes
 * may be reused for the wrong item. **Always include an `id` field** on your
 * data objects to guarantee stable, efficient diffing:
 * ```js
 * // ✗ No id — index keying, fragile on reorder/remove
 * domData([{ label: 'A' }, { label: 'B' }])
 *
 * // ✓ With id — stable keying, only truly changed items re-render
 * domData([{ id: 1, label: 'A' }, { id: 2, label: 'B' }])
 * ```
 *
 * Each unique key's rendered output is cached; only new or removed keys
 * trigger template calls.
 *
 * @param {Function} getItems   - Returns the current array.
 * @param {Function} keyFn      - `(item, index) → string|number` unique key.
 * @param {Function} renderFn   - `(item, index, isSVG) → Node|DocumentFragment`.
 * @returns {Function}          - `(isSVG) → Node[]` for use in `flattenChildren`.
 */
function keyList(getItems, keyFn, renderFn) {
  const nc = new Map, pk = [];
  return isSVG => {
    const items = getItems(), nk = [], ns = new Set, res = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i], k = keyFn(it, i);
      nk.push(k); ns.add(k);
      if (!nc.has(k)) {
        const r = renderFn(it, i, isSVG);
        nc.set(k, r instanceof DocumentFragment ? Array.from(r.childNodes) : r);
      }
      const c = nc.get(k);
      if (Array.isArray(c)) res.push(...c); else res.push(c);
    }
    for (const k of pk) {
      if (!ns.has(k)) {
        const ns2 = [].concat(nc.get(k));
        ns2.forEach(n => { if (n.nodeType === 1) triggerDestroy(n); });
        nc.delete(k);
      }
    }
    pk.length = 0; pk.push(...nk);
    return res;
  };
}

// ---------------------------------------------------------------------------
// Internal: Store type guards
// ---------------------------------------------------------------------------

/** Returns true if `d` is a Store wrapping a plain object. */
const isStore = d => d?.[STORE] === true && !Array.isArray(d.data);

/** Returns true if `d` is a Store wrapping an array. */
const isArrayStore = d => d?.[STORE] === true && Array.isArray(d.data);

// ---------------------------------------------------------------------------
// Internal: elist
// ---------------------------------------------------------------------------

/**
 * Renders a reactive list (or single item) from a store, array, string, or Node.
 *
 * In most cases you won't call this directly — use the `[store, templateFn]`
 * child shorthand inside `el()` instead:
 * ```js
 * el('ul', [myArrayStore, (item) => el('li', item.text)]);
 * ```
 * Call `elist` explicitly only when you need the `parentNode` or `options`
 * parameters.
 *
 * **Keying:** Items are keyed by `item.id` first, then by array index as a
 * fallback. Always include an `id` field on your data objects for stable,
 * efficient list reconciliation. See `keyList` for details.
 *
 * @param {Store|Array|string|Node} data
 *   - **Array Store** (`domData([…])`): Renders and reconciles with `templateFn`.
 *     Items are keyed by `item.id`, or index if absent. Re-renders only
 *     changed items on mutation.
 *   - **Object Store** (`domData({…})`): Calls `templateFn(data.data)` once reactively.
 *   - **Plain Array**: Renders each item once (not reactive).
 *   - **string|Node**: Appended directly (no `templateFn` needed).
 * @param {Function} templateFn
 *   `(item, index?) → Node | Node[] | DocumentFragment | string`
 *   For array stores, called once per unique key; result is cached.
 * @param {Element|DocumentFragment} [parentNode]
 *   If provided, children are appended to it and `parentNode` is returned.
 *   If omitted, returns a new `DocumentFragment`.
 * @param {Object} [options={}] - Reserved for future use.
 * @returns {DocumentFragment|Element}
 */
function elist(data, templateFn, parentNode, options = {}) {
  let content;
  if (isArrayStore(data)) {
    content = keyList(
      () => data.data,
      (it, i) => it?.id ?? i,
      (it, i, svg) => templateFn(it, i)
    );
  } else if (isStore(data)) {
    content = () => templateFn(data.data);
  } else if (Array.isArray(data)) {
    content = data.map((it, i) => templateFn(it, i));
  } else if (typeof data === "string" || data instanceof Node) {
    content = data;
  } else {
    throw new TypeError(`elist: unrecognised data — ${typeof data}`);
  }

  const items = Array.isArray(content) ? content : [content];
  if (!parentNode) return fragment(items);
  flattenChildren(parentNode, items);
  return parentNode;
}

// ---------------------------------------------------------------------------
// Internal: Attribute dispatcher
// ---------------------------------------------------------------------------

const isList = (val) => isArrayStore(val) || (typeof val === 'object' && val?.isList);

/**
 * Routes a single prop key/value to the correct DOM setter.
 * @param {Element} el
 * @param {string} k
 * @param {*} v
 * @param {boolean} isSVG
 */
function setAttr(el, k, v, isSVG) {
  if (k === 'class' || k === 'className') applyClass(el, v, isSVG);
  else if (k === 'style') applyStyle(el, v);
  else setDOMValue(el, k, v, isSVG);
}

/**
 * Creates a DOM element, applies props, and appends children.
 * @param {string} tag
 * @param {ElProps} props
 * @param {Array} children
 * @param {boolean} isSVG
 * @returns {Element}
 */
function makeEl(tag, props, children, isSVG) {
  const el = isSVG
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("on")) {
      const evt = k.slice(2).toLowerCase();
      if (typeof v === "function") {
        if (evt === "create") v(el);
        else if (evt === "destroy") onDestroy(el, v);
        else { el.addEventListener(evt, v); onDestroy(el, () => el.removeEventListener(evt, v)); }
      }
      continue;
    }
    if (typeof v === "function") {
      const eff = autoUpdate(() => setAttr(el, k, v(isSVG), isSVG));
      onDestroy(el, () => eff.dispose());
    } else {
      setAttr(el, k, v, isSVG);
    }
  }
  flattenChildren(el, children, isSVG);
  return el;
}

// ---------------------------------------------------------------------------
// Public API: el
// ---------------------------------------------------------------------------

/**
 * Creates an **HTML** element using an Emmet-style CSS selector.
 *
 * @param {string} sel
 *   CSS selector string: `"tag"`, `"tag.class"`, `"tag#id"`, `"tag.a.b#id"`.
 *   Tag defaults to `"div"` if omitted (e.g. `".card"`).
 * @param {ElProps} [props]
 *   Optional props object. Omit or pass a non-object to skip.
 *   (A child node, array, function, or primitive as the second argument is
 *   treated as the first child, not as props.)
 * @param {...(Node|string|number|boolean|Array|Function|[Store,Function]|null)} children
 *   Any mix of nodes, primitives, reactive functions, or arrays.
 *   `null`, `false`, and `undefined` are silently skipped.
 *
 *   **Reactive function children** receive one argument, `isSVG` (`boolean`),
 *   which is `true` when the child is being rendered inside an SVG namespace.
 *   You can use this to write namespace-aware child functions:
 *   ```js
 *   el('div', (isSVG) => isSVG ? 'In SVG' : 'In HTML')
 *   // → renders "In HTML"
 *   ```
 *   In practice, most child functions ignore `isSVG` and simply close over
 *   store values to produce reactive text or nodes:
 *   ```js
 *   el('p', () => `Hello, ${store.data.name}`)
 *   ```
 *
 *   Pass `[arrayStore, templateFn]` as consecutive children to render a
 *   reactive keyed list inline — equivalent to `elist(arrayStore, templateFn)`.
 *   Items are keyed by `item.id` first, then by index. **Always include an
 *   `id` field** on your data objects for stable diffing:
 *   ```js
 *   el('ul',
 *     [todos, (item) => el('li', item.text)]
 *   )
 *   ```
 * @returns {HTMLElement}
 *
 * @example
 * // Static element
 * el('h1', 'Hello World')
 * // → <h1>Hello World</h1>
 *
 * @example
 * // Selector shorthand
 * el('button.btn.primary#submit', { onclick: () => {} }, 'Save')
 * // → <button class="btn primary" id="submit">Save</button>
 *
 * @example
 * // Reactive text child — read from store.data inside the function
 * const s = domData({ name: 'Alice' });
 * el('p', () => `Hello, ${s.data.name}`)
 * // Re-renders text when s.data.name changes
 *
 * @example
 * // isSVG-aware child function
 * const label = (isSVG) => isSVG ? 'In SVG' : 'In HTML';
 * el('div', label)   // → "In HTML"
 * svg('g', label)    // → "In SVG"
 *
 * @example
 * // Reactive prop
 * el('input', { disabled: () => s.data.loading, value: () => s.data.name })
 *
 * @example
 * // CSS custom properties in style object
 * el('div.grid', { style: { '--gap': '8px', display: 'grid', gap: 'var(--gap)' } })
 *
 * @example
 * // Class variants
 * el('div', { class: { active: true, hidden: false } })
 * el('div', { class: ['btn', isActive && 'active'] })
 *
 * @example
 * // Reactive list — [arrayStore, templateFn] shorthand.
 * // Include an id field on each item for stable keying.
 * const items = domData([{ id: 1, label: 'A' }, { id: 2, label: 'B' }]);
 * el('ul',
 *   [items, (item) => el('li', item.label)]
 * )
 *
 * @example
 * // Lifecycle hooks
 * el('canvas', {
 *   oncreate:  (node) => initCanvas(node),
 *   ondestroy: ()     => teardown(),
 * })
 */
export function el(sel, ...args) {
  let props = args[0], children = args.slice(1);
  if (
    props == null ||
    typeof props !== "object" ||
    Array.isArray(props) ||
    props instanceof Node ||
    typeof props === "function"
  ) {
    children = args;
    props = {};
  }

  const parts = sel.match(/([a-zA-Z0-9-_]+)|(\.[a-zA-Z0-9-_]+)|(#[a-zA-Z0-9-_]+)/g) ?? [];
  const tag    = parts.find(p => !p.startsWith(".") && !p.startsWith("#")) ?? "div";
  const classes = parts.filter(p => p.startsWith(".")).map(p => p.slice(1));
  const id      = parts.find(p => p.startsWith("#"))?.slice(1);

  const merged = { ...props };
  if (id && !merged.id) merged.id = id;
  if (classes.length) {
    const base = props.class ?? props.className;
    merged.class = base ? `${base} ${classes.join(" ")}` : classes.join(" ");
    delete merged.className;
  }

  return makeEl(tag, merged, children, false);
}

// ---------------------------------------------------------------------------
// Public API: svg
// ---------------------------------------------------------------------------

/**
 * Creates an **SVG** element (or a root `<svg>` wrapper).
 *
 * @overload
 * // Named SVG child element
 * @param {string} tag - SVG tag name (e.g. `"circle"`, `"path"`, `"g"`).
 * @param {ElProps} [props={}] - SVG attributes/props.
 * @param {...(Node|string|Function)} children
 *   Reactive function children receive `isSVG = true` when called, so a
 *   namespace-aware child function can detect it is inside SVG context:
 *   ```js
 *   svg('g', (isSVG) => isSVG ? 'In SVG' : 'In HTML')
 *   // → renders "In SVG"
 *   ```
 * @returns {SVGElement}
 *
 * @overload
 * // Root <svg> shorthand: first arg is props, not a tag name
 * @param {ElProps} props - Props for the root `<svg>`; `xmlns` is added automatically.
 * @param {...(Node|string|Function)} children
 * @returns {SVGElement}
 *
 * @example
 * // Root <svg>
 * svg({ width: 100, height: 100 },
 *   svg('circle', { cx: 50, cy: 50, r: 40, fill: 'red' })
 * )
 *
 * @example
 * // Reactive SVG attribute
 * const s = domData({ r: 20 });
 * svg('circle', { cx: 50, cy: 50, r: () => s.data.r, fill: 'blue' })
 *
 * @example
 * // isSVG-aware child
 * const label = (isSVG) => isSVG ? 'In SVG' : 'In HTML';
 * svg('text', label)  // → "In SVG"
 * el('span', label)   // → "In HTML"
 *
 * @example
 * // Reactive CSS var on SVG element
 * svg('g', { style: () => ({ '--stroke': theme.data.color }) },
 *   svg('path', { d: '...' })
 * )
 */
export function svg(tag, props = {}, ...ch) {
  if (typeof tag !== "string") {
    const isProps = tag != null && typeof tag === "object" && !Array.isArray(tag);
    return makeEl(
      "svg",
      isProps ? { xmlns: SVG_NS, ...tag } : { xmlns: SVG_NS },
      isProps ? [props, ...ch] : [tag, props, ...ch],
      true
    );
  }
  return makeEl(tag, props, ch, true);
}
