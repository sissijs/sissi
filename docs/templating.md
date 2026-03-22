---
title: Templating
layout: base.html
---
Sissi comes with a basic markdown and html template engine.

## HTML Includes

You can include HTML via the html-include tag. It will fetch the partial HTML snippet from the `_includes` subfolder and inserts it in the right place. This part is heavily inspired by the [Going Buildless approach by Max Böck](https://mxb.dev/blog/buildless/)

```html
<html-include src="header.html">
```

## Template Data

Sissi supports a "poor girl's handlebars". It looks for expressions wrapped in double curly braces and replaces them with the data accordingly. More details are in the [Data](/data) section.

If you put a `meta.json` inside the data dir, you can access it via curly brace notation:

```js
// meta.js
{
  "author": "Lea Rosema"
}
```

```html
<author>{\{ meta.author }\}</author>
```

The code above will resolve to {{ meta.author }} (there is a meta.json in this site.)

### Escaping curly braces

Prefix a curly brace with a backslash to output it literally:

```html
\{\{ not a template expression \}\}
```

### Code blocks are never evaluated

Template expressions inside `<pre>` and `<code>` tags are left as-is and never evaluated. This lets you document template syntax without having to escape every `{{`:

```html
<pre>
  <code>{\{ title }\}</code>
</pre>
```

## Built-in filters

You can provide one or multiple filters via the pipe notation:

### Do not escape (`safe`)

By default, angle brackets are escaped to `&lt;` and `&gt;`, in order to avoid injections. You can turn this off by adding a safe pipe to your expression:

```html
{\{ content | safe }\}
```

### Serialize to JSON (`json`)

You can serialize objects to JSON:

```html
{\{ meta | json }\}
{\{ meta | json: true }\}
```

Pass `true` as an argument for pretty-printed (indented) output.

### Resolve asynchronous JavaScript (`async`)

```html
{\{ fetchJson('https://yesno.wtf/api') | async }\}
```

### Iterate through array (`each`)

```html
{\{
  fetchJson('people.json')
  | async
  | each: (item) => `<li>${item}</li>`
}\}
```

### Array filters

**`limit`** — return the first N items:

```html
{\{ collections.post | limit: 5 }\}
```

**`reverse`** — return a reversed copy of the array (non-mutating):

```html
{\{ collections.post | reverse }\}
```

**`sort`** — return a sorted copy of the array (non-mutating):

```html
{\{ tags | sort }\}
```

**`last`** — return the last N items in reverse order:

```html
{\{ collections.post | last: 3 }\}
```

### String filters

**`htmlentities`** — escape `&`, `<`, and `>` to HTML entities:

```html
{\{ userInput | htmlentities }\}
```

**`urlencode`** — percent-encode a string for use in a URL:

```html
<a href="/search?q={\{ query | urlencode }\}">Search</a>
```

### Formatting filters

**`date`** — format a date using `Intl.DateTimeFormat`. Accepts an options object and an optional locale (default `en-US`):

```html
{\{ page.date | date }\}
{\{ page.date | date: { dateStyle: 'long' } }\}
{\{ page.date | date: { dateStyle: 'long' }, 'de-DE' }\}
```

**`currency`** — format a number as currency using `Intl.NumberFormat`. Defaults to USD and `en-US`:

```html
{\{ price | currency }\}
{\{ price | currency: 'EUR', 'de-DE' }\}
```

**`numberFormat`** — format a number using `Intl.NumberFormat`:

```html
{\{ value | numberFormat }\}
{\{ value | numberFormat: { maximumFractionDigits: 2 } }\}
```

### Collection navigation filters

These filters help you build previous/next navigation between pages in a collection.

**`getPreviousCollectionItem`** — returns the item before the current page, or `null`:

```html
{\{ collections.post | getPreviousCollectionItem: page | safe }\}
```

**`getNextCollectionItem`** — returns the item after the current page, or `null`:

```html
{\{ collections.post | getNextCollectionItem: page | safe }\}
```

A typical prev/next navigation pattern:

```html
{\{
  collections.post
  | getPreviousCollectionItem: page
  | safe
}\}
```

```js
// _data/prevNext.js — example helper
export default function prevNext(collection, page, filters) {
  const prev = filters.get('getPreviousCollectionItem')(collection, page);
  const next = filters.get('getNextCollectionItem')(collection, page);
  const parts = [];
  if (prev) parts.push(`<a href="${prev.page.url}">← ${prev.data.title}</a>`);
  if (next) parts.push(`<a href="${next.page.url}">${next.data.title} →</a>`);
  return parts.join(' ');
}
```

## Custom filters

You can add custom filters inside your config:

```js
config.addFilter('SCREAM', (str) => str.toUpperCase());
config.addFilter('piratify',
  (str, prefix = 'Yo-ho-ho', suffix = 'yarrr') =>
    `${prefix}! ${str}, ${suffix}!`
);
```

```html
{\{ meta.author | SCREAM }\}
resolves to LEA ROSEMA
{\{ "Hello " + meta.author | piratify: 'Aye' }\} resolves to "Aye! Hello Lea Rosema, yarrr!"
```

## Execute arbitrary JavaScript expressions

You can run arbitrary JavaScript inside the curly brackets:

```html
<ul>
  {\{
    people()
      .map(person => `<li>${person}</li>`)
      .join('')
    | async
  }\}
</ul>
```

### But there is no await (yet?)

With asynchronous content, things get a bit trickier, as there is no `await`.

Imagine you defined a `fetchJson` helper function:

```js
// _data/fetchJson.js
export default async function fetchJson(request) {
  const response = await fetch(request);
  const json = await response.json();
  return json;
}
```

This is why there is the async filter. You can combine it with the `each` filter function.

```js
// _data/ListItem.js
export default function ListItem(item) {
  return `<li>${item}</li>`
}
```

```html
<ul>
  {\{ fetchJson('people') | async | each: ListItem }\}
</ul>
```

The async filter resolves the promise of the fetch request. When the result is an array,
the `each` operator takes each item, passes it to the ListItem
function and then concatenates the result.
