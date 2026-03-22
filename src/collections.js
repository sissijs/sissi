import path from 'node:path';
import { frontmatter } from './transforms/frontmatter.js';
import { resolve as defaultResolve } from './resolver.js';

function normalizeDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === 'string' || typeof d === 'number') return new Date(d);
  return new Date(0);
}

/** Convert a simple glob pattern (supports * and **) to a RegExp. */
function globToRegex(glob) {
  // Escape all special regex chars except * which we'll handle manually
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped
    .replace(/\*\*/g, '\x00')   // placeholder for **
    .replace(/\*/g, '[^/]*')    // * matches within a segment
    .replace(/\x00/g, '.*');    // ** matches across segments
  return new RegExp('^' + pattern + '$');
}

function sortByDate(a, b) {
  const da = normalizeDate(a.page.date);
  const db = normalizeDate(b.page.date);
  if (da < db) return -1;
  if (da > db) return 1;
  return (a.page.inputPath || '').localeCompare(b.page.inputPath || '');
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return [tags];
  return [];
}

export class CollectionsAPI {
  #items;

  constructor(items) {
    this.#items = items;
  }

  /** Returns all items in their original (arbitrary) order. */
  getAll() {
    return [...this.#items];
  }

  /** Returns all items sorted ascending by date, then by inputPath. */
  getAllSorted() {
    return [...this.#items].sort(sortByDate);
  }

  /** Returns items that have `tagName` in their tags, sorted. */
  getFilteredByTag(tagName) {
    return this.getAllSorted().filter(item => {
      return normalizeTags(item.data?.tags).includes(tagName);
    });
  }

  /** Returns items that have ALL of the specified tags, sorted. */
  getFilteredByTags(...tags) {
    return this.getAllSorted().filter(item => {
      const itemTags = normalizeTags(item.data?.tags);
      return tags.every(t => itemTags.includes(t));
    });
  }

  /** Returns items whose `page.inputPath` matches the glob pattern, sorted. */
  getFilteredByGlob(glob) {
    const regex = globToRegex(glob);
    return this.getAllSorted().filter(item => regex.test(item.page.inputPath));
  }
}

/**
 * Extract collection items from a list of files by reading their frontmatter.
 * Does not render templates — content is always ''.
 *
 * @param {import('./sindie-config.js').SindieConfig} config
 * @param {object} globalData
 * @param {string[]} files  - paths relative to config.dir.input
 * @returns {Promise<object[]>}
 */
export async function buildCollectionItems(config, globalData, files) {
  const resolveFn = config.resolve || defaultResolve;
  const items = [];

  for (const inputFile of files) {
    // Mirror the same underscore-skip logic used in Sindie.processFile
    const parsed = path.parse(inputFile);
    if (
      inputFile.startsWith('_') ||
      inputFile.includes(path.sep + '_') ||
      parsed.name.startsWith('_')
    ) {
      continue;
    }

    const ext = parsed.ext?.slice(1);
    if (!config.extensions.has(ext)) {
      continue; // passthrough file, not a template
    }

    const rawInput = await resolveFn(config.dir.input, inputFile);
    if (!rawInput) continue;

    const plugin = config.extensions.get(ext);
    const pageUrl = config.naming(inputFile, plugin?.outputFileExtension);
    const absOutputFile = path.join(path.normalize(config.dir.output), pageUrl);

    const { data: matterData } = frontmatter(rawInput);
    const fileData = Object.assign({}, globalData, matterData);

    // Skip entirely if excluded from all collections
    if (fileData.eleventyExcludeFromCollections === true) {
      continue;
    }

    const page = {
      url: pageUrl,
      fileSlug: parsed.name,
      filePathStem: path.join('/', parsed.dir, parsed.name),
      inputPath: inputFile,
      outputPath: absOutputFile,
      outputFileExtension: plugin.outputFileExtension || 'html',
      date: matterData?.date ? normalizeDate(matterData.date) : new Date(0),
    };

    items.push({
      page,
      data: fileData,
      content: '',
      rawInput,
    });
  }

  return items;
}

/**
 * Build the full collections object from all input files.
 *
 * Populates:
 *  - `collections.all`  — every template item, sorted by date
 *  - `collections.<tag>` — items tagged with that tag, sorted by date
 *  - custom collections registered via `config.addCollection()`
 *
 * @param {import('./sindie-config.js').SindieConfig} config
 * @param {object} globalData
 * @param {string[]} files
 * @returns {Promise<object>}
 */
export async function buildCollections(config, globalData, files) {
  const items = await buildCollectionItems(config, globalData, files);
  const api = new CollectionsAPI(items);

  const collections = { all: api.getAllSorted() };

  // Collect all tags seen across items
  const tagSet = new Set();
  for (const item of items) {
    for (const tag of normalizeTags(item.data?.tags)) {
      tagSet.add(tag);
    }
  }

  // Build per-tag collections, respecting partial exclusions
  for (const tag of tagSet) {
    collections[tag] = items
      .filter(item => {
        const exclude = item.data?.eleventyExcludeFromCollections;
        if (Array.isArray(exclude) && exclude.includes(tag)) return false;
        return normalizeTags(item.data?.tags).includes(tag);
      })
      .sort(sortByDate);
  }

  // Custom collections registered via config.addCollection()
  for (const [name, fn] of (config.collections || new Map())) {
    collections[name] = await fn(api);
  }

  return collections;
}
