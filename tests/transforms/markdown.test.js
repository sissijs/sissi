import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { markdown } from '../../src/transforms/markdown.js';

describe('markdown', () => {

  const l = async (file) => {
    const filename = path.resolve('tests/fixtures/markdown',file);
    const inputFile = filename + '.md';
    const outputFile = filename + '.html';
    const [input, output] = await Promise.all([
      readFile(inputFile, 'utf8'), 
      readFile(outputFile, 'utf8')
    ]);
    return [input, output]
  }

  it('transforms chunks of text into paragraphs', async () => {
    const [input, output] = await l('0000-paragraphs');
    assert.equal(markdown(input), output);
  });

  it('transforms headline correctly', async () => {
    const [input, output] = await l('0001-headlines');
    assert.equal(markdown(input), output);
  });
  
  it('transforms images correctly', async () => {
    const [input, output] = await l('0002-images');
    assert.equal(markdown(input), output);
  })

  it('transforms links correctly', async () => {
    const [input, output] = await l('0003-links');
    assert.equal(markdown(input), output);
  });

  it('transforms espaces correctly', async () => {
    const [input, output] = await l('0004-escaping');
    assert.equal(markdown(input), output);
  });

  it('transforms inline-elements', async () => {
    const [input, output] = await l('0005-inline-elements');
    assert.equal(markdown(input), output);
  });

  it('transforms unordered lists correctly', async () => {
    const [input, output] = await l('0006-unordered-list');
    assert.equal(markdown(input), output);
  });

  it('transforms unordered nested lists correctly', async () => {
    const [input, output] = await l('0007-nested-list');
    assert.equal(markdown(input), output);
  });

  it('transforms ordered lists correctly', async () => {
    const [input, output] = await l('0008-ordered-list');
    assert.equal(markdown(input), output);
  });

  it('transforms ordered nested lists correctly', async () => {
    const [input, output] = await l('0009-nested-ordered-list');
    assert.equal(markdown(input), output);
  });

  it('transforms blockquotes correctly', async () => {
    const [input, output] = await l('0010-blockquote');
    assert.equal(markdown(input), output);
  });

  it('transforms code blocks correctly', async () => {
    const [input, output] = await l('0011-code-block');
    assert.equal(markdown(input), output);
  });

  it('transforms deeply nested lists correctly', async () => {
    const [input, output] = await l('0012-deeply-nested-list');
    assert.equal(markdown(input), output);
  });

  it('transforms mixed ordered/unordered nested lists correctly', async () => {
    const [input, output] = await l('0013-mixed-nested-list');
    assert.equal(markdown(input), output);
  });

  it('transforms inline elements inside block-level elements correctly', async () => {
    const [input, output] = await l('0014-inlines-in-blocks');
    assert.equal(markdown(input), output);
  });

  it('transforms horizontal rules correctly', async () => {
    const [input, output] = await l('0015-horizontal-rule');
    assert.equal(markdown(input), output);
  });

  it('transforms setext-style headings correctly', async () => {
    const [input, output] = await l('0016-setext-headings');
    assert.equal(markdown(input), output);
  });

  it('transforms strikethrough correctly', async () => {
    const [input, output] = await l('0017-strikethrough');
    assert.equal(markdown(input), output);
  });

  it('transforms tables correctly', async () => {
    const [input, output] = await l('0018-table');
    assert.equal(markdown(input), output);
  });

  it('transforms multi-paragraph blockquotes correctly', async () => {
    const [input, output] = await l('0019-blockquote-multipar');
    assert.equal(markdown(input), output);
  });

  it('transforms task lists correctly', async () => {
    const [input, output] = await l('0020-task-list');
    assert.equal(markdown(input), output);
  });

  it('renders list-like paragraph correctly (ReDoS correctness)', async () => {
    const [input, output] = await l('0021-redos');
    assert.equal(markdown(input), output);
  });

  // With the old UL_PATTERN (/((\s*)(\-|...) (.+)\n)+/) this input causes
  // O(n²) backtracking — each of the ~1000 "- " positions triggers a scan
  // of the remaining string. The new anchored pattern is O(n).
  it('handles adjacent block elements without blank lines', async () => {
    const [input, output] = await l('0022-no-blank-line');
    assert.equal(markdown(input), output);
  });

  it('does not ReDoS on pathological list-like input', { timeout: 100 }, () => {
    const input = Array.from({ length: 1000 }, () => 'word').join(' - ') + '\n';
    const result = markdown(input);
    assert.ok(result.startsWith('<p>'));
  });

  it('escapes HTML inside inline code spans', async () => {
    const [input, output] = await l('0023-inline-code-escaping');
    assert.equal(markdown(input), output);
  });

});
