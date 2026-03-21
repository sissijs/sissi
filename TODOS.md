# Markdown Processor Roadmap

## Bugs

- [x] Fix bold/italic semantics: `*text*` should be `<em>`, `**text**` should be `<strong>`, `_text_` should be `<em>`, `__text__` should be `<strong>` — currently `*` and `__` are swapped
- [x] Add missing `g` flag on inline code regex (`` /`(.+?)`/ `` only replaces the first occurrence per block)
- [x] Fix list nesting recovery: `stack.pop()` only runs once per item, so dedenting more than one level at a time silently breaks

## Architecture

- [x] Process block structure before inlines — currently `inlines()` runs first and block type detection relies on the transformed output (e.g. headings only work because `<h1>` matches `/^<.+?>/`)
- [x] Replace `{{ MARKDOWNSNIPPET }}` placeholders with a sentinel that can't conflict with real template expressions
- [x] Simplify / harden `markdownEscape` — the "escape `<>&` only when adjacent to whitespace" heuristic is fragile and has untested edge cases

## Missing Features

- [x] Horizontal rules — `---` / `***` / `___` (also resolves ambiguity with setext headings)
- [x] Setext-style headings — `Heading\n======` / `Heading\n------`
- [x] Strikethrough — `~~text~~`
- [x] Tables (GFM syntax)
- [x] Multi-paragraph blockquotes (currently breaks across `\n\n` boundaries)
- [x] Task lists — `- [ ]` / `- [x]`
