import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { SindieConfig } from '../src/sindie-config.js';
import css from '../src/css.js'



describe('css plugin', () => {

  let config;

  const virtualFileSystem = new Map();
  virtualFileSystem.set('styles.css', [
    `@import "A.css";`,
    `@import "B.css";`,
  ].join('\n'));
  virtualFileSystem.set('A.css', '.a { color: red; }\n');
  virtualFileSystem.set('B.css', '.b { color: green; }\n');
  virtualFileSystem.set('C.css', '@import "styles.css";\n.c { color: blue; }\n');
  virtualFileSystem.set('layer.css', '@import "A.css" layer (reset);\n');

  virtualFileSystem.set('cyclic.css', '@import "cyclic1.css";\n');
  virtualFileSystem.set('cyclic1.css', '@import "cyclic2.css";\n');
  virtualFileSystem.set('cyclic2.css', '@import "cyclic3.css";\n');
  virtualFileSystem.set('cyclic3.css', '@import "cyclic1.css";\n');

  function dummyResolver(...paths) {
    const resource = path.normalize(path.join(...paths));
    const match = resource.match(/\\?\/?(\w+.css)$/);
    if (!match || !virtualFileSystem.has(match[1]) ) {
      throw new Error('Virtual File not found')
    }
    const file = match[1];
    return virtualFileSystem.get(file);
  }
  
  before(() => {
    config = new SindieConfig();
    config.resolve = dummyResolver;
    config.addPlugin(css);
  });

  it('should add the CSS processor to the config extension', () => {
    assert(config.extensions.has('css'));
    assert(config.extensions.get('css').outputFileExtension === 'css');
    assert(typeof config.extensions.get('css').compile === 'function');
  });

  it('should bundle css assets', async () => {
    const expectedFile = [
      virtualFileSystem.get('A.css').trim(),
      virtualFileSystem.get('B.css').trim()
    ].join('\n') + '\n';

    const transform = await config.extensions.get('css').compile(virtualFileSystem.get('styles.css'), 'styles.css');
    const result = await transform();

    assert.equal(result, expectedFile);
  });

  it('should handle waterfall includes', async () => {
    const expectedFile = [
      '.a { color: red; }',
      '.b { color: green; }',
      '.c { color: blue; }'
    ].join('\n') + '\n';

    const transform = await config.extensions.get('css').compile(virtualFileSystem.get('C.css'), 'C.css');
    const result = await transform();

    assert.equal(result, expectedFile);
  });

  it('should handle css layers', async () => {
    const expectedFile = `@layer reset {\n${virtualFileSystem.get('A.css')}\n}\n`

    const transform = await config.extensions.get('css').compile(virtualFileSystem.get('layer.css'), 'layer.css');
    const result = await transform();

    assert.equal(result, expectedFile);
  });

  it('should handle cyclic dependencies without crashing', async () => {
    const expectedFile = `@import url("cyclic1.css");\n`

    const transform = await config.extensions.get('css').compile(virtualFileSystem.get('cyclic.css'), 'cyclic.css');
    const result = await transform();

    assert.equal(result, expectedFile);
  });

});
