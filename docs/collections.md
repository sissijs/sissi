---
title: Collections
layout: base.html
---
# {{ title }}

Collections let you group pages together and iterate over them in templates — useful for blog post listings, tag indexes, project galleries, and anything else that needs a "list of pages" at build time.

## How it works

Before any template is rendered, Sissi scans all input files, reads their frontmatter, and assembles a `collections` object. That object is then available in every template during the build.

---

## `collections.all`

Every template file is automatically added to `collections.all`, regardless of whether it has any tags. Items are sorted by date ascending (oldest first).

```html
<ul>
  {\{
    collections.all
      .map(item => `<li><a href="${item.page.url}">${item.data.title}</a></li>`)
      .join('')
    | safe
  }\}
</ul>
```

---

## Tag-based collections

Add a `tags` key to any page's frontmatter and Sissi automatically creates a named collection for it:

```yaml
---
title: My First Post
tags: post
---
```

Multiple tags can be assigned with a YAML list:

```yaml
---
title: My First Post
tags:
  - post
  - featured
---
```

Both `collections.post` and `collections.featured` will contain this page. Access them in any template:

```html
<ul>
  {\{
    collections.post
      .map(item => `<li><a href="${item.page.url}">${item.data.title}</a></li>`)
      .join('')
    | safe
  }\}
</ul>
```

---

## Collection item structure

Each item in a collection is an object with the following fields:

| Field | Description |
|---|---|
| `page.url` | Output URL (e.g. `/posts/hello.html`) |
| `page.inputPath` | Source file path relative to the input directory |
| `page.outputPath` | Absolute output file path |
| `page.fileSlug` | Filename without extension (e.g. `hello`) |
| `page.filePathStem` | Path without extension (e.g. `/posts/hello`) |
| `page.date` | Date object — from frontmatter `date` field, or epoch if not set |
| `data` | All frontmatter data merged with global data |
| `content` | Empty string at collection-build time (collections are built before rendering) |
| `rawInput` | Raw source content of the file |

---

## Sorting

All collections are sorted ascending by date (oldest first). The `page.date` field is populated from the frontmatter `date` field, parsed as a JavaScript `Date`. If no date is set, the item sorts to the beginning (epoch).

To sort descending (newest first), reverse the array in your template:

```html
{\{
  collections.post
    .toReversed()
    .map(item => `<li>${item.data.title}</li>`)
    .join('')
  | safe
}\}
```

---

## Excluding pages from collections

### Exclude from everything

Set `eleventyExcludeFromCollections: true` in frontmatter to keep a page out of all collections, including `collections.all`:

```yaml
---
title: Draft Post
eleventyExcludeFromCollections: true
---
```

### Exclude from specific tags

Pass an array of tag names to exclude the page from just those tag collections while keeping it in `collections.all` and any other tags:

```yaml
---
title: Unlisted Post
tags:
  - post
  - unlisted
eleventyExcludeFromCollections:
  - unlisted
---
```

---

## Custom collections

Register a custom collection in your config file using `addCollection`. The callback receives a `CollectionsAPI` instance and must return the value to expose as `collections.<name>`.

```js
// .sissi.config.js
export default function(config) {
  // All posts, sorted newest first
  config.addCollection('latestPosts', (api) =>
    api.getFilteredByTag('post').toReversed()
  );

  // Only posts that are also tagged 'featured'
  config.addCollection('featuredPosts', (api) =>
    api.getFilteredByTags('post', 'featured')
  );

  // All pages under the posts/ directory
  config.addCollection('postsByGlob', (api) =>
    api.getFilteredByGlob('posts/*.md')
  );
}
```

Custom collections support async callbacks:

```js
config.addCollection('enriched', async (api) => {
  const items = api.getAllSorted();
  // fetch extra data, transform items, etc.
  return items;
});
```

---

## Previous and next item navigation

Three functions are available in every template to navigate adjacent items in a collection. Because Sissi's pipe syntax splits on `|`, these are exposed as **callable functions** rather than pipe filters — call them directly inside `{{ }}` expressions:

```html
<!-- Link to the previous post -->
{{
  getPreviousCollectionItem(collections.post, page)?.page?.url
}}

<!-- Link to the next post -->
{{
  getNextCollectionItem(collections.post, page)?.page?.url
}}

<!-- Zero-based position of this page in the collection -->
{{ getCollectionItemIndex(collections.post, page) }}
```

A complete prev/next navigation block:

```html
{{ (() => {
  const prev = getPreviousCollectionItem(collections.post, page);
  const next = getNextCollectionItem(collections.post, page);
  const prevLink = prev ? `<a href="${prev.page.url}">← ${prev.data.title}</a>` : '';
  const nextLink = next ? `<a href="${next.page.url}">${next.data.title} →</a>` : '';
  return [prevLink, nextLink].filter(Boolean).join(' · ');
})() | safe }}
```

All three functions match the current page by `page.inputPath`. They return `null` (for `getPreviousCollectionItem` / `getNextCollectionItem`) or `-1` (for `getCollectionItemIndex`) when the page is not found or there is no adjacent item.

You can also use these as pipe filters when you only need the raw object:

```html
<!-- Returns the collection item object (use json filter to inspect) -->
{{ collections.post | getPreviousCollectionItem: page | json }}
```

---

## CollectionsAPI reference

The `CollectionsAPI` object passed to `addCollection` callbacks has these methods:

| Method | Returns |
|---|---|
| `getAll()` | All items, unsorted |
| `getAllSorted()` | All items sorted by date ascending |
| `getFilteredByTag(tag)` | Items with that tag, sorted |
| `getFilteredByTags(...tags)` | Items that have *all* specified tags, sorted |
| `getFilteredByGlob(glob)` | Items whose `inputPath` matches the glob, sorted |

`getFilteredByGlob` supports `*` (matches within a path segment) and `**` (matches across segments):

```js
api.getFilteredByGlob('posts/*.html')     // direct children of posts/
api.getFilteredByGlob('posts/**/*.html')  // any depth under posts/
```

---

## Full example: blog post listing

**`posts/hello.md`**

```markdown
---
title: Hello World
tags: post
date: 2024-03-01
---
This is my first post.
```

**`posts/second.md`**

```markdown
---
title: Second Post
tags: post
date: 2024-04-01
---
This is my second post.
```

**`index.html`**

```html
<h2>All posts</h2>
<ul>
  {\{ collections.post
    .map(p => `<li><a href="${p.page.url}">${p.data.title}</a></li>`)
    .join('')
  | safe }\}
</ul>
```

Sissi renders `collections.post` as a date-sorted array, so the oldest post appears first.
