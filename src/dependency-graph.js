import { resolve } from "./resolver.js";
import path from 'node:path';

/**
 * Gets a Record of dependencies per file
 * @param {*} inputFilePaths 
 * @param {*} resolver 
 * @returns {Promise<Record<string, string[]>>} a map documenting: the file key is included by the array of files in the value
 */
export async function getDependencyMap(inputRootDir, inputFilePaths, resolver) {
  const deps = {};
  for (const inputFilePath of inputFilePaths) {
    if (/\.(md|css|html?)$/.test(inputFilePath)) {
      const content = await (resolver ?? resolve)(path.normalize(path.join(inputRootDir, inputFilePath)));
      if (typeof content !== 'string') {
        continue;
      }
      for (const dependency of inputFilePaths) {
        const baseName = path.parse(dependency).base;
        if (content.includes(baseName)) {
          if (! deps.hasOwnProperty(dependency)) {
            deps[dependency] = []
          }
          deps[dependency].push(inputFilePath);
        }
      }
    }
  }
  return deps;
}

/**
 * Incrementally update the dependency map after a single file changes.
 * Removes stale entries for the changed file, then re-scans only that file.
 *
 * @param {Record<string, string[]>} deps - The map to update in-place.
 * @param {string} inputRootDir
 * @param {string[]} inputFilePaths - Current full file list (from readdir).
 * @param {string} changedFile - The file that changed (relative to inputRootDir).
 * @param {Function} [resolver]
 */
export async function updateDependencyMap(deps, inputRootDir, inputFilePaths, changedFile, resolver) {
  // Remove changedFile from all dependant lists
  for (const key of Object.keys(deps)) {
    deps[key] = deps[key].filter(f => f !== changedFile);
    if (deps[key].length === 0) delete deps[key];
  }
  // Re-scan the changed file if it's a trackable type
  if (/\.(md|css|html?)$/.test(changedFile)) {
    const content = await (resolver ?? resolve)(path.normalize(path.join(inputRootDir, changedFile)));
    if (typeof content === 'string') {
      for (const dependency of inputFilePaths) {
        const baseName = path.parse(dependency).base;
        if (content.includes(baseName)) {
          if (!deps.hasOwnProperty(dependency)) deps[dependency] = [];
          deps[dependency].push(changedFile);
        }
      }
    }
  }
}

/**
 * Recursively walk through the dependency map for a specific file
 * @param {*} map the dependency map
 * @param {*} file the file in question
 * @param {number} depth number of iterations
 * @returns {string[]} array of files 
 */
export function walkDependencyMap(map, file, depth = 10) {
  const deps = map[file];
  const childDeps = [];
  if (! deps) {
    return [];
  }
  let result = new Map(Array.from(deps.map(x => [x, true])));
  for (const dep of deps) {
    result.set(dep, true);
    if (depth > 0) {
      childDeps.push(...walkDependencyMap(map, dep, depth - 1));
    }
  }
  for (const childDep of childDeps) {
    result.set(childDep, true);
  }
  return Array.from(result.keys());
}
