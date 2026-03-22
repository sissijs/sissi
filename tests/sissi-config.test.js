import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { SissiConfig } from "../src/sissi-config.js";

describe('SissiConfig', () => {
  it('should provide some default options', () => {
    const config = new SissiConfig();

    assert(typeof config.dir.input === 'string');
    assert(typeof config.dir.output === 'string');
  });

  it('should register a custom filter via addFilter', () => {
    const config = new SissiConfig();
    config.addFilter('shout', (str) => str.toUpperCase());
    assert(config.filters.has('shout'));
    assert.equal(config.filters.get('shout')('hello'), 'HELLO');
  });

  it('should populate templateFormats automatically when addExtension is called', () => {
    const config = new SissiConfig();
    // built-in plugins register html, css, md via addExtension
    assert(config.templateFormats.has('html'));
    assert(config.templateFormats.has('css'));
    assert(config.templateFormats.has('md'));
  });

  it('should add to templateFormats via addTemplateFormats (array)', () => {
    const config = new SissiConfig();
    config.addTemplateFormats(['svg', 'txt']);
    assert(config.templateFormats.has('svg'));
    assert(config.templateFormats.has('txt'));
    // no compiler registered — these are passthrough-tracked formats only
    assert(!config.extensions.has('svg'));
    assert(!config.extensions.has('txt'));
  });

  it('should add to templateFormats via addTemplateFormats (comma-separated string)', () => {
    const config = new SissiConfig();
    config.addTemplateFormats('svg, txt');
    assert(config.templateFormats.has('svg'));
    assert(config.templateFormats.has('txt'));
  });

  it('should replace templateFormats entirely via setTemplateFormats (array)', () => {
    const config = new SissiConfig();
    config.setTemplateFormats(['njk', 'md']);
    assert(config.templateFormats.has('njk'));
    assert(config.templateFormats.has('md'));
    assert(!config.templateFormats.has('html'));
    assert(!config.templateFormats.has('css'));
  });

  it('should replace templateFormats entirely via setTemplateFormats (comma-separated string)', () => {
    const config = new SissiConfig();
    config.setTemplateFormats('njk, md');
    assert(config.templateFormats.has('njk'));
    assert(config.templateFormats.has('md'));
    assert(!config.templateFormats.has('html'));
    assert(!config.templateFormats.has('css'));
  });

  it('addPassthroughCopy should not throw', () => {
    const config = new SissiConfig();
    // no-op stub — just verify it accepts the same argument shapes as Eleventy
    assert.doesNotThrow(() => config.addPassthroughCopy('img/'));
    assert.doesNotThrow(() => config.addPassthroughCopy(['img/', 'fonts/']));
    assert.doesNotThrow(() => config.addPassthroughCopy({ 'src/img': 'img' }));
  });
});
