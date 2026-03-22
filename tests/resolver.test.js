import { describe, it, mock, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { SindieConfig } from '../src/sindie-config.js';
import { resolve } from '../src/resolver.js';


describe('resolve', () => {

  let config;
  
  before(() => {
    config = new SindieConfig({
      dir: {
        input: 'docs',
        output: 'dist',
      }
    });    
  });

  it('should resolve files from the local file system', async () => {
    const content = await resolve(config.dir.input, 'index.md');
    assert(content.startsWith('---\n'));
  });

  it('should fetch stuff from the internet', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => {
      const headers = new Map();
      headers.set('Content-Type', 'text/css');
      
      return ({
        status: 200,
        headers,
        async text() {return ':where(html){}'}
      })
    });

    const content = await resolve(config.dir.input, 'https://unpkg.com/open-props@1.7.6/open-props.min.css');
    assert.strictEqual(globalThis.fetch.mock.callCount(), 1);
    assert(content.startsWith(':where'));

    globalThis.fetch = originalFetch;
  });

  it('should not fetch stuff from the internet when the status code is an error', () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => {
      const headers = new Map();
      headers.set('Content-Type', 'text/html');
      return ({
        status: 404,
        headers,
        async text() {return 'Not Found'}
      })
    });

    assert.rejects(async () => {
      await resolve(config.dir.input, 'https://not-found.io/404.html');
    });
    globalThis.fetch = originalFetch;
  });
  
});
