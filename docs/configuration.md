---
title: Configuration
layout: base.html
---
# {{ title }}

## Config file

Sissi looks for a config file named `.sissi.js` or `.sissi.config.js` in the project root. The file must have a default export that is a function:

```js
// .sissi.config.js
export default function(config) {
  // register plugins and filters here
  return {
    dir: { input: 'src', output: 'dist' }
  };
}
```

The function receives a `SissiConfig` instance and may return an object with a `dir` key to override directories.

## Directory options

All paths are relative to the project root. These are the defaults:

| Key        | Default      | Description                                      |
|------------|--------------|--------------------------------------------------|
| `input`    | `.`          | Source directory                                 |
| `output`   | `public`     | Build output directory                           |
| `includes` | `_includes`  | Partials for `<html-include src="..."/>`         |
| `layouts`  | `_layouts`   | Layout templates (referenced via frontmatter)    |
| `data`     | `_data`      | Global data files (`.js`, `.json`, `.yaml`)      |

```js
export default function(config) {
  return {
    dir: {
      input: 'src',
      output: 'dist',
      includes: 'src/_includes',
      layouts: 'src/_layouts',
      data: 'src/_data',
    }
  };
}
```

## Output naming

By default Sissi preserves the input path and swaps the file extension (`defaultNaming`). You can switch to directory-based URLs with `directoryNaming`, which turns `about.html` into `about/index.html`:

```js
import { directoryNaming } from 'sissi/naming';

export default function(config) {
  config.naming = directoryNaming;
}
```

## config API

### `config.addPlugin(fn)`

Registers a plugin. Plugins follow the same signature as the config function — they receive the `SissiConfig` instance and may return a `dir` override.

```js
import myPlugin from './my-plugin.js';

export default function(config) {
  config.addPlugin(myPlugin);
}
```

### `config.addFilter(name, fn)`

Registers a template filter. Filters are called via the pipe syntax in templates.

```js
config.addFilter('shout', (str) => str.toUpperCase());
config.addFilter('prefix', (str, pre) => `${pre}${str}`);
```

```html
{\{ title | shout }\}
{\{ title | prefix: 'Hello, ' }\}
```

### `config.addExtension(ext, processingFunction)`

Registers a compiler for a file extension. Also implicitly adds the extension to the set of template formats so those files are compiled rather than passthrough-copied.

### `config.addCollection(name, fn)`

Registers a named collection. The callback receives a `CollectionsAPI` and must return an array. See the [Collections](/collections) page for details.

```js
config.addCollection('recentPosts', (api) =>
  api.getFilteredByTag('post').slice(0, 5)
);
```

### `config.addTemplateFormats(formats)`

Marks additional file extensions as template formats. Accepts a comma-separated string or an array.

```js
config.addTemplateFormats('njk,liquid');
config.addTemplateFormats(['njk', 'liquid']);
```

### `config.setTemplateFormats(formats)`

Replaces the full set of template formats. Same argument shape as `addTemplateFormats`.

### `config.addPassthroughCopy(paths)`

No-op for Eleventy compatibility. In Sissi, every file whose extension is not in `templateFormats` is passthrough-copied automatically — you never need to opt in explicitly.

## Writing a plugin

A plugin is just a function with the same shape as the config function — it receives the `SissiConfig` instance, calls any config methods it needs, and optionally returns a `dir` override.

### Adding a new template format

The most common use case is registering a compiler for a new file extension via `config.addExtension`. The compiler object must have:

- **`outputFileExtension`** — the extension of the output file (e.g. `'html'`)
- **`compile(inputContent, inputPath)`** — an async function that receives the raw file content and path, and returns another async function that receives the template data and returns the final string

```js
// my-plugin.js
export default function myPlugin(config) {
  config.addExtension('txt', {
    outputFileExtension: 'html',
    compile: async (inputContent, inputPath) => {
      return async (data) => {
        // transform inputContent into HTML here
        return `<pre>${inputContent}</pre>`;
      };
    },
  });
}
```

### Adding filters inside a plugin

Plugins can also bundle filters so related functionality ships together:

```js
// my-plugin.js
export default function myPlugin(config) {
  config.addFilter('shout', (str) => str.toUpperCase());

  config.addExtension('txt', {
    outputFileExtension: 'html',
    compile: async (inputContent) => async () => `<pre>${inputContent}</pre>`,
  });
}
```

### Using the plugin

```js
// .sissi.config.js
import myPlugin from './my-plugin.js';

export default function(config) {
  config.addPlugin(myPlugin);
}
```

## CLI flags

| Command          | Description                                           |
|------------------|-------------------------------------------------------|
| `sissi build`    | One-time build to the output directory                |
| `sissi watch`    | Watch mode — rebuilds on file changes                 |
| `sissi dev`      | Dev server with watch mode and hot reload             |
| `--dry`          | Skip writing files (useful for debugging the build)   |
