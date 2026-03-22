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
});
