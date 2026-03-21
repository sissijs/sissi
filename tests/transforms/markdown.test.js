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


});
