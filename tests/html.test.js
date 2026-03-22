import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { SindieConfig } from '../src/sindie-config.js';
import html from '../src/html.js'



describe('html plugin', () => {

  let config;

  const virtualFileSystem = new Map();
  virtualFileSystem.set('index.html', [
    `<html-include src="header.html">`,
    `<html-include src="main.html">`,
  ].join('\n'));
  virtualFileSystem.set('_includes/header.html', '<header></header>');
  virtualFileSystem.set('_includes/main.html', '<main></main>');
  virtualFileSystem.set('_includes/nav.html', '<nav></nav>');

  virtualFileSystem.set('_includes/waterfall-header.html', '<header><html-include src="nav.html"></header>');
  virtualFileSystem.set('waterfall.html', '<html><body><html-include src="waterfall-header.html"></body></html>');
  
  virtualFileSystem.set('cyclic.html', '<html-include src="cyclic1.html">');
  virtualFileSystem.set('_includes/cyclic1.html', '<html-include src="cyclic2.html">');
  virtualFileSystem.set('_includes/cyclic2.html', '<html-include src="cyclic3.html">');
  virtualFileSystem.set('_includes/cyclic3.html', '<html-include src="cyclic1.html">');

  function dummyResolver(...paths) {
    const resource = path.normalize(path.join(...paths));
    return virtualFileSystem.get(resource);
  }
  
  before(() => {
    config = new SindieConfig();
    config.resolve = dummyResolver;
    config.addPlugin(html);
  });

  it('should add the HTML processor to the config', () => {
    assert(config.extensions.has('html'));
    assert.equal(config.extensions.get('html').outputFileExtension, 'html');
    assert.equal(typeof config.extensions.get('html').compile, 'function');
  });

  it('should bundle html includes', async () => {
    const expectedFile = [
      virtualFileSystem.get('_includes/header.html'),
      virtualFileSystem.get('_includes/main.html')
    ].join('\n');

    const transform = await config.extensions.get('html').compile(virtualFileSystem.get('index.html'), 'index.html');
    const result = await transform();

    assert.equal(result, expectedFile);
  });

  it('should handle waterfall includes nicely', async () => {
    const expectedFile = '<html><body><header><nav></nav></header></body></html>';
    const file = 'waterfall.html';

    const transform = await config.extensions.get('html').compile(virtualFileSystem.get(file), file);
    const result = await transform();

    assert.equal(result, expectedFile);
  });


  it('should handle cyclic includes nicely without crashing', async () => {
    const expectedFile = '<!-- missing include: cyclic1.html -->';
    const file = 'cyclic.html';

    const transform = await config.extensions.get('html').compile(virtualFileSystem.get(file), file);
    const result = await transform();

    assert.equal(result, expectedFile);
  });

});
