import css from "./css.js";
import html from "./html.js";
import md from "./md.js";
import { defaultNaming } from "./naming.js";
import * as builtinFilters from './builtin-filters.js';

export class SissiConfig {
  
  dir = {
    output: 'public',
    includes: '_includes',
    layouts: '_layouts',
    data: '_data',
    input: '.',
  };

  watchFileDelta = 1000;
  naming = defaultNaming;

  /** Set of extensions that are compiled as templates. Everything else is passthrough-copied. */
  templateFormats = new Set();
  extensions = new Map();
  filters = new Map(Object.entries(builtinFilters));

  /** Custom collections registered via addCollection(). */
  collections = new Map();

  constructor(options = null) {
    this.addPlugin(html);
    this.addPlugin(css);
    this.addPlugin(md);
    this.applyConfig(options);
  }

  addPlugin(plugin) {
    const result = plugin(this);
    this.applyConfig(result);
  }

  applyConfig(options) {
    if (options && options.dir) {
      Object.assign(this.dir, options?.dir);
    }
  }

  /**
   * Register a plugin compiler for a file extension.
   * Also implicitly registers the extension as a template format.
   * @param {string} extension
   * @param {object} processingFunction
   */
  addExtension(extension, processingFunction) {
    this.extensions.set(extension, processingFunction);
    this.templateFormats.add(extension);
  }

  /**
   * Add a filter
   * @param {string} filter 
   * @param {function} filterFunction 
   */
  addFilter(filter, filterFunction) {
    this.filters.set(filter, filterFunction);
  }

  /**
   * Parse formats argument — accepts a comma-separated string or an array of strings.
   * @param {string|string[]} formats
   * @returns {string[]}
   */
  #parseFormats(formats) {
    if (typeof formats === 'string') {
      return formats.split(',').map(f => f.trim()).filter(Boolean);
    }
    return formats.flat();
  }

  /**
   * Add file extensions to the set of known template formats.
   * Eleventy API compatible. Accepts a comma-separated string or an array of strings.
   *
   * Note: built-in plugins call this automatically via `addExtension()`.
   * You only need to call this directly when adding a format that has no
   * compiler — i.e. you want it passthrough-copied but tracked as a known format.
   * @param {string|string[]} formats
   */
  addTemplateFormats(formats) {
    for (const format of this.#parseFormats(formats)) {
      this.templateFormats.add(format);
    }
  }

  /**
   * Replace the set of known template formats entirely.
   * Eleventy API compatible. Accepts a comma-separated string or an array of strings.
   * @param {string|string[]} formats
   */
  setTemplateFormats(formats) {
    this.templateFormats = new Set(this.#parseFormats(formats));
  }

  /**
   * Register a custom collection.
   * Eleventy API compatible. The callback receives a CollectionsAPI instance and
   * must return an array (or any value) to expose as `collections[name]`.
   * @param {string} name
   * @param {function} fn  async (collectionsApi) => any
   */
  addCollection(name, fn) {
    this.collections.set(name, fn);
  }

  /**
   * Eleventy API compatibility stub.
   *
   * In Eleventy, you must explicitly opt assets into the output with this method.
   * In Sissi, all files not in `templateFormats` are passthrough-copied automatically —
   * so this method is a no-op. It exists so Eleventy plugins that call it don't throw.
   * @param {string|string[]|object} _paths
   */
  addPassthroughCopy(_paths) {
    // no-op: Sissi passthrough-copies everything not in templateFormats by default
  }
}
