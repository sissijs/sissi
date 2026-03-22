---
title: Architecture
layout: base.html
---
# {{ title }}

Sindie is a zero-external-dependency static site generator built on Node.js stdlib only. This page documents how it works under the hood — useful if you want to contribute, write a plugin, or just understand what happens when you run `npm run build`.

## High-level pipeline

Every build starts with a collections pass, then renders each file:

```txt
Scan all files → Build collections
   ↓
For each file:
  Read file → Parse frontmatter → Compile (plugin) → Template → Apply layout → Write output
```

**Collections pass (once per build):**

Sindie scans all input files, reads their frontmatter, and assembles the `collections` object before any template is rendered. This means every template has access to the full site's collection data.

**Per-file pipeline:**

- **Read:** The file is loaded from disk (or fetched over HTTP for remote URLs).
- **Frontmatter:** YAML or JSON metadata between `---` delimiters is extracted and merged into the template context.
- **Compile:** The plugin for this file extension does its main transformation (e.g. Markdown → HTML, or CSS `@import` inlining).
- **Template:** `{{ variable }}` and `{{ value | filter }}` expressions are evaluated against the merged data context (which includes `collections`).
- **Layout:** If frontmatter specifies a `layout:`, the compiled content is passed into that layout file and the whole process repeats recursively.
- **Write:** The final HTML (or CSS, etc.) is written to the output directory.

The orchestrator for the per-file pipeline is `src/transforms/template-data.js` → `handleTemplateFile()`.

---

## Source map

```txt
src/
├── cli.js                     Entry point — loads config, runs build/watch/serve
├── Sindie.js                   Sindie class — build(), watch(), serve()
├── Sindie-config.js            SindieConfig — plugins, filters, collections, directory config
├── collections.js             CollectionsAPI + buildCollections() (two-pass build)
├── resolver.js                Read local files or fetch remote URLs
├── data.js                    Load global data from _data/ directory
├── dependency-graph.js        Track which files include which (for watch mode)
├── includes.js                Language-agnostic recursive include resolver
├── httpd.js                   Built-in HTTP dev server with WebSocket live reload
├── naming.js                  Output path strategies (default vs. directory-index)
├── builtin-filters.js         Built-in template filters (date, json, sort, …)
├── mimes.js                   MIME type detection by file extension
├── html.js                    HTML plugin (<html-include> resolution)
├── css.js                     CSS plugin (@import inlining, @layer support)
├── md.js                      Markdown plugin (markdown → HTML + includes)
└── transforms/
    ├── template-data.js       Main per-file orchestrator + template engine
    ├── markdown.js            Custom regex-based Markdown parser
    ├── frontmatter.js         Extract YAML/JSON frontmatter
    ├── smolyaml.js            Lightweight YAML subset parser (no external lib)
    └── bundle.js              Asset bundling helper
```

---

## Template engine

Sindie ships a custom Handlebars-like template engine (no external library). Expressions are delimited by `{{ }}`.

**Variable output:**

```hbs
{{ title }}
```

**Filter pipeline:**

```hbs
{{ content | safe }}
{{ date | date: "en-US", { year: "numeric" } }}
{{ items | limit: 5 }}
```

Filters can be chained left to right. Each filter receives the previous value as its first argument. The `safe` filter bypasses HTML escaping; all other output is escaped by default.

Template expressions are evaluated inside a Node.js `vm` sandbox, so they have access to the merged data context but not to the host environment.

### Built-in filters

| Filter | What it does |
|---|---|
| `safe` | Mark output as trusted HTML (no escaping) |
| `json` | `JSON.stringify()` with optional indentation |
| `date` | `Intl.DateTimeFormat` formatting |
| `currency` | `Intl.NumberFormat` currency formatting |
| `numberFormat` | `Intl.NumberFormat` general formatting |
| `limit` | First N items of an array |
| `reverse` | Reversed copy of an array |
| `sort` | Sorted copy of an array |
| `last` | Last N items of an array (reversed) |
| `each` | Map array to string and join |
| `htmlentities` | Escape HTML entities |
| `urlencode` | URL-encode a string |
| `async` | Await a Promise value |
| `getPreviousCollectionItem` | Previous item in a collection relative to the current page |
| `getNextCollectionItem` | Next item in a collection relative to the current page |
| `getCollectionItemIndex` | Zero-based index of the current page in a collection |

The three collection-item helpers are also injected into the template context as **callable functions**, since Sindie's pipe syntax splits on `|` which prevents chaining property access after a piped result. Use them as `{{ getPreviousCollectionItem(collections.post, page)?.page?.url }}`.

Custom filters are registered via `config.addFilter(name, fn)` in your config file.

---

## Plugin system

Plugins teach Sindie how to process a new file type. Each plugin is a function that receives the `SindieConfig` instance and registers one or more extensions:

```js
export default function myPlugin(config) {
  config.addExtension('njk', {
    outputFileExtension: 'html',
    compile(content, inputPath) {
      return async (data) => nunjucks.renderString(content, data);
    },
  });
}
```

The three built-in plugins are:

- **`src/html.js`** — resolves `<html-include src="file.html"/>` tags
- **`src/css.js`** — resolves `@import 'file.css'` (with optional `@layer(name)` wrapping)
- **`src/md.js`** — converts Markdown to HTML, then resolves `<html-include>` tags in the output

