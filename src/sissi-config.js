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

  extensions = new Map();
  filters = new Map(Object.entries(builtinFilters));

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
   * add an extension to Sissi
   * 
   * @param {string} extension 
   * @param {function} processingFunction 
   */
  addExtension(extension, processingFunction) {
    this.extensions.set(extension, processingFunction);
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
   * Eleventy API compatibility stub.
   * In Eleventy, this controls which file extensions are processed as templates.
   * In Sissi, template formats are registered implicitly via `addExtension()` inside each plugin.
   * Wiring this to drive the build pipeline is future work.
   * @param  {...string} _formats
   */
  addTemplateFormats(..._formats) {
    // no-op
  }
}
