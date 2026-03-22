---
title: Templating
layout: base.html
---
Sindie comes with a basic markdown and html template engine.

## HTML Includes

You can include HTML via the html-include tag. It will fetch the partial HTML snippet from the `_includes` subfolder and inserts it in the right place. This part is heavily inspired by the [Going Buildless approach by Max Böck](https://mxb.dev/blog/buildless/) 

```html
<html-include src="header.html">
```

## Template Data

Sindie supports a "poor girl's handlebars". It looks for expressions wrapped in double curly braces and replaces them with the data accordingly. More details are in the [Data](/data) section.

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

## Built-in filters

You can provide one or multiple filters via the pipe notation:

### Do not escape (`safe`)

By default, angle brackets are escaped to `&lt;` and `&gt;`, in order to avoid injections. You can turn this off by adding a safe pipe to your expression:

```html
{\{ content | safe }\}
```

### Serialize to JSON (`json`)

You can serialize objects to JSON:

```html
{\{ meta | json }\}
```

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

### Work in progress

The following are unpolished and subject to change.

- `numberFormat`: format as number
- `currency`: format as currency
- `limit`: limit an array
- `reverse`: reverse an array

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
