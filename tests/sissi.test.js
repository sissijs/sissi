import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SissiConfig } from '../src/sissi-config.js';
import { Sissi } from '../src/sissi.js';

import html from '../src/html.js';
import css from '../src/css.js';

describe('sissi', () => {

  it('should successfully build a smallsite', async () => {

    const config = new SissiConfig({
      dir: {
        input: 'tests/fixtures/smallsite',
        output: ''
      }
    });
    config.addPlugin(html);
    config.addPlugin(css);
    const sissi = new Sissi(config);
    sissi.dryMode = true;
    
    const writtenFiles = await sissi.build();

    writtenFiles.sort();

    assert.deepEqual(writtenFiles,
      ['css/styles.css', 'imprint.html', 'index.html', 'test.html']
    );
  });

  it('should build exactly once on startup (via watch, not a separate build call)', async () => {
    const config = new SissiConfig({
      dir: { input: 'tests/fixtures/smallsite', output: '' }
    });
    const sissi = new Sissi(config);
    sissi.dryMode = true;

    let buildCount = 0;
    const controller = new AbortController();
    const originalBuild = sissi.build.bind(sissi);
    sissi.build = async (...args) => {
      buildCount++;
      const result = await originalBuild(...args);
      controller.abort(); // exit the watcher loop right after the initial build
      return result;
    };

    await sissi.watch(null, { signal: controller.signal });

    assert.equal(buildCount, 1, 'build() should be called exactly once on startup');
  });

  it('serve() should build once and stop cleanly when aborted', async () => {
    const config = new SissiConfig({
      dir: { input: 'tests/fixtures/smallsite', output: 'public' },
    });
    const sissi = new Sissi(config);
    sissi.dryMode = true;

    let buildCount = 0;
    const controller = new AbortController();
    const originalBuild = sissi.build.bind(sissi);
    sissi.build = async (...args) => {
      buildCount++;
      const result = await originalBuild(...args);
      controller.abort();
      return result;
    };

    await sissi.serve({ signal: controller.signal, port: 0 });

    assert.equal(buildCount, 1, 'build() should be called exactly once');
  });
});
