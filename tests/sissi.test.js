import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

  it('should reload _data and rebuild all when a data file changes during watch', async () => {
    const tmpDir = await realpath(await mkdtemp(path.join(tmpdir(), 'sissi-test-')));
    const dataDir = path.join(tmpDir, '_data');
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, 'site.json'), JSON.stringify({ title: 'Original' }));
    await writeFile(path.join(tmpDir, 'index.html'), '{{ site.title }}');
    // Let macOS FSEvents drain buffered events from the file writes above
    // before the watcher starts, to avoid spurious initial events.
    await new Promise(r => setTimeout(r, 200));

    const config = new SissiConfig({ dir: { input: tmpDir, output: path.join(tmpDir, 'public') } });
    config.watchFileDelta = 0;
    const sissi = new Sissi(config);
    sissi.dryMode = true;

    let buildCount = 0;
    let lastBuildFilter;
    const controller = new AbortController();
    const originalBuild = sissi.build.bind(sissi);
    sissi.build = async (filter, ...rest) => {
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
      sissi.watch(null, { signal: controller.signal }),
      triggerChange(),
    ]);

    assert.equal(buildCount, 2, 'build() should be called twice (initial + data reload)');
    assert.equal(lastBuildFilter, null, 'data reload triggers a full build (filter=null)');
    assert.deepEqual(sissi.data.site, { title: 'Updated' }, 'this.data reflects the reloaded data');

    await rm(tmpDir, { recursive: true });
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
