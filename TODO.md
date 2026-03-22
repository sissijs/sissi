# Documentation TODO

Three pages are significantly incomplete. Here's the plan:

## configuration.md — near-empty stub

- [x] Document both valid config file names (`.Sindie.js` and `.Sindie.config.js`)
- [x] Document the `dir` object with all keys and their defaults (`input`, `output`, `includes`, `layouts`, `data`)
- [x] Document all config API methods with examples:
  - `config.addPlugin(fn)`
  - `config.addFilter(name, fn)`
  - `config.addExtension(ext, fn)`
  - `config.addCollection(name, fn)`
  - `config.addTemplateFormats(formats)`
  - `config.setTemplateFormats(formats)`
  - `config.addPassthroughCopy()` (Eleventy compat no-op)
- [x] Document `naming` option (`defaultNaming` vs `directoryNaming`)
- [x] Document `--dry` CLI flag

## data.md — empty-section outline

- [x] Explain the data cascade and merge order (Sindie data → `_data/` files → frontmatter)
- [x] Document `_data/` directory: `.js` (default export), `.json`, `.yaml` files
- [x] Document frontmatter: default YAML format and JSON format (`---json`)
- [x] Document the `page` object and all its fields (`url`, `fileSlug`, `filePathStem`, `inputPath`, `outputPath`, `outputFileExtension`, `date`)

## templating.md — incomplete filter reference

- [x] Add missing array filters: `limit`, `reverse`, `sort`, `last`
- [x] Add missing string filters: `htmlentities`, `urlencode`
- [x] Add missing formatting filters: `date`, `currency`, `numberFormat` (all with locale support)
- [x] Add missing collection navigation filters: `getPreviousCollectionItem`, `getNextCollectionItem`
- [x] Document that template expressions inside `<pre>` and `<code>` blocks are never evaluated
- [x] Demote "work in progress" section now that those filters are stable

## configuration.md — plugin authoring guide missing

- [x] Add a section explaining how to write a custom plugin (not just how to register one)

## Bug: `last` filter is broken

- [x] Fix `src/builtin-filters.js` — `last(amount)` references undefined `array`; should be `last(array, amount)`
- [x] Add a test for `last`