### Include resolution

All three built-in plugins share a single language-agnostic helper: `src/includes.js` → `handleIncludes()`. Given a regex that matches include syntax and a function that knows how to inline the result, it:

1. Finds all matches in the content string.
2. Resolves each referenced file path relative to the source directory.
3. Recursively compiles each included file through the full pipeline.
4. Detects circular includes (up to 10 levels deep) and skips them with a warning.

---

## Markdown parser

`src/transforms/markdown.js` is a pure regex-based Markdown parser with no external library. It handles:

- ATX headings (`# Heading`)
- Setext headings (underline with `=` or `-`)
- Unordered and ordered lists, with nesting
- Task lists (`- [ ]` / `- [x]`)
- Blockquotes (nestable)
- Fenced code blocks (triple backticks + optional language)
- Tables (with column alignment)
- Horizontal rules
- Inline: `**bold**`, `*italic*`, `` `code` ``, `~~del~~`, `[link](url)`, `![img](src)`, `<autolink>`

Code blocks are extracted first (before any other processing) to prevent their contents from being interpreted as Markdown.

---

## Data loading

Global data is read from the `_data/` directory by `src/data.js`. Supported formats:

- `.js` — ES module with a `default` export (can be async)
- `.json` — parsed with `JSON.parse()`
- `.yaml` — parsed with the built-in `smolYAML` parser

Each file becomes a key on the global data object (e.g. `_data/meta.js` → `{{ meta.title }}`). This is merged with per-page frontmatter when templates are evaluated.

---

## Watch mode and dependency tracking

In watch mode (`npm run watch` / `npm run dev`), Sindie builds a dependency graph before starting:

- `src/dependency-graph.js` scans all source files and records which files are referenced by which others (by checking whether a file's basename appears inside each other file's content).
- When a file changes, Sindie rebuilds that file **plus all files that depend on it**, rather than rebuilding everything.

Debounce is configurable via `config.watchFileDelta` (default: 1000 ms).

---

## Dev server and live reload

`src/httpd.js` provides a built-in HTTP server (default: `localhost:8000`) with live reload. It uses native WebSockets (RFC 6455, hand-rolled — no external library):

- The server listens for file-change events on `/_dev-events` via WebSocket.
- A small inline script is injected before `</body>` in every served HTML page. It opens a WebSocket connection and listens for reload messages.
- When a `.css` file changes, the client updates `<link>` `href` attributes with a cache-busting query param (no full page reload).
- When any other file changes (or the current HTML page), the client does a full `location.reload()`.

---

## Output naming

`src/naming.js` provides two strategies:

| Strategy | Input | Output |
|---|---|---|
| `defaultNaming` | `about.md` | `about.html` |
| `directoryNaming` | `about.md` | `about/index.html` |

`directoryNaming` is useful for clean URLs (`/about/` instead of `/about.html`). Files named `index` are never nested further.

---

## Collections

`src/collections.js` implements a two-pass build strategy so that every template can access `collections` data about the whole site.

**Pass 1 — `buildCollections(config, data, files)`:** Reads the frontmatter of every template file without rendering it. Builds:

- `collections.all` — every template item, sorted by date ascending
- `collections.<tag>` — items whose frontmatter `tags` includes that tag, sorted
- Custom collections registered via `config.addCollection(name, fn)`

**Pass 2 — render:** Each file is rendered with the `collections` object merged into its data context.

The `CollectionsAPI` class (also exported from `collections.js`) is passed to `addCollection` callbacks and provides `getAll()`, `getAllSorted()`, `getFilteredByTag()`, `getFilteredByTags()`, and `getFilteredByGlob()`.

---

## Configuration reference

The config file (`.Sindie.config.js` or `.Sindie.js`) exports a function:

```js
export default function(config) {
  config.addPlugin(myPlugin);
  config.addFilter('upper', (str) => str.toUpperCase());

  return {
    dir: {
      input: 'src',      // default: '.'
      output: 'dist',    // default: 'public'
      includes: '_includes',
      layouts: '_layouts',
      data: '_data',
    },
    naming: directoryNaming,     // optional
    watchFileDelta: 500,         // debounce in ms
  };
}
```

---

## Adding a plugin (example)

Here's a minimal plugin that processes `.txt` files as plain-text wrapped in `<pre>`:

```js
export default function plaintextPlugin(config) {
  config.addExtension('txt', {
    outputFileExtension: 'html',
    compile(content) {
      return async (data) => `<pre>${content}</pre>`;
    },
  });
  config.addTemplateFormats('txt');
}
```

Register it in your config:

```js
import plaintextPlugin from './plaintext-plugin.js';

export default function(config) {
  config.addPlugin(plaintextPlugin);
}
```

---

## Zero-dependency philosophy

Sindie relies exclusively on Node.js built-in modules:

| Feature | Node.js stdlib used |
|---|---|
| File I/O | `node:fs/promises` |
| Template sandboxing | `node:vm` |
| HTTP server | `node:http` |
| WebSocket handshake | `node:crypto` (SHA-1) |
| File watching | `node:fs` `watch()` |
| Test runner | `node:test` + `node:assert` |
| Remote URL fetching | `fetch` (global, Node 18+) |

The Markdown parser, YAML parser, template engine, WebSocket implementation, and include resolver are all written from scratch.
