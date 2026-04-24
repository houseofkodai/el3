# El3: Element, List, Logic — less is more
### AI native UI framework * no build step * no dependency * no framework tax

```html
<script type="module">
  import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

  const count = domData({ n: 0 });

  document.body.appendChild(
    el('div',
      el('h1', () => `Count: ${count.data.n}`),
      el('button', { onclick: () => count.data.n++ }, '+1')
    )
  );
</script>
```

Drop that into any `.html` file, open it in a browser. That's the whole setup.

---

## Contents

- [Why El3](#why-el3)
- [How It Thinks](#how-it-thinks)
- [Getting Started](#getting-started)
- [A Quick Tour](#a-quick-tour)
- [Routing for Single-Page Apps](#routing-for-single-page-apps)
- [Component Patterns for Composability](#component-patterns-for-composability)
- [Building LLM-Powered UIs](#building-llm-powered-uis)
- [Integrating Third-Party Libraries](#integrating-third-party-libraries-oncreate--ondestroy)
- [Common Gotchas](#common-gotchas)
- [Q&A](#qa)
- [How It Works Internally](#how-it-works-internally)

---

## Why El3

You're building a moderately interactive UI. React feels like hiring a construction crew to hang a picture frame. Vue needs a build pipeline. Vanilla JS event listeners turn into a bowl of spaghetti by week two.

El3 asks: what if reactivity was just *data that knows when it changes*, and the DOM just *listened*?

That's the whole library. About 200 lines of plain JavaScript. No compiler. No `node_modules`. No opinions about your folder structure.

---

## How It Thinks

El3 has three parts that map to its name:

**`el` — Element.** A function for building DOM nodes. CSS-selector shorthand, props, reactive bindings, event handlers — all in one call, no JSX required.

**`elist` — List.** Renders collections efficiently. Give it an array store and a template function; it handles keyed diffing and cleanup automatically.

**`domData` — Logic (reactive data).** Wraps a plain object in a reactive proxy. When properties change, anything that read them re-runs. This is the "Logic" engine of El3. No explicit subscriptions. No `setState`. No diffing the entire tree.

The engine underneath is a classic *dependency-tracking* loop: when a reactive function runs, El3 records which data keys it touched. When those keys change, only that function re-runs. It's the same idea behind Vue's `ref`, Solid's signals, and MobX — just much smaller.

---

## Getting Started

**Option 1 — CDN (no install needed)**

```html
<script type="module">
  import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';
</script>
```

**Option 2 — Download the file**

Grab [`el3.js`](./el3.js) and drop it anywhere in your project:

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';
```

**Option 3 — Clone and explore examples**

```bash
git clone https://github.com/yourname/el3.git
cd el3
# open any file in examples/ directly in your browser — no server needed
```

The `examples/` folder contains standalone HTML files you can open directly — no dev server required.

> **Browser requirement:** Any modern browser (Chrome, Firefox, Safari, Edge). El3 uses ES modules and `Proxy` — both are universally supported. No IE.

---

## A Quick Tour

### Reactive data with `domData`

```js
import { domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

const counter = domData({ count: 0 }, {
  increment: (data) => data.count++,
  decrement: (data) => data.count--,
});

// Read state
console.log(counter.data.count); // 0

// Call an action
counter.increment();
console.log(counter.data.count); // 1
```

`domData` takes an initial value and an optional map of *actions*. Actions are the recommended way to mutate data — all mutations inside an action flush together, avoiding unnecessary intermediate renders.

---

### Building DOM with `el`

```js
import { el } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

// el(selector, props?, ...children)
const btn = el('button.primary#go',
  { onclick: () => counter.increment() },
  'Click me'
);

document.body.appendChild(btn);
```

The selector shorthand (`tag.class#id`) keeps noise low. Props are plain objects. Children are strings, nodes, or *functions*.

---

### Reactive bindings — the key idea

**Wrap any prop value or child in a function** and El3 auto-tracks it. When the data it reads changes, only that piece of the DOM updates.

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

const store = domData({ count: 0 });

const view = el('div',
  el('p', () => `Count: ${store.data.count}`),     // ← reactive child
  el('button', { onclick: () => store.data.count++ }, '+')
);

document.body.appendChild(view);
```

- Plain value → rendered once, never updates.
- **Function → re-runs whenever its reactive dependencies change.**

This is the rule beginners trip over most. When in doubt, wrap it in `() =>`.

---

### Lists with array stores

For lists, initialise `domData` with an **array** and pass it directly to `el` along with a template function:

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

const todos = domData([
  { id: 1, text: 'Buy oat milk' },
  { id: 2, text: 'Write docs' },
], {
  add:    (data, text) => data.push({ id: Date.now(), text }),
  remove: (data, id)  => data.splice(data.findIndex(t => t.id === id), 1),
});

const list = el('ul', todos, (item) =>
  el('li',
    el('span', () => item.text),        // ← () => for property-level reactivity
    el('button', { onclick: () => todos.remove(item.id) }, '✕')
  )
);

document.body.appendChild(list);
```

> **Important distinction:** Array stores handle *structural* changes — adding, removing, and reordering items — with keyed diffing. If you also want individual *properties* on an item to update reactively (e.g. `item.text` changing in place), wrap those in functions too: `() => item.text`. A plain string `item.text` is captured at render time and won't update.

El3 keys list items by `id`, then falls back to index. Always give items stable `id` fields to avoid unnecessary DOM mutations on reorder.

---

### Cleanup

El3 tracks cleanup automatically — reactive effects are disposed when their element is removed. You can also register manual teardown:

```js
el('div', {
  ondestroy: () => clearInterval(timer)
}, 'Self-cleaning element')
```

---

## Routing for Single-Page Apps

El3 has no built-in router — and doesn't need one. The browser already has a routing primitive: `location` and the `popstate` event. A small reactive store wrapping those gives you a full SPA router in ~20 lines.

### The minimal router store

```js
import { domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

const router = domData(
  { path: location.pathname, query: new URLSearchParams(location.search) },
  {
    navigate: (data, path) => {
      history.pushState({}, '', path);
      data.path = path;
      data.query = new URLSearchParams('');
    },
  }
);

// Keep store in sync with browser back/forward
window.addEventListener('popstate', () => {
  router.navigate(location.pathname);
});

export default router;
```

`router.data.path` is reactive — anything that reads it will re-run when the route changes.

---

### Rendering routes reactively

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';
import router from './router.js';

// Define your page components (just functions that return nodes)
const Home    = () => el('div', el('h1', 'Home'), el('p', 'Welcome.'));
const About   = () => el('div', el('h1', 'About'), el('p', 'We are El3.'));
const NotFound = () => el('div', el('h1', '404'), el('p', 'Nothing here.'));

const routes = {
  '/':      Home,
  '/about': About,
};

// The outlet — re-renders whenever path changes
const app = el('div',
  el('nav',
    el('a', { href: '/', onclick: e => { e.preventDefault(); router.navigate('/'); } }, 'Home'),
    el('a', { href: '/about', onclick: e => { e.preventDefault(); router.navigate('/about'); } }, 'About'),
  ),
  el('main',
    () => {
      const Page = routes[router.data.path] ?? NotFound;
      return Page();
    }
  )
);

document.body.appendChild(app);
```

The `() => { ... }` child in `el('main', ...)` is a reactive function — it re-runs on every path change, tears down the old page node, and mounts the new one. El3's cleanup system handles `ondestroy` on the outgoing page automatically.

---

### Route parameters

For paths like `/post/42`, match against the current path manually or with a tiny helper:

```js
function matchRoute(pattern, path) {
  const patParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patParts.length; i++) {
    if (patParts[i].startsWith(':')) {
      params[patParts[i].slice(1)] = pathParts[i];
    } else if (patParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// Usage inside the reactive outlet
() => {
  const path = router.data.path;

  // Try static routes first
  if (routes[path]) return routes[path]();

  // Try parameterised routes
  const params = matchRoute('/post/:id', path);
  if (params) return PostPage(params);  // PostPage receives { id: '42' }

  return NotFound();
}
```

---

### Link helper

Repeating the `onclick` / `preventDefault` pattern on every anchor gets tedious. Extract it:

```js
import { el } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';
import router from './router.js';

export const Link = (href, label, props = {}) =>
  el('a', {
    href,
    ...props,
    onclick: e => { e.preventDefault(); router.navigate(href); },
  }, label);

// Usage
Link('/about', 'About us')
Link('/post/1', 'Read post', { class: 'featured' })
```

---

### Active link styling

Because `router.data.path` is reactive, class bindings on links update automatically:

```js
export const NavLink = (href, label) =>
  el('a', {
    href,
    class: () => router.data.path === href ? 'active' : '',
    onclick: e => { e.preventDefault(); router.navigate(href); },
  }, label);
```

---

### Hash-based routing (no server config needed)

If your host can't redirect all paths to `index.html` (GitHub Pages, simple static hosts), use hash routing instead:

```js
const router = domData(
  { path: location.hash.slice(1) || '/' },
  {
    navigate: (data, path) => {
      location.hash = path;
      data.path = path;
    },
  }
);

window.addEventListener('hashchange', () => {
  router.navigate(location.hash.slice(1) || '/');
});
```

Everything else stays the same — just swap `history.pushState` URLs for `#/about` style hrefs.

---

## Component Patterns for Composability

El3 has no component system — components are just **functions that return DOM nodes**. That's not a limitation; it's the composability model. This section covers the patterns intermediate developers reach for once the basics click.

---

### The basic component

A component is a function. It takes props, closes over a store if needed, and returns a node:

```js
// Card.js
import { el } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

export const Card = ({ title, body, footer }) =>
  el('div.card',
    el('h2.card-title', title),
    el('p.card-body', body),
    footer ? el('div.card-footer', footer) : null
  );

// Usage
Card({ title: 'Hello', body: 'World', footer: Link('/more', 'Read more') })
```

Children passed as props are just nodes — compose freely.

---

### Stateful components with a local store

For components that own their own state, create a `domData` store inside the function. Each call gets its own isolated store:

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

export const Accordion = ({ sections }) => {
  const state = domData({ open: null });

  return el('div.accordion',
    ...sections.map(({ title, content }) =>
      el('div.section',
        el('button', {
          class: () => state.data.open === title ? 'open' : '',
          onclick: () => {
            state.data.open = state.data.open === title ? null : title;
          }
        }, title),
        el('div.content', {
          style: () => ({ display: state.data.open === title ? 'block' : 'none' })
        }, content)
      )
    )
  );
};
```

Two `Accordion` instances on the same page each have their own `state` — no shared state, no naming collisions.

---

### Slot pattern (default + named slots)

Pass child content as props to get named slots — the same idea as Web Components slots or Vue's `<slot>`, but just function arguments:

```js
import { el } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

export const Modal = ({ title, children, footer, onclose }) =>
  el('div.modal-overlay', { onclick: onclose },
    el('div.modal', {
      onclick: e => e.stopPropagation()   // don't close when clicking inside
    },
      el('div.modal-header',
        el('h2', title),
        el('button.close', { onclick: onclose }, '✕')
      ),
      el('div.modal-body', children),     // default slot
      footer
        ? el('div.modal-footer', footer)  // named slot
        : null
    )
  );

// Usage
Modal({
  title: 'Confirm',
  children: el('p', 'Are you sure you want to delete this?'),
  footer: el('div',
    el('button', { onclick: () => doDelete() }, 'Yes, delete'),
    el('button', { onclick: () => closeModal() }, 'Cancel'),
  ),
  onclose: () => closeModal(),
})
```

---

### Higher-order components — wrapping behaviour

A higher-order component (HOC) is a function that takes a component function and returns a new one with added behaviour. Useful for cross-cutting concerns like loading states, error boundaries, or auth gating:

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

// Wraps any async-data component with a loading/error shell
export const withAsync = (fetchFn, renderFn) => {
  const state = domData({ data: null, loading: true, error: null });

  fetchFn()
    .then(data  => { state.data.data = data; state.data.loading = false; })
    .catch(err  => { state.data.error = err.message; state.data.loading = false; });

  return el('div',
    () => {
      if (state.data.loading) return el('p.loading', 'Loading…');
      if (state.data.error)   return el('p.error', `Error: ${state.data.error}`);
      return renderFn(state.data.data);
    }
  );
};

// Usage
withAsync(
  () => fetch('/api/user').then(r => r.json()),
  (user) => el('div.profile',
    el('h1', () => user.name),
    el('p',  () => user.bio)
  )
)
```

---

### Context pattern — sharing state without prop drilling

When deeply nested components need access to the same store, prop-drilling gets painful. Use a module-level store as implicit context — since ES modules are singletons, any file that imports the store gets the same instance:

```js
// context/theme.js
import { domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

export const theme = domData(
  { mode: 'light', accent: '#0077ff' },
  {
    toggle: (state) => { state.mode = state.mode === 'light' ? 'dark' : 'light'; }
  }
);

// DeepChild.js — no props needed, just import
import { el } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';
import { theme } from '../context/theme.js';

export const ThemedButton = (label, onclick) =>
  el('button', {
    class: () => `btn btn-${theme.data.mode}`,
    style: () => ({ borderColor: theme.data.accent }),
    onclick,
  }, label);
```

This is the El3 equivalent of React Context or Vue's `provide/inject` — without any API surface at all.

---

### Render prop pattern — inversion of control

When a component needs to delegate rendering of its inner content to the caller, pass a function instead of a node:

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

// VirtualList only renders items currently in view
export const VirtualList = ({ items, rowHeight, renderItem }) => {
  const state = domData({ scrollTop: 0, height: 400 });

  const visible = () => {
    const start = Math.floor(state.data.scrollTop / rowHeight);
    const count = Math.ceil(state.data.height / rowHeight) + 1;
    return items.slice(start, start + count).map((item, i) =>
      el('div', {
        style: { position: 'absolute', top: `${(start + i) * rowHeight}px`, height: `${rowHeight}px` }
      }, renderItem(item))   // ← caller decides how to render each row
    );
  };

  return el('div.vlist', {
    style: { position: 'relative', height: `${state.data.height}px`, overflowY: 'scroll' },
    onscroll: e => { state.data.scrollTop = e.target.scrollTop; }
  },
    () => visible()
  );
};

// Usage — caller owns the row rendering
VirtualList({
  items: myBigArray,
  rowHeight: 48,
  renderItem: (item) => el('span', item.name),
})
```

---

### Composing it all together

These patterns layer cleanly because they're all just functions and closures:

```js
// A themed, async-loaded, modal-wrapped user profile
Modal({
  title: 'User Profile',
  children: withAsync(
    () => fetch(`/api/user/${id}`).then(r => r.json()),
    (user) => el('div.profile',
      el('img', { src: () => user.avatar }),
      el('h2', () => user.name),
      ThemedButton('Follow', () => followUser(user.id))
    )
  ),
  onclose: () => closeModal(),
});
```

No framework magic. Just functions calling functions.

---

## Building LLM-Powered UIs

El3's no-build-step design makes it uniquely well suited for LLM-driven interfaces. Two patterns come up constantly.

---

### Pattern 1 — Streaming chat UI

A streaming LLM response is just a string that grows chunk by chunk. A reactive store + a watching text node is a perfect fit — each chunk appends to state, and only the text node re-renders.

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

const chat = domData(
  { messages: [], streaming: '' },
  {
    appendChunk:   (state, chunk) => { state.streaming += chunk; },
    commitMessage: (state, role)  => {
      state.messages.push({ id: Date.now(), role, text: state.streaming });
      state.streaming = '';
    },
  }
);

// Stream from any LLM API that returns a ReadableStream
async function ask(prompt) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
    headers: { 'Content-Type': 'application/json' },
  });

  const reader = res.body.getReader();
  const dec = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chat.appendChunk(dec.decode(value));   // reactive update on every chunk
  }

  chat.commitMessage('assistant');
}

// UI
const app = el('div.chat',
  // History list — updates when messages array changes
  el('ul.messages', chat, (msg) =>
    el('li', { class: () => msg.role },
      el('span', () => msg.text)
    )
  ),

  // Live streaming bubble — updates on every chunk
  el('div.bubble.streaming', () => chat.data.streaming),

  el('div.input-row',
    el('input#prompt', { type: 'text', placeholder: 'Ask something…' }),
    el('button', {
      onclick: () => {
        const input = document.querySelector('#prompt');
        ask(input.value);
        input.value = '';
      }
    }, 'Send')
  )
);

document.body.appendChild(app);
```

The streaming bubble re-renders on every chunk with zero framework overhead. When the stream ends, `commitMessage` moves the text into the history list and clears the bubble.

---

### Pattern 2 — AI-generated DOM (LLM writes El3 code)

Because El3 requires no build step, an LLM can *generate El3 code as a string* and you can render it live in the browser. This is something JSX-based frameworks fundamentally cannot do.

The pattern: prompt the LLM to return a self-contained El3 snippet → eval it in a sandboxed function → mount the result.

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

// Expose el and domData so generated code can use them
window.__el3 = { el, domData };

async function generateWidget(description) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      system: `You are an expert in El3, a minimal reactive DOM library.
El3 is available as window.__el3 = { el, domData }.
Return ONLY a JavaScript expression (no markdown, no imports) that evaluates
to a DOM Node built with el() and domData(). Example:
  (() => {
    const { el, domData } = window.__el3;
    const s = domData({ count: 0 });
    return el('div',
      el('p', () => \`Count: \${s.data.count}\`),
      el('button', { onclick: () => s.data.count++ }, '+')
    );
  })()`,
      prompt: description,
    }),
    headers: { 'Content-Type': 'application/json' },
  });

  const { code } = await res.json();

  // Sandboxed eval — only expose what you intend
  try {
    const node = new Function(`"use strict"; return (${code})`)();
    if (node instanceof Node) return node;
    throw new Error('Generated code did not return a DOM Node');
  } catch (e) {
    console.error('Generation failed:', e);
    return el('p.error', `Could not render: ${e.message}`);
  }
}

// Usage
const container = el('div#widget-host');
document.body.appendChild(container);

generateWidget('a color picker that shows the hex value reactively')
  .then(node => container.appendChild(node));
```

> **Security note:** `eval` and `new Function` execute arbitrary code. Only use this pattern with LLM output you control (your own API proxy), never with user-supplied strings. Consider running generated code in a sandboxed `<iframe>` for production use.

**Why El3 is uniquely suited here:**
- No compiler or build step means the entire library is available at runtime.
- The `el` / `domData` API is small enough that an LLM can learn it from a short system prompt.
- Generated code is plain JavaScript — readable, debuggable, no magic syntax.

---

## Integrating Third-Party Libraries (`oncreate` / `ondestroy`)

The `oncreate` prop gives you the raw DOM node at creation time. Use it to hand a node to any library that manages its own rendering.

### Chart.js

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';
import Chart from 'https://cdn.jsdelivr.net/npm/chart.js/+esm';

const store = domData({ values: [12, 40, 28, 65] });
let chart;

const canvas = el('canvas', {
  oncreate: (node) => {
    chart = new Chart(node, {
      type: 'bar',
      data: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [{ data: store.data.values }],
      },
    });
  },
  ondestroy: () => chart?.destroy(),

  // Reactive sync — re-runs whenever values changes
  'data-sync': () => {
    if (!chart) return;
    chart.data.datasets[0].data = [...store.data.values];
    chart.update();
    return '';
  },
});

document.body.appendChild(canvas);
```

### CodeMirror 6

```js
import { el } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';
import { EditorView, basicSetup } from 'codemirror';

let editor;

const container = el('div.editor-host', {
  oncreate: (node) => {
    editor = new EditorView({
      doc: '// start typing...',
      extensions: [basicSetup],
      parent: node,
    });
  },
  ondestroy: () => editor?.destroy(),
});

document.body.appendChild(container);
```

### Mapbox GL

```js
import { el } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'YOUR_TOKEN';
let map;

const mapDiv = el('div#map', {
  style: { width: '100%', height: '400px' },
  oncreate: (node) => {
    // Mapbox reads layout dimensions — defer until node is in the document
    requestAnimationFrame(() => {
      map = new mapboxgl.Map({
        container: node,
        style: 'mapbox://styles/mapbox/streets-v12',
      });
    });
  },
  ondestroy: () => map?.remove(),
});

document.body.appendChild(mapDiv);
```

### Key rules for `oncreate`

- **Fires before DOM insertion.** Don't read layout (dimensions, `offsetWidth`) — use `requestAnimationFrame` if the library needs a laid-out node.
- **Always pair with `ondestroy`** for libraries that allocate GPU resources, WebSockets, or event listeners.
- **Fires once.** If your element is conditionally rendered and re-created, a new `oncreate` fires — but you need `ondestroy` to clean up the old instance.
- **Don't mix El3 children inside a third-party-owned subtree.** If CodeMirror or Mapbox owns the DOM inside a node, don't also pass El3 children into that same node.

---

## Common Gotchas

These are the mistakes almost every El3 beginner hits at least once.

**1. Forgetting `() =>` and wondering why the DOM doesn't update**

```js
// ❌ Captured once at render time — never updates
el('p', store.data.count)

// ✅ Reactive — re-runs when count changes
el('p', () => store.data.count)
```

When in doubt, wrap it.

---

**2. Mutating state in a loop outside an action**

```js
// ❌ Triggers a separate microtask render for each item
for (const item of newItems) {
  store.data.list.push(item);
}

// ✅ Batched — one render after all mutations
store.bulkAdd(newItems);  // define this as a domData action
```

---

**3. Passing a plain array to `elist` vs. an array store**

```js
// ❌ Plain array — rendered once, won't react to changes
const items = [{ id: 1, text: 'hello' }];
el('ul', items, (item) => el('li', item.text))

// ✅ Array store — reacts to push/splice/etc.
const items = domData([{ id: 1, text: 'hello' }]);
el('ul', items, (item) => el('li', () => item.text))
```

---

**4. Item properties not updating inside a list**

Array stores track *structural* changes (add/remove/reorder). To also react to a property changing on an existing item, wrap it in a function:

```js
// ❌ item.text captured at render, won't update if text changes later
el('li', item.text)

// ✅ Reactive to text changes
el('li', () => item.text)
```

---

**5. `ondestroy` on the wrong element**

`ondestroy` runs when *that specific element* is removed. If you put it on a child but the parent gets removed, the child's `ondestroy` still fires (El3 walks the subtree). But if you put cleanup on a parent and then manually remove only a child, the parent's `ondestroy` won't fire yet. Register cleanup on the element whose removal you're actually tracking.

---

## Q&A

**Do I need a bundler?**
No. El3 is a plain ES module. Use `<script type="module">` in the browser and import directly from the CDN or a local file. No Webpack, Vite, or Rollup required.

**How does keying work in lists?**
El3 looks for `id` on each item, then falls back to index. Index-based keying works but causes unnecessary DOM mutations when items reorder. Always give list items stable `id` fields.

**Can I use it with TypeScript?**
The source ships without types. You can write a `.d.ts` shim or wrap the functions yourself, but there's no official typed version yet. PRs welcome.

**What about SSR?**
El3 manipulates the real DOM directly — no virtual DOM, no server-side rendering story. It's a client-only library.

**Memory leaks — what's the risk?**
El3's cleanup map is keyed to DOM elements via `WeakMap`, so GC handles elements that leave the tree. If you hold external references to store state inside closures that outlive your components, those can pin memory. Be deliberate about long-lived stores.

**Is batching automatic?**
Mutations inside `domData` actions are always batched. Direct mutations to `store.state` outside an action flush on the next microtask — usually fine, but can cause multiple renders in tight loops. Use actions for anything performance-sensitive.

**How does it compare to Solid or Vue's reactivity?**
Conceptually identical — all three use proxy-based dependency tracking. El3 skips the compiler, the component model, the ecosystem, and the opinions. You get the reactive primitive and nothing else. More power to you, more responsibility on you.

**Can an LLM reliably generate El3 code?**
Yes — the API surface is small enough to fit in a system prompt. The pattern works best when you include one or two short examples in the prompt and constrain the output to a single self-contained expression. See [Pattern 2](#pattern-2--ai-generated-dom-llm-writes-el3-code) above.

---

## How It Works Internally

<details>
<summary>Click to expand — source with annotations</summary>

The engine is ~400 lines of formatted code. The core loop:

1. When a reactive function (a child wrapped in `() =>`) runs, El3 pushes it onto a stack (`fnStack`).
2. Any `domData` property read during that run sees the active function on the stack and registers it as a *subscriber* in `DataMap`.
3. When a property is written, `trigger()` looks up all subscribers for that key and adds them to `pendingUpdates`.
4. `queueMicrotask(flush)` batches all pending re-runs into a single async tick.

Array mutation methods (`push`, `pop`, `splice`, etc.) are intercepted on the proxy and fire `trigger` on both the changed index and `length`, which is what makes `elist` react to structural changes.

```js
const DataMap=new WeakMap(),ProxyCache=new WeakMap(),RawCache=new WeakMap(),CleanupMap=new WeakMap();
const pendingUpdates=new Set();let isFlushing=false,isBatching=false;const fnStack=[];
const SVG_NS="http://www.w3.org/2000/svg",STORE=Symbol('store');
function DataProxy(obj){if(typeof obj!=="object"||obj===null)return obj;if(ProxyCache.has(obj))return ProxyCache.get(obj);const MUTATORS=new Set(["push","pop","shift","unshift","splice","sort","reverse"]);const proxy=new Proxy(obj,{get(t,k,r){if(Array.isArray(t)&&MUTATORS.has(k))return(...a)=>{const res=t[k](...a);trigger(t,"*");trigger(t,"length");return res};const active=fnStack.at(-1);if(active){let d=DataMap.get(t)??(DataMap.set(t,new Map),DataMap.get(t));let s=d.get(k)??(d.set(k,new Set),d.get(k));s.add(active)}const v=Reflect.get(t,k,r);return v&&typeof v==="object"?DataProxy(v):v},set(t,k,v,r){const raw=RawCache.get(v)??v,old=t[k],res=Reflect.set(t,k,raw,r);if(old!==raw){trigger(t,k);if(Array.isArray(t)&&typeof k==="string"&&/^\d+$/.test(k)){trigger(t,"length");trigger(t,"*")}}return res}});ProxyCache.set(obj,proxy);RawCache.set(proxy,obj);return proxy}
export function domData(init,actions={}){const data=DataProxy(init),store={[STORE]:true,data};for(const[n,fn]of Object.entries(actions))store[n]=(...a)=>batch(()=>fn(data,...a));return store}
function trigger(t,k){const d=DataMap.get(t);if(!d)return;const run=s=>s?.forEach(f=>pendingUpdates.add(f));run(d.get(k));if(k!=='*')run(d.get('*'));if(pendingUpdates.size>0&&!isBatching&&!isFlushing)queueMicrotask(flush);}
function flush(){if(isFlushing)return;isFlushing=true;const fl=[...pendingUpdates];pendingUpdates.clear();for(const f of fl){try{f();}catch(e){console.error(e);}}isFlushing=false;if(pendingUpdates.size>0)queueMicrotask(flush);}
function autoUpdate(fn){let active=true;const w=()=>{if(!active)return;fnStack.push(w);try{return fn();}finally{fnStack.pop();}};w.dispose=()=>{active=false;pendingUpdates.delete(w);};w();return w;}
function batch(fn){const was=isBatching;isBatching=true;try{return fn();}finally{isBatching=was;if(!was&&pendingUpdates.size>0)queueMicrotask(flush);}}
function onDestroy(el,fn){let s=CleanupMap.get(el)??(CleanupMap.set(el,new Set()),CleanupMap.get(el));s.add(fn);}
function triggerDestroy(el){if(el.nodeType!==1)return;el.querySelectorAll('*').forEach(triggerDestroy);const f=CleanupMap.get(el);if(f){f.forEach(fn=>{try{fn();}catch(e){}});CleanupMap.delete(el);}}
function setDOMValue(el,k,v,svg){if(!svg&&(k==='value'||k==='checked')){el[k]=v;}else if(!svg&&k in el&&typeof el[k]!=='object'){el[k]=v;}else{el.setAttribute(k,v);}}
function applyClass(el,v,svg){if(v&&typeof v==='object'&&!Array.isArray(v)){Object.entries(v).forEach(([c,on])=>el.classList.toggle(c,!!on));}else{const cn=Array.isArray(v)?v.filter(Boolean).join(' '):(v??'');svg?el.setAttribute('class',cn):(el.className=cn);}}
function applyStyle(el,v){if(v&&typeof v==='object'){for(const[k,p]of Object.entries(v)){if(k.startsWith('--'))el.style.setProperty(k,p);else el.style[k]=p;}}else{el.style.cssText=v??'';}}
function fragment(children,isSVG=false){const f=document.createDocumentFragment();flattenChildren(f,children,isSVG);return f;}
function flattenChildren(parent,arr,isSVG=false){const lc=new Map;for(let i=0;i<arr.length;i++){const child=arr[i];if(isStore(child)&&typeof arr[i+1]==="function"){const res=elist(child,arr[i+1]);if(res instanceof DocumentFragment)parent.appendChild(res);else parent.appendChild(res);i++;continue}if(Array.isArray(child)){flattenChildren(parent,child,isSVG)}else if(typeof child==="function"){let oldItems=[],textNode=null;const anchor=document.createTextNode("");parent.appendChild(anchor);const eff=autoUpdate(()=>{let res=child(isSVG);if(res instanceof Node)res=[res];if(Array.isArray(res)){if(textNode){textNode.remove();textNode=null}reconcile(parent,anchor,oldItems,res,lc);oldItems=[...res]}else{if(oldItems.length>0){for(const i of oldItems){const n=lc.get(i);if(n){if(n.nodeType===1)triggerDestroy(n);n.remove()}}oldItems=[]}if(!textNode){textNode=document.createTextNode("");anchor.before(textNode)}textNode.textContent=res==null||res===false?"":String(res)}});onDestroy(parent instanceof Element?parent:anchor,()=>{eff.dispose();textNode?.remove();if(anchor.parentNode)anchor.remove()})}else if(child instanceof Node){parent.appendChild(child)}else if(child!=null&&child!==false){parent.appendChild(document.createTextNode(String(child)))}}}
function lis(seq){const n=seq.length,result=[],par=new Array(n).fill(-1);for(let i=0;i<n;i++){if(seq[i]===-1)continue;let lo=0,hi=result.length;while(lo<hi){const m=(lo+hi)>>1;if(seq[result[m]]<seq[i])lo=m+1;else hi=m;}if(lo>0)par[i]=result[lo-1];result[lo]=i;}const stable=new Set();let cur=result.at(-1);while(cur!=null&&cur!==-1){stable.add(cur);cur=par[cur];}return stable;}
function reconcile(parent,anchor,oldItems,newItems,cache){const oldMap=new Map(oldItems.map((it,i)=>[it,i])),newSet=new Set(newItems);for(const it of oldItems){if(!newSet.has(it)){const n=it instanceof Node?it:cache.get(it);if(n){if(n.nodeType===1)triggerDestroy(n);n.remove()}cache.delete(it)}}for(const it of newItems){if(!cache.has(it)){const n=it instanceof Node?it:document.createTextNode(String(it));cache.set(it,n)}}const oi=newItems.map(it=>oldMap.has(it)?oldMap.get(it):-1),stable=lis(oi);for(let i=newItems.length-1;i>=0;i--){if(stable.has(i))continue;const n=cache.get(newItems[i]),bef=i+1<newItems.length?cache.get(newItems[i+1])??anchor:anchor;if(n)parent.insertBefore(n,bef)}}
function keyList(getItems,keyFn,renderFn){const nc=new Map,pk=[];return isSVG=>{const items=getItems(),nk=[],ns=new Set,res=[];for(let i=0;i<items.length;i++){const it=items[i],k=keyFn(it,i);nk.push(k);ns.add(k);if(!nc.has(k)){const r=renderFn(it,i,isSVG);nc.set(k,r instanceof DocumentFragment?Array.from(r.childNodes):r)}const c=nc.get(k);if(Array.isArray(c))res.push(...c);else res.push(c)}for(const k of pk){if(!ns.has(k)){const ns2=[].concat(nc.get(k));ns2.forEach(n=>{if(n.nodeType===1)triggerDestroy(n)});nc.delete(k)}}pk.length=0;pk.push(...nk);return res}}
const isStore=d=>d?.[STORE]===true&&!Array.isArray(d.data);
const isArrayStore=d=>d?.[STORE]===true&&Array.isArray(d.data);
function elist(data,templateFn,parentNode,options={}){let content;if(isArrayStore(data)){content=keyList(()=>data.data,(it,i)=>it?.id??it?.key??i,(it,i,svg)=>templateFn(it,i))}else if(isStore(data)){content=()=>templateFn(data.data)}else if(Array.isArray(data)){content=data.map((it,i)=>templateFn(it,i))}else if(typeof data==="string"||data instanceof Node){content=data}else{throw new TypeError(`elist: unrecognised data \u2014 ${typeof data}`)}const items=Array.isArray(content)?content:[content];if(!parentNode)return fragment(items);flattenChildren(parentNode,items);return parentNode}
const isList = (val) => isArrayStore(val) || (typeof val === 'object' && val?.isList);
function setAttr(el, k, v, isSVG) { if (k === 'class' || k === 'className') applyClass(el, v, isSVG); else if (k === 'style') applyStyle(el, v); else setDOMValue(el, k, v, isSVG); };
function makeEl(tag,props,children,isSVG){const el=isSVG?document.createElementNS("http://www.w3.org/2000/svg",tag):document.createElement(tag);for(const[k,v]of Object.entries(props)){if(k.startsWith("on")){const evt=k.slice(2).toLowerCase();if(typeof v==="function"){if(evt==="create")v(el);else if(evt==="destroy")onDestroy(el,v);else{el.addEventListener(evt,v);onDestroy(el,()=>el.removeEventListener(evt,v))}}continue}if(typeof v==="function"){const eff=autoUpdate(()=>setAttr(el,k,v(isSVG),isSVG));onDestroy(el,()=>eff.dispose())}else{setAttr(el,k,v,isSVG)}}flattenChildren(el,children,isSVG);return el}
export function el(sel,...args){let props=args[0],children=args.slice(1);if(props==null||typeof props!=="object"||Array.isArray(props)||props instanceof Node||typeof props==="function"){children=args;props={}}const parts=sel.match(/([a-zA-Z0-9-_]+)|(\.[a-zA-Z0-9-_]+)|(#[a-zA-Z0-9-_]+)/g)??[];const tag=parts.find(p=>!p.startsWith(".")&&!p.startsWith("#"))??"div";const classes=parts.filter(p=>p.startsWith(".")).map(p=>p.slice(1));const id=parts.find(p=>p.startsWith("#"))?.slice(1);const merged={...props};if(id&&!merged.id)merged.id=id;if(classes.length){const base=props.class??props.className;merged.class=base?`${base} ${classes.join(" ")}`:classes.join(" ");delete merged.className}return makeEl(tag,merged,children,false)}
export function svg(tag,props={},...ch){if(typeof tag!=="string"){const isProps=tag!=null&&typeof tag==="object"&&!Array.isArray(tag);return makeEl("svg",isProps?{xmlns:"http://www.w3.org/2000/svg",...tag}:{xmlns:"http://www.w3.org/2000/svg"},isProps?[props,...ch]:[tag,props,...ch],true)}return makeEl(tag,props,ch,true)}
```

</details>

---

# El3 API Reference

This section documents every public function El3 exports: `el`, `domData`, and `svg`.

---

## `domData(initialState, actions?)`

Creates a **reactive store** — an object whose state is tracked automatically. Any function that reads from the store's `.data` will re-run whenever the values it read change.

### Parameters

**`initialState`** — `object | array` — *required*

The starting value of your store. Can be a plain object or an array.

- If you pass a plain object, `domData` creates an *object store*. Use this for scalar values, flags, UI state, and anything that isn't a list.
- If you pass an array, `domData` creates an *array store*. Use this for lists of items rendered with `elist`. Array stores additionally intercept mutating methods (`push`, `pop`, `splice`, `sort`, `reverse`, `shift`, `unshift`) so that list components automatically re-render when the array changes.

```js
// Object store
const ui = domData({ theme: 'light', sidebarOpen: false });

// Array store
const todos = domData([{ id: 1, text: 'Buy milk' }]);
```

**`actions`** — `object` — *optional*, default `{}`

A map of named functions that are the **recommended way to mutate state**. Each action receives the raw (unwrapped) state as its first argument, followed by any arguments you pass when calling it.

```js
const counter = domData({ count: 0 }, {
  increment: (state) => state.count++,
  incrementBy: (state, amount) => state.count += amount,
  reset: (state) => state.count = 0,
});

counter.increment();
counter.incrementBy(5);
counter.reset();
```

All mutations inside a single action are **batched** — El3 waits until the action finishes before flushing updates to the DOM. This means ten mutations inside one action produce one render, not ten. Direct mutations to `store.data` outside an action are not batched — they each flush on the next microtask. For performance-sensitive code, always use actions.

### Returns

A **store object** with the following shape:

- **`store.data`** — the reactive proxy of your initial state. Read from it in reactive functions; write to it in actions or directly for simple cases.
- **`store.yourActionName(...args)`** — one method per action you defined, pre-bound and batched.

```js
const store = domData({ count: 0 }, {
  increment: (state) => state.count++,
});

console.log(store.data.count); // 0
store.increment();
console.log(store.data.count); // 1
```

---

## `el(selector, props?, ...children)`

Creates and returns a **DOM element**. It is the primary tool for building UI in El3. Props and children can be static (rendered once) or **reactive** (re-evaluated automatically when their dependencies change).

### Parameters

**`selector`** — `string` — *required*

A CSS-like string describing the element to create. Supports tag name, classes, and an ID in any combination:

```
'div'               → <div>
'button.primary'    → <button class="primary">
'input#email'       → <input id="email">
'ul.list.compact'   → <ul class="list compact">
'p.note#hint'       → <p class="note" id="hint">
```

The tag name defaults to `'div'` if only classes or an ID are provided.

---

**`props`** — `object` — *optional*, default `{}`

An object of attributes, properties, event handlers, and reactive bindings for the element.

**Event handlers** — any key starting with `on` followed by a lowercase event name:

```js
el('button', { onclick: () => doSomething() }, 'Click me')
el('input',  { oninput: e => store.data.query = e.target.value })
el('form',   { onsubmit: e => { e.preventDefault(); handleSubmit(); } })
```

El3 calls `addEventListener` internally and automatically removes the listener when the element is destroyed.

**Special lifecycle handlers:**

- **`oncreate(node)`** — called synchronously when the element is first created, before it is inserted into the document. Use it to hand the raw DOM node to a third-party library.
- **`ondestroy()`** — called when El3 removes the element from the DOM. Use it to clean up timers, third-party instances, or subscriptions.

```js
el('canvas', {
  oncreate: (node) => { chart = new Chart(node, config); },
  ondestroy: () => chart?.destroy(),
})
```

**Reactive props** — if a prop value is a **function**, El3 calls it immediately and applies the result, then re-calls it automatically whenever any reactive state it touched changes:

```js
el('div', {
  class:  () => store.data.active ? 'box active' : 'box',
  style:  () => ({ color: store.data.theme === 'dark' ? '#fff' : '#000' }),
  hidden: () => !store.data.visible,
})
```

**`class` / `className`** — accepts a string, array of strings, or an object of `{ className: boolean }` pairs:

```js
el('div', { class: 'card' })
el('div', { class: ['card', isActive && 'active', hasError && 'error'] })
el('div', { class: { card: true, active: isActive, error: hasError } })

// Reactive
el('div', { class: () => ({ card: true, active: store.data.active }) })
```

**`style`** — accepts a CSS string or an object of camelCase style properties. CSS custom properties (`--my-var`) are set via `setProperty`:

```js
el('div', { style: 'color: red; font-size: 14px' })
el('div', { style: { color: 'red', fontSize: '14px', '--accent': '#0f0' } })

// Reactive
el('div', { style: () => ({ opacity: store.data.visible ? 1 : 0 }) })
```

All other props are set as DOM properties where they exist on the element (e.g. `value`, `checked`, `disabled`, `href`), and as HTML attributes via `setAttribute` otherwise.

---

**`...children`** — `string | number | Node | function | array | null | false` — *optional*

Everything after `props` is treated as a child. El3 accepts children in any of the following forms and flattens them automatically:

**Static string or number** — rendered as a text node once:

```js
el('p', 'Hello world')
el('p', 'You have ', 3, ' messages')
```

**DOM node** — appended directly:

```js
el('div', el('span', 'nested'))
```

**`null` or `false`** — ignored. Use this for conditional children:

```js
el('div',
  el('h1', 'Title'),
  isLoggedIn && el('p', 'Welcome back'),
  hasError ? el('p.error', errorMsg) : null
)
```

**Array** — flattened recursively:

```js
el('ul', items.map(item => el('li', item.text)))
```

**Function** — the key reactive primitive. A function child is called immediately and its return value rendered, then re-called automatically whenever any reactive state it touched changes:

```js
// Reactive text
el('p', () => `Count: ${store.data.count}`)

// Reactive node swap
el('div', () => store.data.loggedIn ? Dashboard() : LoginForm())
```

**Array store shorthand** — pass an array store directly to `el` followed by a template function and El3 routes them through `elist` automatically:

```js
el('ul', todosStore, (item) =>
  el('li', () => item.text)
)
```

### Returns

A native `HTMLElement`. You can append it to the document with `document.body.appendChild(node)`, pass it to another `el()` call as a child, or manipulate it with any standard DOM API.

---

### Sample component — `SortableList`

A list that reacts to both structural changes and in-place property edits, with a sort control:

```js
import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

export const SortableList = (initialItems) => {
  const items = domData(initialItems, {
    sortByName: (s) => s.sort((a, b) => a.name.localeCompare(b.name)),
    remove: (s, id) => s.splice(s.findIndex(i => i.id === id), 1),
    rename: (s, id, name) => { const i = s.find(i => i.id === id); if (i) i.name = name; },
  });

  return el('div.sortable-list',
    el('div.controls',
      el('button', { onclick: () => items.sortByName() }, 'Sort A–Z')
    ),
    el('ul', items, (item) =>
      el('li',
        el('input', {
          value: () => item.name,
          oninput: e => items.rename(item.id, e.target.value),
        }),
        el('button', { onclick: () => items.remove(item.id) }, '✕')
      )
    )
  );
};

// Usage
document.body.appendChild(
  SortableList([
    { id: 1, name: 'Zebra' },
    { id: 2, name: 'Apple' },
    { id: 3, name: 'Mango' },
  ])
);
```

---

## `elist(data, templateFn, parentNode?)`

Explicitly renders a list of items. While `el()` handles array stores automatically via shorthand, `elist` can be used for manual list management or appending to existing nodes.

### Parameters

**`data`** — `ArrayStore | ObjectStore | Array` — *required*

The data source for the list.

- If an **ArrayStore**, `elist` performs keyed diffing based on `id`, or index.
- If a **plain Array**, it renders once and does not react to changes.

**`templateFn(item, index, isSVG)`** — `function` — *required*

A function that returns a DOM node for each item.

**`parentNode`** — `Node` — *optional*

If provided, `elist` appends children directly to this node. Otherwise, it returns a `DocumentFragment`.

### Returns

A `DocumentFragment` (if no `parentNode`) or the `parentNode` itself.

---

## `svg(tag?, props?, ...children)`

Creates SVG elements with the correct XML namespace (`http://www.w3.org/2000/svg`). Supports the same reactive prop and child patterns as `el`. Use `svg` for the root `<svg>` element and all descendants — El3 propagates the SVG namespace automatically to every child created inside an `svg()` call.

### Signatures

`svg` is flexible about how you open an SVG tree:

```js
// 1. Wrapper — creates <svg> with props, children follow
svg({ width: 100, height: 100 }, ...children)

// 2. Named element — creates any SVG element by tag name
svg('circle', { cx: 50, cy: 50, r: 40, fill: 'red' })

// 3. Children only — creates <svg>, infers props from first arg if it's an object
svg(...children)
```

### Props

All props work the same as in `el` — static values, reactive functions, event handlers, `oncreate`/`ondestroy` lifecycle hooks. Attribute names use the standard SVG spelling (kebab-case where required):

```js
svg('line', {
  x1: 0, y1: 0, x2: 100, y2: 100,
  stroke: 'black',
  'stroke-width': 2,
})
```

Reactive props work exactly as in `el`:

```js
svg('circle', {
  cx: () => store.data.x,
  cy: () => store.data.y,
  r:  () => store.data.radius,
  fill: () => store.data.color,
})
```

### Nesting SVG elements

Build a full SVG tree by nesting `svg()` calls:

```js
svg({ width: 200, height: 200, viewBox: '0 0 200 200' },
  svg('rect', { x: 10, y: 10, width: 180, height: 180, fill: '#eee' }),
  svg('text', { x: 100, y: 110, 'text-anchor': 'middle', fontSize: 24 }, 'Hello')
)
```

### Sample component — `DonutChart`

A reactive donut chart built entirely with `svg` and `elist`. The chart reacts to changes in segment data without redrawing segments that haven't changed.

```js
import { el, svg, elist, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

// Converts a list of { label, value, color } into SVG arc segments
const polarToCartesian = (cx, cy, r, angleDeg) => {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx, cy, r, startAngle, endAngle) => {
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
};

export const DonutChart = (initialSegments, { size = 200, thickness = 40 } = {}) => {
  const segments = domData(initialSegments, {
    update: (s, id, value) => { const seg = s.find(g => g.id === id); if (seg) seg.value = value; },
    add:    (s, seg) => s.push(seg),
    remove: (s, id) => s.splice(s.findIndex(g => g.id === id), 1),
  });

  const cx = size / 2, cy = size / 2;
  const r = cx - thickness;
  const innerR = r - thickness;

  // Derive arc paths reactively
  const arcs = () => {
    const total = segments.data.reduce((sum, s) => sum + s.value, 0);
    let cursor = 0;
    return segments.data.map(seg => {
      const start = cursor;
      const sweep = (seg.value / total) * 360;
      cursor += sweep;
      return { ...seg, start, end: start + sweep };
    });
  };

  return el('div.donut-chart',
    svg({ width: size, height: size, viewBox: `0 0 ${size} ${size}` },
      // Background ring
      svg('circle', { cx, cy, r: r - thickness / 2, fill: 'none', stroke: '#eee', 'stroke-width': thickness }),

      // Reactive arc segments
      () => arcs().map(seg =>
        svg('path', {
          d: arcPath(cx, cy, r - thickness / 2, seg.start, seg.end - 0.5),
          fill: 'none',
          stroke: seg.color,
          'stroke-width': thickness,
          'stroke-linecap': 'round',
        })
      ),

      // Centre label
      svg('text', {
        x: cx, y: cy + 6,
        'text-anchor': 'middle',
        'font-size': 18,
        fill: '#333',
      }, () => {
        const total = segments.data.reduce((s, g) => s + g.value, 0);
        return String(total);
      })
    ),

    // Legend — built with elist
    el('ul.legend', { style: { listStyle: 'none', padding: 0, marginTop: '1rem' } },
      segments, (seg) =>
        el('li', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' } },
          el('span', { style: () => ({ width: 12, height: 12, borderRadius: '50%', background: seg.color, display: 'inline-block' }) }),
          el('span', () => `${seg.label}: ${seg.value}`)
        )
    )
  );
};

// Usage
const chart = DonutChart([
  { id: 1, label: 'Design',     value: 30, color: '#6366f1' },
  { id: 2, label: 'Engineering', value: 55, color: '#22c55e' },
  { id: 3, label: 'Marketing',  value: 15, color: '#f59e0b' },
]);

document.body.appendChild(chart);

// Segments update reactively — no manual redraw
chart.__store?.update(1, 45);
```

### Sample component — `SparklineChart`

A reactive sparkline (mini line chart) that reacts to a live-updating data store — useful for dashboards, metrics widgets, and monitoring UIs.

```js
import { el, svg, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs';

export const SparklineChart = (initialValues, {
  width = 200,
  height = 60,
  color = '#6366f1',
  strokeWidth = 2,
  label = '',
} = {}) => {
  const store = domData({ values: initialValues }, {
    push:  (s, v) => { s.values.push(v); if (s.values.length > 60) s.values.shift(); },
    reset: (s)    => { s.values = []; },
  });

  const points = () => {
    const vs = store.data.values;
    if (vs.length < 2) return '';
    const min = Math.min(...vs), max = Math.max(...vs);
    const range = max - min || 1;
    return vs.map((v, i) => {
      const x = (i / (vs.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    }).join(' ');
  };

  const latest = () => {
    const vs = store.data.values;
    return vs.length ? String(vs[vs.length - 1]) : '—';
  };

  return Object.assign(
    el('div.sparkline', { style: { display: 'inline-flex', flexDirection: 'column', gap: '0.25rem' } },
      label ? el('span', { style: { fontSize: 11, color: '#999' } }, label) : null,
      svg({ width, height, viewBox: `0 0 ${width} ${height}` },
        svg('polyline', {
          points: () => points(),
          fill: 'none',
          stroke: color,
          'stroke-width': strokeWidth,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        })
      ),
      el('span', { style: { fontSize: 13, fontWeight: 'bold', color } }, latest)
    ),
    { push: (v) => store.push(v), reset: () => store.reset() }
  );
};

// Usage — live updating sparkline
const spark = SparklineChart([10, 14, 9, 18, 22, 17, 25], {
  label: 'Requests / sec',
  color: '#22c55e',
});

document.body.appendChild(spark);

// Feed live data in
setInterval(() => spark.push(Math.round(10 + Math.random() * 20)), 1000);
```

---

## Reactivity rules — quick reference

These rules govern when El3 re-runs a function. Understanding them prevents most beginner bugs.

| Situation | Reactive? |
|---|---|
| `el('p', store.data.count)` — value read outside a function | ❌ No — captured once |
| `el('p', () => store.data.count)` — value read inside a function | ✅ Yes — re-runs on change |
| `{ class: 'active' }` — static prop | ❌ No |
| `{ class: () => isActive ? 'active' : '' }` — function prop | ✅ Yes |
| Action mutations — `store.myAction()` | ✅ Batched — one flush |
| Direct mutations — `store.data.x = 1` outside an action | ⚠️ Unbatched — flushes next microtask |
| Array `push` / `splice` on an array store | ✅ Yes — structural update |
| Changing a property on an item already in an array store | ⚠️ Only if read inside a `() =>` function |
| SVG attribute as a function | ✅ Yes — same rules as `el` props |

---

## Playground

pndng

---

### Example 1 — Reactive counter

The simplest possible reactive UI. Shows `domData`, `el`, and a function child.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>El3 · Counter</title>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; padding: 4rem; }
    .counter { text-align: center; }
    h1 { font-size: 4rem; margin: 0; }
    button { font-size: 1.5rem; padding: .5rem 1.5rem; margin: .5rem; cursor: pointer; }
  </style>
</head>
<body>
<script type="module">
  import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs'';

  const counter = domData({ count: 0 }, {
    inc: (s) => s.count++,
    dec: (s) => s.count--,
    reset: (s) => s.count = 0,
  });

  document.body.appendChild(
    el('div.counter',
      el('h1', () => counter.data.count),
      el('div',
        el('button', { onclick: () => counter.dec() }, '−'),
        el('button', { onclick: () => counter.reset() }, 'Reset'),
        el('button', { onclick: () => counter.inc() }, '+'),
      )
    )
  );
</script>
</body>
</html>
```

<!-- playground-pndng -->

---

### Example 2 — Todo list with reactive filtering

Shows array stores, `elist`, filtered reactive views, and conditional rendering.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>El3 · Todos</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 4rem auto; }
    .row { display: flex; gap: .5rem; margin-bottom: 1rem; }
    input { flex: 1; padding: .5rem; font-size: 1rem; }
    button { padding: .5rem 1rem; cursor: pointer; }
    li { display: flex; justify-content: space-between; align-items: center; padding: .4rem 0; border-bottom: 1px solid #eee; }
    .done span { text-decoration: line-through; opacity: .5; }
    .filters { display: flex; gap: .5rem; margin-bottom: 1rem; }
    .filters button.active { font-weight: bold; text-decoration: underline; }
  </style>
</head>
<body>
<script type="module">
  import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs'';

  const todos = domData(
    [
      { id: 1, text: 'Buy oat milk', done: false },
      { id: 2, text: 'Write El3 docs', done: true },
    ],
    {
      add:    (s, text) => s.push({ id: Date.now(), text, done: false }),
      remove: (s, id)   => s.splice(s.findIndex(t => t.id === id), 1),
      toggle: (s, id)   => { const t = s.find(t => t.id === id); if (t) t.done = !t.done; },
    }
  );

  const ui = domData({ filter: 'all' });

  const filtered = () => {
    const f = ui.data.filter;
    return todos.data.filter(t =>
      f === 'all' ? true : f === 'done' ? t.done : !t.done
    );
  };

  let input;

  const app = el('div',
    el('h2', 'Todos'),
    el('div.row',
      el('input', {
        type: 'text',
        placeholder: 'What needs doing?',
        oncreate: n => input = n,
        onkeydown: e => {
          if (e.key === 'Enter' && input.value.trim()) {
            todos.add(input.value.trim());
            input.value = '';
          }
        }
      }),
      el('button', { onclick: () => { if (input.value.trim()) { todos.add(input.value.trim()); input.value = ''; } } }, 'Add')
    ),
    el('div.filters',
      ['all', 'active', 'done'].map(f =>
        el('button', {
          class: () => ui.data.filter === f ? 'active' : '',
          onclick: () => ui.data.filter = f,
        }, f[0].toUpperCase() + f.slice(1))
      )
    ),
    el('ul', () =>
      filtered().map(item =>
        el('li', { class: () => item.done ? 'done' : '' },
          el('span', {
            onclick: () => todos.toggle(item.id),
            style: 'cursor:pointer'
          }, () => item.text),
          el('button', { onclick: () => todos.remove(item.id) }, '✕')
        )
      )
    ),
    el('p', () => {
      const remaining = todos.data.filter(t => !t.done).length;
      return `${remaining} item${remaining === 1 ? '' : 's'} remaining`;
    })
  );

  document.body.appendChild(app);
</script>
</body>
</html>
```

<!-- playground-pndng -->

---

### Example 3 — Client-side router

Shows hash-based routing, the `Link` helper, and reactive page swapping. Works on any static host including GitHub Pages.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>El3 · Router</title>
  <style>
    body { font-family: sans-serif; max-width: 640px; margin: 4rem auto; }
    nav { display: flex; gap: 1rem; margin-bottom: 2rem; }
    nav a { text-decoration: none; color: #555; }
    nav a.active { color: #000; font-weight: bold; border-bottom: 2px solid #000; }
    .page { animation: fadein .15s ease; }
    @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
  </style>
</head>
<body>
<script type="module">
  import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs'';

  // Hash router store
  const router = domData(
    { path: location.hash.slice(1) || '/' },
    { navigate: (s, path) => { location.hash = path; s.path = path; } }
  );
  window.addEventListener('hashchange', () => {
    router.navigate(location.hash.slice(1) || '/');
  });

  // NavLink helper
  const NavLink = (href, label) =>
    el('a', {
      href: '#' + href,
      class: () => router.data.path === href ? 'active' : '',
      onclick: e => { e.preventDefault(); router.navigate(href); },
    }, label);

  // Pages
  const Home = () =>
    el('div.page',
      el('h1', 'Home'),
      el('p', 'Welcome to the El3 router demo. Navigate using the links above.')
    );

  const About = () =>
    el('div.page',
      el('h1', 'About'),
      el('p', 'El3 is a minimal reactive DOM library. ~200 lines. No build step.')
    );

  const Post = ({ id }) =>
    el('div.page',
      el('h1', `Post #${id}`),
      el('p', `This is the content for post ${id}.`)
    );

  const NotFound = () =>
    el('div.page',
      el('h1', '404'),
      el('p', 'Page not found.')
    );

  // Route matching
  function matchRoute(pattern, path) {
    const pp = pattern.split('/'), rp = path.split('/');
    if (pp.length !== rp.length) return null;
    const params = {};
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = rp[i];
      else if (pp[i] !== rp[i]) return null;
    }
    return params;
  }

  const outlet = () => {
    const path = router.data.path;
    if (path === '/')        return Home();
    if (path === '/about')   return About();
    const post = matchRoute('/post/:id', path);
    if (post)                return Post(post);
    return NotFound();
  };

  document.body.appendChild(
    el('div',
      el('nav',
        NavLink('/', 'Home'),
        NavLink('/about', 'About'),
        NavLink('/post/1', 'Post 1'),
        NavLink('/post/2', 'Post 2'),
      ),
      el('main', outlet)
    )
  );
</script>
</body>
</html>
```

<!-- playground-pndng -->

---

### Example 4 — Streaming LLM chat UI

Shows the streaming pattern with a mock stream (replace `mockStream` with a real `fetch` call to your API proxy). Demonstrates chunk-by-chunk DOM updates with zero thrash.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>El3 · LLM Chat</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; max-width: 640px; margin: 0 auto; padding: 2rem; display: flex; flex-direction: column; height: 100vh; }
    .messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1rem; }
    .bubble { padding: .75rem 1rem; border-radius: 12px; max-width: 80%; line-height: 1.5; white-space: pre-wrap; }
    .user      { background: #0077ff; color: #fff; align-self: flex-end; }
    .assistant { background: #f0f0f0; color: #000; align-self: flex-start; }
    .streaming { background: #f0f0f0; color: #555; align-self: flex-start; font-style: italic; }
    .row { display: flex; gap: .5rem; }
    textarea { flex: 1; padding: .75rem; font-size: 1rem; border-radius: 8px; border: 1px solid #ccc; resize: none; }
    button { padding: .75rem 1.25rem; font-size: 1rem; border-radius: 8px; cursor: pointer; background: #0077ff; color: #fff; border: none; }
    button:disabled { opacity: .5; cursor: default; }
  </style>
</head>
<body>
<script type="module">
  import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs'';

  const chat = domData(
    { messages: [], streaming: '', busy: false },
    {
      addUser:       (s, text) => s.messages.push({ id: Date.now(), role: 'user', text }),
      appendChunk:   (s, chunk) => s.streaming += chunk,
      commitAssistant: (s) => {
        s.messages.push({ id: Date.now(), role: 'assistant', text: s.streaming });
        s.streaming = '';
        s.busy = false;
      },
      setBusy: (s, v) => s.busy = v,
    }
  );

  // Replace this with a real fetch + ReadableStream from your API proxy
  async function mockStream(prompt) {
    const words = `Sure! Here is a response to "${prompt}". El3 makes streaming simple — each chunk appends to state and only the streaming bubble re-renders. No virtual DOM diffing needed.`.split(' ');
    for (const word of words) {
      await new Promise(r => setTimeout(r, 60));
      chat.appendChunk(word + ' ');
    }
  }

  async function send(text) {
    if (!text.trim() || chat.data.busy) return;
    chat.addUser(text);
    chat.setBusy(true);
    await mockStream(text);
    chat.commitAssistant();
  }

  let textarea;

  const app = el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
    el('div.messages',
      el('div', chat, (msg) =>
        el('div.bubble', { class: () => msg.role }, () => msg.text)
      ),
      () => chat.data.streaming
        ? el('div.bubble.streaming', () => chat.data.streaming)
        : null
    ),
    el('div.row',
      el('textarea', {
        rows: 2,
        placeholder: 'Ask something… (Enter to send)',
        oncreate: n => textarea = n,
        onkeydown: e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const v = textarea.value.trim();
            textarea.value = '';
            send(v);
          }
        }
      }),
      el('button', {
        disabled: () => chat.data.busy,
        onclick: () => {
          const v = textarea.value.trim();
          textarea.value = '';
          send(v);
        }
      }, () => chat.data.busy ? '…' : 'Send')
    )
  );

  document.body.appendChild(app);
</script>
</body>
</html>
```

<!-- playground-pndng -->

---

### Example 5 — Component composition

Shows the `withAsync` HOC, the slot pattern, and the context/theme pattern all working together.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>El3 · Components</title>
  <style>
    body { font-family: sans-serif; max-width: 560px; margin: 4rem auto; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
    .card-footer { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee; }
    button { padding: .5rem 1rem; border-radius: 6px; cursor: pointer; border: none; }
    .btn-light { background: #eee; color: #000; }
    .btn-dark  { background: #222; color: #fff; }
    .loading { color: #999; font-style: italic; }
    .error { color: red; }
    .toggle { margin-bottom: 1.5rem; }
  </style>
</head>
<body>
<script type="module">
  import { el, domData } from 'https://cdn.jsdelivr.net/gh/houseofkodai/el3@v0.1.2/el3.min.mjs'';

  // --- Context: theme store (singleton) ---
  const theme = domData(
    { mode: 'light' },
    { toggle: (s) => s.mode = s.mode === 'light' ? 'dark' : 'light' }
  );

  // --- Component: ThemedButton ---
  const ThemedButton = (label, onclick) =>
    el('button', {
      class: () => `btn-${theme.data.mode}`,
      onclick,
    }, label);

  // --- Component: Card (slot pattern) ---
  const Card = ({ title, children, footer }) =>
    el('div.card',
      el('h3', title),
      children,
      footer ? el('div.card-footer', footer) : null
    );

  // --- HOC: withAsync ---
  const withAsync = (fetchFn, renderFn) => {
    const state = domData({ data: null, loading: true, error: null });
    fetchFn()
      .then(d  => { state.data.data = d; state.data.loading = false; })
      .catch(e => { state.data.error = e.message; state.data.loading = false; });

    return el('div',
      () => {
        if (state.data.loading) return el('p.loading', 'Loading…');
        if (state.data.error)   return el('p.error', `Error: ${state.data.error}`);
        return renderFn(state.data.data);
      }
    );
  };

  // --- Mock fetch (replace with a real API call) ---
  const fakeUser = () => new Promise(r =>
    setTimeout(() => r({ name: 'Ada Lovelace', bio: 'First programmer. Wrote the algorithm.' }), 900)
  );

  // --- Compose it all ---
  document.body.appendChild(
    el('div',
      el('div.toggle', ThemedButton(() => `Switch to ${theme.data.mode === 'light' ? 'dark' : 'light'} mode`, () => theme.toggle())),

      Card({
        title: 'User Profile',
        children: withAsync(fakeUser, (user) =>
          el('div',
            el('p', el('strong', 'Name: '), user.name),
            el('p', el('strong', 'Bio: '),  user.bio),
          )
        ),
        footer: ThemedButton('Follow', () => alert('Followed!')),
      }),
    )
  );
</script>
</body>
</html>
```

---

*El3 is a tool for people who know what they want and want less in the way.*
