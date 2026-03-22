import { existsSync } from 'node:fs';
import { mkdir, watch, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { SissiConfig } from './sissi-config.js';
import { serve } from './httpd.js';
import EventEmitter from 'node:events';
import { readDataDir } from './data.js';
import { handleTemplateFile } from './transforms/template-data.js';
import { getDependencyMap, walkDependencyMap } from './dependency-graph.js';
import { resolve } from './resolver.js';

export class Sissi {

  /**
   * @param {SissiConfig} [config] - Project configuration. Defaults to a new SissiConfig with built-in plugins.
   */
  constructor(config = null) {
    this.config = config || new SissiConfig();
    this.dryMode = false;
    this.data = null;
  }

  /**
   * Build the site.
   *
   * Reads all input files (or a filtered subset), processes each through the
   * plugin and template pipeline, and writes the results to the output directory.
   * Skips the write step when {@link Sissi#dryMode} is `true`.
   *
   * @param {string[]|RegExp|null} [filter] - Limit which files are built.
   *   Pass an array of file paths, a RegExp tested against each path, or `null` to build everything.
   * @param {import('node:events').EventEmitter} [eventEmitter] - When provided, a `watch-event` is
   *   emitted for each written file so the dev server can push live-reload signals.
   * @returns {Promise<string[]>} Resolves with the list of output file paths that were written.
   */
  async build(filter = null, eventEmitter) {
    if (! this.data) {
      this.data = await readDataDir(this.config);
    }
    const files = (filter instanceof Array) ? filter : 
      (await readdir(path.normalize(this.config.dir.input), {recursive: true})).filter(
      (file) => {
        if (! filter) return true;
        if (filter instanceof RegExp) return filter.test(file);
      }
    );
    const writtenFiles = [];
    for (const file of files) {
      writtenFiles.push(await this.processFile(file, eventEmitter));
    }
    return writtenFiles.filter(Boolean);
  }

  /**
   * Perform an initial build, then watch the input directory for changes and
   * incrementally rebuild affected files.
   *
   * Uses the dependency graph to determine which files depend on the changed
   * file, so only the minimum set of files is rebuilt on each change.
   * Debounce interval is controlled by {@link SissiConfig#watchFileDelta}.
   *
   * @param {import('node:events').EventEmitter} [eventEmitter] - Passed to {@link Sissi#build}
   *   so the dev server can push live-reload signals to connected browsers.
   * @param {object} [watchOptions] - Extra options forwarded to `fs.watch()`.
   * @param {AbortSignal} [watchOptions.signal] - When aborted, stops the watcher and resolves the promise.
   * @param {string[]} [ignoreList=[]] - Additional directory prefixes to ignore on top of the
   *   output directory and `.git`.
   * @returns {Promise<void>} Resolves when the watcher stops.
   */
  async watch(eventEmitter = null, watchOptions = null, ignoreList = []) {
    if (! this.data) {
      this.data = await readDataDir(this.config);
    }
    await this.build();
    const lastExec = new Map();
    const options = { recursive: true };
    if (watchOptions) {
      Object.assign(options, watchOptions);
    }
    const inputDir = path.normalize(this.config.dir.input);
    const ignores = [
      path.normalize(this.config.dir.output), 
      '.git', 
      ...ignoreList
    ];
    if (! existsSync(inputDir)) {
      throw new Error(`Input directory Not found: ${this.config.dir.input}`);
    }
    console.info(`[watch]\tSissi is watching ${this.config.dir.input}`);
    try {
      const watcher = watch(this.config.dir.input, options);
      for await (const event of watcher) {
        if (lastExec.has(event.filename)) {
          const delta = performance.now() - lastExec.get(event.filename);
          if (delta < this.config.watchFileDelta) {
            continue;
          }
        }
        const info = path.parse(event.filename);
        if (ignores.find(d => info.dir.startsWith(path.normalize(d)))) {
          continue;
        }
        lastExec.set(event.filename, performance.now());
        console.log(`[${event.eventType}] ${event.filename}`);
        const deps = await getDependencyMap(
          this.config.dir.input,
          await readdir(path.normalize(this.config.dir.input), {recursive: true}),
          this.config.resolve || resolve
        );
        const allDependants = walkDependencyMap(deps, event.filename);
        await this.build([event.filename, ...allDependants], eventEmitter);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      throw err;
    }
  }

  /**
   * Process a single input file through the full pipeline and write the result.
   *
   * Files whose name (or any path segment) starts with `_` are skipped silently.
   * Binary files without a registered plugin are copied as-is.
   *
   * @param {string} inputFileName - Path to the input file, relative to the input directory.
   * @param {import('node:events').EventEmitter} [eventEmitter] - When provided, a `watch-event`
   *   is emitted after the file is written so the dev server can trigger live-reload.
   * @returns {Promise<string|null>} The output file path, or `null` if the file was skipped.
   */
  async processFile(inputFileName, eventEmitter) {
    if (! this.data) {
      this.data = await readDataDir(this.config);
    }
    if (inputFileName.startsWith('_') || inputFileName.includes(path.sep + '_') || path.parse(inputFileName).name.startsWith('_')) {
      return;
    }

    const tpl = await handleTemplateFile(this.config, this.data, inputFileName);
    if (! tpl) {
      return null;
    }
    
    console.log(`[write]\t${tpl.filename}`);
    if (eventEmitter) {
      eventEmitter.emit('watch-event', {
        eventType: 'change',
        filename: tpl.filename,
        page: tpl.page
      });
    }
    if (! this.dryMode) {
      await mkdir(path.parse(tpl.filename).dir, {recursive: true});
      await writeFile(tpl.filename, tpl.content || '', {});
    }
    return tpl.filename;
  }

  /**
   * Start the dev server and watch for file changes.
   *
   * @param {object} [listenOptions] - Options passed to the HTTP server.
   * @param {number} [listenOptions.port=8000] - Port to listen on. Defaults to the PORT env var or 8000.
   * @param {string} [listenOptions.host='localhost'] - Host to bind to. Defaults to the HOST env var or 'localhost'.
   * @param {AbortSignal} [listenOptions.signal] - When aborted, shuts down the server and stops watching.
   * @returns {Promise<void>} Resolves when the watcher stops (i.e. when the signal is aborted).
   */
  async serve(listenOptions) {
    const eventEmitter = new EventEmitter();
    serve(eventEmitter, this.config.dir.output, listenOptions);
    await this.watch(eventEmitter, { signal: listenOptions?.signal });
  }
}
