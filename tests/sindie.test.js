import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SindieConfig } from '../src/sindie-config.js';
import { Sindie } from '../src/sindie.js';

import html from '../src/html.js';
import css from '../src/css.js';

describe('sindie', () => {

  it('should successfully build a smallsite', async () => {

    const config = new SindieConfig({
      dir: {
        input: 'tests/fixtures/smallsite',
        output: ''
      }
    });
    config.addPlugin(html);
    config.addPlugin(css);
    const sindie = new Sindie(config);
    sindie.dryMode = true;
    
    const writtenFiles = await sindie.build();

    writtenFiles.sort();

    assert.deepEqual(writtenFiles,
      ['css/styles.css', 'imprint.html', 'index.html', 'test.html']
    );
  });

  it('should build exactly once on startup (via watch, not a separate build call)', async () => {
    const config = new SindieConfig({
      dir: { input: 'tests/fixtures/smallsite', output: '' }
    });
    const sindie = new Sindie(config);
    sindie.dryMode = true;

    let buildCount = 0;
    const controller = new AbortController();
    const originalBuild = sindie.build.bind(sindie);
    sindie.build = async (...args) => {
      buildCount++;
      const result = await originalBuild(...args);
      controller.abort(); // exit the watcher loop right after the initial build
      return result;
    };

    await sindie.watch(null, { signal: controller.signal });

    assert.equal(buildCount, 1, 'build() should be called exactly once on startup');
  });

  it('should reload _data and rebuild all when a data file changes during watch', async () => {
    const tmpDir = await realpath(await mkdtemp(path.join(tmpdir(), 'sindie-test-')));
    const dataDir = path.join(tmpDir, '_data');
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, 'site.json'), JSON.stringify({ title: 'Original' }));
    await writeFile(path.join(tmpDir, 'index.html'), '{{ site.title }}');
    // Let macOS FSEvents drain buffered events from the file writes above
    // before the watcher starts, to avoid spurious initial events.
    await new Promise(r => setTimeout(r, 200));

    const config = new SindieConfig({ dir: { input: tmpDir, output: path.join(tmpDir, 'public') } });
    config.watchFileDelta = 0;
    const sindie = new Sindie(config);
    sindie.dryMode = true;

    let buildCount = 0;
    let lastBuildFilter;
    const controller = new AbortController();
    const originalBuild = sindie.build.bind(sindie);
    sindie.build = async (filter, ...rest) => {
      buildCount++;
      lastBuildFilter = filter;
      const result = await originalBuild(filter, ...rest);
      if (buildCount >= 2) controller.abort();
      return result;
    };

    // Trigger the data file change concurrently, after giving the watcher loop time to start
    const triggerChange = async () => {
      await new Promise(r => setTimeout(r, 100));
      await writeFile(path.join(dataDir, 'site.json'), JSON.stringify({ title: 'Updated' }));
    };

    await Promise.all([
      sindie.watch(null, { signal: controller.signal }),
      triggerChange(),
    ]);

    assert.equal(buildCount, 2, 'build() should be called twice (initial + data reload)');
    assert.equal(lastBuildFilter, null, 'data reload triggers a full build (filter=null)');
    assert.deepEqual(sindie.data.site, { title: 'Updated' }, 'this.data reflects the reloaded data');

    await rm(tmpDir, { recursive: true });
  });

  it('serve() should build once and stop cleanly when aborted', async () => {
    const config = new SindieConfig({
      dir: { input: 'tests/fixtures/smallsite', output: 'public' },
    });
    const sindie = new Sindie(config);
    sindie.dryMode = true;

    let buildCount = 0;
    const controller = new AbortController();
    const originalBuild = sindie.build.bind(sindie);
    sindie.build = async (...args) => {
      buildCount++;
      const result = await originalBuild(...args);
      controller.abort();
      return result;
    };

    await sindie.serve({ signal: controller.signal, port: 0 });

    assert.equal(buildCount, 1, 'build() should be called exactly once');
  });
});
