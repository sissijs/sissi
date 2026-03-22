---
title: All about Data
layout: base.html
---

# All about Data

## Data Cascade

When Sindie processes a template it merges data from three sources, in order of increasing precedence:

1. **Sindie built-ins** — the `page` object, `collections`, and anything provided by plugins
2. **`_data/` files** — global data loaded from your data directory
3. **Frontmatter** — per-file data declared at the top of each source file

Later sources win, so frontmatter values override global data, and global data overrides Sindie defaults.

## Data provided by Sindie

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

Sissi supports a "poor girl's handlebars". It looks for expressions wrapped in double curly braces and replaces them with the data accordingly. If the data is resolved as a function, a parameterless function call will be invoked. If the data results a Promise, it is automatically resolved.

If you place a javascript file named `meta.js` in your _data directory which provides a default export, you can access the object like this:

```js
export default {
  author: 'Lea'
};
```

```html
{\{ meta.author }\}
```

Alternatively, you can put json or yaml into the data directory.

