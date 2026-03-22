import { describe, it } from 'node:test'
import assert from 'node:assert/strict';
import path from 'node:path'
import { handleTemplateFile } from '../src/transforms/template-data.js';
import { SissiConfig } from '../src/sissi-config.js';
import { htmlentities, last } from '../src/builtin-filters.js';
describe('builtin filters', () => {

  const dummyResolver = (map) => (...paths) => map.get(path.normalize(path.join(...paths)));

  describe('htmlentities', () => {
    it('should not crash when nullish value is passed', () => {
      assert.equal(htmlentities(undefined), undefined);
    });

    it('should escape HTML', () => {
      const expected = '&lt;h1&gt;Hello World&lt;/h1&gt;\n&lt;p&gt;Cow &amp; Son&lt;/p&gt;'
      const result = htmlentities('<h1>Hello World</h1>\n<p>Cow & Son</p>');
      assert.equal(result, expected);
    });
  });

  describe('last', () => {
    it('should return the last N items in reverse order', () => {
      assert.deepEqual(last([1, 2, 3, 4, 5], 3), [5, 4, 3]);
    });

    it('should default to 1 item', () => {
      assert.deepEqual(last([1, 2, 3]), [3]);
    });

    it('should not mutate the original array', () => {
      const arr = [1, 2, 3];
      last(arr, 2);
      assert.deepEqual(arr, [1, 2, 3]);
    });
  });

  describe('integration with template engine', () => {
    it('should format numbers via numberFormat filter', async () => {
      const config = new SissiConfig();
  
      const vFS = new Map();
      vFS.set('index.html', '{{ thousandPi | numberFormat: numberFormatOptions, "de-DE" }}');
  
      config.resolve = dummyResolver(vFS);
  
      const data = { thousandPi: Math.PI * 1e3, numberFormatOptions: {maximumFractionDigits: 2, minimumFractionDigits: 2} };
  
      const result = await handleTemplateFile(config, data, 'index.html');
  
      assert.equal(result.content, '3.141,59');
    });
  
    it('should format currencies via currency filter', async () => {
      const config = new SissiConfig();
  
      const vFS = new Map();
      vFS.set('index.html', '{{ million | currency: "eur", "de-DE" }}');
  
      config.resolve = dummyResolver(vFS);
  
      const data = { million: 1e6 };
  
      const result = await handleTemplateFile(config, data, 'index.html');
  
      assert.equal(result.content, '1.000.000,00 €');
    });
  
    it('should format dates via date filter', async () => {
      const config = new SissiConfig();
  
      const vFS = new Map();
      vFS.set('index.html', '{{ newYear | date: dateFormatOptions, "de-DE" }}');
  
      config.resolve = dummyResolver(vFS);
  
      const data = { newYear: new Date('2025-04-01'), dateFormatOptions: {"day": "2-digit", "month": "2-digit", "year": "numeric"} };
  
      const result = await handleTemplateFile(config, data, 'index.html');
  
      assert.equal(result.content, '01.04.2025');
    });
  
    it('should serialize json', async () => {
      const config = new SissiConfig();
  
      const vFS = new Map();
      vFS.set('index.html', '{{ answer | json }}');
  
      config.resolve = dummyResolver(vFS);
  
      const data = { answer: {result: 42} };
  
      const result = await handleTemplateFile(config, data, 'index.html');
  
      assert.equal(result.content, '{"result":42}');
    });  
  });
});
