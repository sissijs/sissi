import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { SindieConfig } from '../src/sindie-config.js';
import md from '../src/md.js';
import html from '../src/html.js';

describe('md plugin', () => {

  let config;

  const virtualFileSystem = new Map();
  virtualFileSystem.set('index.md', [
    `<html-include src="header.html">`,
    `<html-include src="main.html">`,
  ].join('\n'));
  virtualFileSystem.set('_includes/header.html', '<header></header>');
  virtualFileSystem.set('_includes/main.html', '<main></main>');
  virtualFileSystem.set('_includes/nav.html', '<nav></nav>');

  virtualFileSystem.set('_includes/waterfall-header.html', '<header><html-include src="nav.html"></header>');
  virtualFileSystem.set('waterfall.md', '# Waterfall test\n\n<html-include src="waterfall-header.html">');
  
  virtualFileSystem.set('cyclic.md', '<html-include src="cyclic1.html">');
  virtualFileSystem.set('_includes/cyclic1.html', '<html-include src="cyclic2.html">');
  virtualFileSystem.set('_includes/cyclic2.html', '<html-include src="cyclic3.html">');
  virtualFileSystem.set('_includes/cyclic3.html', '<html-include src="cyclic1.html">');

  virtualFileSystem.set('md-includes.md', '# Markdown Includes Test\n\n<html-include src="partial.md">');
  virtualFileSystem.set('_includes/partial.md', 'Lorem ipsum dolor sit amet.')


  function dummyResolver(...paths) {
    const resource = path.normalize(path.join(...paths));
    return virtualFileSystem.get(resource);
  }
  
  before(() => {
    config = new SindieConfig();
    config.resolve = dummyResolver;
    config.addPlugin(md);
    config.addPlugin(html);
  });

  it('should add the processors to the config', () => {
    assert(config.extensions.has('html'));
    assert.equal(config.extensions.get('html').outputFileExtension, 'html');
    assert.equal(typeof config.extensions.get('html').compile, 'function');

    assert(config.extensions.has('md'));
    assert.equal(config.extensions.get('md').outputFileExtension, 'html');
    assert.equal(typeof config.extensions.get('md').compile, 'function');
  });

  it('should bundle html includes', async () => {
    const expectedFile = [
      virtualFileSystem.get('_includes/header.html'),
      virtualFileSystem.get('_includes/main.html')
    ].join('\n') + '\n';

    const transform = await config.extensions.get('md').compile(virtualFileSystem.get('index.md'), 'index.md');
    const result = await transform();

    assert.equal(result, expectedFile);
  });

  it('should handle waterfall includes nicely', async () => {
    const expectedFile = '<h1>Waterfall test</h1>\n\n<header><nav></nav></header>\n';
    const file = 'waterfall.md';

    const transform = await config.extensions.get('md').compile(virtualFileSystem.get(file), file);
    const result = await transform();

    assert.equal(result, expectedFile);
  });


  it('should handle cyclic includes nicely without crashing', async () => {
    const expectedFile = '<!-- missing include: cyclic1.html -->\n';
    const file = 'cyclic.md';

    const transform = await config.extensions.get('md').compile(virtualFileSystem.get(file), file);
    const result = await transform();

    assert.equal(result, expectedFile);
  });

});
