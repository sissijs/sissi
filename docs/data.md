---
title: All about Data
layout: base.html
---
## Data Cascade

When Sissi processes a template it merges data from three sources, in order of increasing precedence:

1. **Sissi built-ins** — the `page` object, `collections`, and anything provided by plugins
2. **`_data/` files** — global data loaded from your data directory
3. **Frontmatter** — per-file data declared at the top of each source file

Later sources win, so frontmatter values override global data, and global data overrides Sissi defaults.

## Data provided by Sissi

Every template receives a `page` object describing the current file:

| Field                         | Example                          | Description                                   |
|-------------------------------|----------------------------------|-----------------------------------------------|
| `page.url`                    | `/posts/hello/`                  | Output URL path                               |
| `page.inputPath`              | `posts/hello.md`                 | Source file path (relative to input dir)      |
| `page.outputPath`             | `public/posts/hello/index.html`  | Absolute output file path                     |
| `page.fileSlug`               | `hello`                          | Filename without extension                    |
| `page.filePathStem`           | `/posts/hello`                   | Path without extension                        |
| `page.outputFileExtension`    | `html`                           | Extension of the output file                  |
| `page.date`                   | `Date` object                    | Date from frontmatter, or epoch if absent     |

```html
<a href="{\{ page.url }\}">Permalink</a>
```

## The `_data` subdirectory

Any `.js`, `.json`, or `.yaml` file in `_data/` is loaded as global data. The filename (without extension) becomes the key:

**JavaScript** — the default export is the value; it can be a plain object, an array, or an async function:

```js
// _data/meta.js
export default {
  author: 'Lea Rosema',
  siteTitle: 'My Site',
};
```

**JSON:**

```json
// _data/links.json
[
  { "label": "GitHub", "url": "https://github.com" }
]
```

**YAML:**

```yaml
# _data/nav.yaml
- label: Home
  url: /
- label: About
  url: /about/
```

All three are accessed in templates by their filename stem:

```html
{\{ meta.author }\}
{\{ meta.siteTitle }\}
```

Changes to any file in `_data/` trigger a full site rebuild in watch mode.

## The Frontmatter

Frontmatter is declared at the very top of a source file between `---` delimiters. **YAML** is the default format:

```yaml
---
title: Hello World
date: 2024-06-01
tags: [post, featured]
layout: base.html
---
```

You can also use **JSON** by writing `---json` as the opening delimiter:

```json
---json
{
  "title": "Hello World",
  "tags": ["post", "featured"],
  "layout": "base.html"
}
---
```

### Reserved frontmatter keys

| Key | Effect |
| --- | --- |
| `layout` | Wraps the page in a layout from `_layouts/` |
| `tags` | Adds the page to one or more [collections](/collections) |
| `date` | Sets the page date used for sorting |
| `eleventyExcludeFromCollections` | `true` to exclude from all collections, or a list of tag names to exclude from specific ones |

## Using data inside templates

See the [Templating](/templating) page for the full template syntax. A quick example:

If `_data/meta.js` exports `{ author: 'Lea' }`, you can reference it as:

```html
{\{ meta.author }\}
```

If the value resolves to a function it is called with no arguments. If it returns a `Promise` it is awaited automatically.
