import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

import { SissiConfig } from "./sissi-config.js";
import { smolYAML } from './transforms/smolyaml.js';

/**
 * read contents of the data dir into an object
 * 
 * @param {SissiConfig} config 
 */
export async function readDataDir(config) {
  const relativeDataDir = path.normalize(path.join(config.dir.input || '.', config.dir.data || '_data'));
  const dataDir = path.resolve(relativeDataDir);
  const files = await readdir(path.normalize(dataDir), {recursive: true});
  const result = {}
  for (const dataFilePath of files) {
    const absPath = path.join(dataDir, dataFilePath);
    const pathInfo = path.parse(absPath);
    if (pathInfo.ext === '.js') {
      // Append a timestamp to bust Node's ESM module cache on re-import during watch.
      const url = new URL(`file://${absPath}?t=${Date.now()}`);
      result[pathInfo.name] = (await import(url)).default;
    }
    if (pathInfo.ext === '.json') {
      result[pathInfo.name] = JSON.parse(await readFile(absPath, 
        'utf8'
      ));
    }
    if (pathInfo.ext === '.yaml') {
      result[pathInfo.name] = smolYAML(await readFile(absPath, 'utf8'));
    }
  }
  return result;
}

