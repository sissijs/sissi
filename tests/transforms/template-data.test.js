import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import nonStrictAssert from 'node:assert';
import path from 'node:path';
import { createContext } from 'node:vm';

import { handleTemplateFile, parseFilterExpression, template } from '../../src/transforms/template-data.js';
import { SindieConfig } from '../../src/sindie-config.js';
import md from '../../src/md.js';
import * as builtinFilters from '../../src/builtin-filters.js';

const TEST_DATA = {
  'title': 'This is a title',
  'tags': ['html', 'css', 'javascript'],
  'meta': {
    'authors': ['Joe', 'Lea'],
  },
  'theMatrix': [[1,2,3],[4,5,6],[7,8,9]],
  date() {
    return '12.03.2024'
  },
  greet(str) {
    return 'Hello ' + str;
  }
}

const TEST_MD = `# {{ title }}

An article by {{ author }}
`

const TEST_TEMPLATE = `<h1>{{ title }}</h1>
<p>Blog article by {{ meta.authors[1] }}</p>
`

const TEST_TEMPLATE_EXPECTED = `<h1>This is a title</h1>
<p>Blog article by Lea</p>
`

const TEST_TEMPLATE_2 = `{{ date }}`
const TEST_TEMPLATE_EXPECTED_2 = '12.03.2024';

const TEST_TEMPLATE_3 = `{{ greet(meta.authors[1]) }}`
const TEST_TEMPLATE_EXPECTED_3 = 'Hello Lea';

describe('parseFilterExpression function', () => {
  const scope = { meta: { authors: ['Joe', 'Lea'] }, foo: 'bar' };
  const context = createContext(scope);

  it('should parse a parameterless filter', () => {
    const [filter, args] = parseFilterExpression('uppercase', context);

    assert.equal(filter, 'uppercase');
    assert.equal(args, null);
  });

  it('should parse the filter and a list of constant arguments from an expression', () => {
    const [filter, args] = parseFilterExpression('language: "de"', context);

    assert.equal(filter, 'language');
    nonStrictAssert.deepEqual(args, ["de"]);
  });

  it('should addionally resolve any variable used', () => {
    const [filter, args] = parseFilterExpression('author: meta.authors[1]', context);

    assert.equal(filter, 'author');
    nonStrictAssert.deepEqual(args, ['Lea']);
  });

  
});

describe('template function', () => {
  it('should insert data into the placeholders wrapped in double curly brackets', async () => {
    assert.equal(await template(TEST_TEMPLATE)(TEST_DATA), TEST_TEMPLATE_EXPECTED);
  });

  it('should be able to invoke functions', async () => {
    assert.equal(await template(TEST_TEMPLATE_2)(TEST_DATA), TEST_TEMPLATE_EXPECTED_2);
    assert.equal(await template(TEST_TEMPLATE_3)(TEST_DATA), TEST_TEMPLATE_EXPECTED_3);
  });

  it('should be able to apply a filter', async () => {
    const filters = new Map();
    filters.set('shout', (str) => (str||'').toUpperCase());
    const result = await template('{{greeting | shout }}')({greeting: "Hello"}, filters);
    
    assert.equal(result, "HELLO");
  });

  it('should escape angle brackets and ampersands by default', async () => {
    const result = await template('{{ content }}')({content: '<h1>Hello</h1>'});

    assert.equal(result, '&lt;h1&gt;Hello&lt;/h1&gt;')
  });

  it('should not escape angle brackets and ampersands when marked safe', async () => {
    const result = await template('{{ content | safe }}')({content: '<h1>Hello</h1>'});

    assert.equal(result, '<h1>Hello</h1>')
  });

  it('should not evaluate {{ }} expressions inside <pre> or <code> blocks', async () => {
    const pre = await template('<pre><code>{{ title }}</code></pre>')({ title: 'Hello' });
    assert.equal(pre, '<pre><code>{{ title }}</code></pre>');

    const code = await template('<p>Use <code>{{ title }}</code> here.</p>')({ title: 'Hello' });
    assert.equal(code, '<p>Use <code>{{ title }}</code> here.</p>');
  });

  it('should not let safe bleed into subsequent expressions', async () => {
    const result = await template('{{ content | safe }} {{ userInput }}')({
      content: '<h1>Hello</h1>',
      userInput: '<script>alert(1)</script>',
    });

    assert.equal(result, '<h1>Hello</h1> &lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('should be able to apply a filter with additional parameters', async () => {
    const data = { greeting: 'Hello Lea' }
    const filters = new Map();
    filters.set('piratify', (str, prefix = 'Yo-ho-ho', suffix = 'yarrr') => `${prefix}! ${str}, ${suffix}!`);

    assert.equal(await template('{{ greeting | piratify }}')(data, filters), 'Yo-ho-ho! Hello Lea, yarrr!');
    assert.equal(await template('{{ greeting | piratify: "AYE" }}')(data, filters), 'AYE! Hello Lea, yarrr!');
    assert.equal(await template('{{ greeting | piratify: "Ahoy", "matey" }}')(data, filters), 'Ahoy! Hello Lea, matey!');
  });

  it('should be able to chain filters', async () => {
    const filters = new Map();
    filters.set('shout', (str) => (str||'').toUpperCase());
    filters.set('piratify', (str, prefix = 'Yo-ho-ho', suffix = 'yarrr') => `${prefix}! ${str}, ${suffix}!`);

    const data = { greeting: 'Hello Lea' };
    assert.equal(await template('{{ greeting | piratify | shout }}')(data, filters), 'YO-HO-HO! HELLO LEA, YARRR!');

    // order matters
    assert.equal(await template('{{ greeting | shout | piratify }}')(data, filters), 'Yo-ho-ho! HELLO LEA, yarrr!');
  });

  it('should be able to do async operations', async () => {
    const filters = new Map();
    filters.set('async', builtinFilters.async);
    const data = { answer: () => Promise.resolve(42) };

    assert.equal(await (template('{{ answer | async }}')(data, filters)), '42');
  });

  it('should evaluate arbitrary expressions', async () => {
    assert.equal(await (template('{{ 6*7 }}')({}, new Map())), '42');
  });

  it('should support lambdas', async () => {
    const data = { people: () => ['Lea', 'Angela'], };
    assert.equal(
      await (template('{{ people().map(person => `<li>${person}</li>`).join("") | safe }}')(data, new Map())),
      '<li>Lea</li><li>Angela</li>'
    )
  });

  it('should evaluate multi-line pipe expressions', async () => {
    const filters = new Map();
    filters.set('shout', (str) => (str || '').toUpperCase());
    filters.set('exclaim', (str) => str + '!!!');
    const tpl = `{{
  title
  | shout
  | exclaim
}}`;
    assert.equal(await template(tpl)({ title: 'hello' }, filters), 'HELLO!!!');
  });

  it('should evaluate multi-line expressions inside {{ }}', async () => {
    const data = { items: ['a', 'b', 'c'] };
    const tpl = `{{
  items
    .map(i => i.toUpperCase())
    .join(', ')
}}`;
    assert.equal(await template(tpl)(data, new Map()), 'A, B, C');
  });

  it('should support multi-line IIFE lambdas like those in the collections docs', async () => {
    const data = {
      prev: { url: '/prev.html', title: 'Previous' },
      next: { url: '/next.html', title: 'Next' },
    };
    const tpl = `{{ (() => {
  const prevLink = prev ? \`<a href="\${prev.url}">\${prev.title}</a>\` : '';
  const nextLink = next ? \`<a href="\${next.url}">\${next.title}</a>\` : '';
  return [prevLink, nextLink].filter(Boolean).join(' · ');
})() | safe }}`;
    assert.equal(
      await template(tpl)(data, new Map()),
      '<a href="/prev.html">Previous</a> · <a href="/next.html">Next</a>'
    );
  });

});

describe('handleTemplateFile function', () => {

  const withFrontmatter = (str, data) => `---json\n${JSON.stringify(data)}\n---\n${str}`

  it('should work with basic html files without specifying a layout', async () => {
    const config = new SindieConfig();
    config.addExtension(md);

    const vFS = new Map();
    vFS.set('index.html', '<h1>{{ title }}</h1>');

    config.resolve = (...paths) => {
      const resource = path.normalize(path.join(...paths));
      return vFS.get(resource);
    }

    const result = await handleTemplateFile(config, {title: 'Lea was here'}, 'index.html');

    assert.equal(result.filename, 'public/index.html');
    assert.equal(result.content, '<h1>Lea was here</h1>')
  });

  it('should work with basic html files with specifying a layout', async () => {
    const config = new SindieConfig();
    config.addExtension(md);

    const vFS = new Map();
    vFS.set('index.html', withFrontmatter('<h1>{{ title }}</h1>', {layout: 'base.html'}));
    vFS.set('_layouts/base.html', '<body>{{ content | safe }}</body>')

    config.resolve = (...paths) => {
      const resource = path.normalize(path.join(...paths));
      return vFS.get(resource);
    }

    const result = await handleTemplateFile(config, {title: 'Lea was here'}, 'index.html');

    assert.equal(result.filename, 'public/index.html');
    assert.equal(result.content, '<body><h1>Lea was here</h1></body>');
  });

  it('should work with the default markdown plugin', async () => {
    const config = new SindieConfig();
    config.addExtension(md);

    const vFS = new Map();
    vFS.set('index.md', withFrontmatter(TEST_MD, {'layout': 'base.html', author: 'Lea Rosema'}));
    vFS.set('_layouts/base.html', '<body>{{ content | safe }}</body>');  

    config.resolve = (...paths) => {
      const resource = path.normalize(path.join(...paths));
      return vFS.get(resource);
    }

    const result = await handleTemplateFile(config, {title: 'Lea was here'}, 'index.md');

    assert.equal(result.filename, 'public/index.html');
    assert.equal(result.content, '<body><h1>Lea was here</h1>\n\n<p>An article by Lea Rosema</p>\n</body>')
  });

  it('should throw an error when a non-existant file is specified', async () => {
    const config = new SindieConfig();
    config.addExtension(md);

    const vFS = new Map();
    vFS.set('index.md', withFrontmatter(TEST_MD, {'layout': 'notfound.html', author: 'Lea Rosema'}));

    config.resolve = (...paths) => {
      const resource = path.normalize(path.join(...paths));
      if (vFS.has(resource)) {
        return vFS.get(resource);
      }
    }

    assert.rejects(async () => {
      await handleTemplateFile(config, {title: 'Lea was here'}, 'something-completely-different.md');
    });
  });

  it('should throw an error when a non-existant file is specified as layout', async () => {
    const config = new SindieConfig();
    config.addExtension(md);

    const vFS = new Map();
    vFS.set('index.md', withFrontmatter(TEST_MD, {'layout': 'notfound.html', author: 'Lea Rosema'}));

    config.resolve = (...paths) => {
      const resource = path.normalize(path.join(...paths));
      if (vFS.has(resource)) {
        return vFS.get(resource);
      }
    }

    assert.rejects(async () => {
      await handleTemplateFile(config, {title: 'Lea was here'}, 'index.md');
    });
  });

  it('should use provided data in the template', async () => {
    const config = new SindieConfig();
    config.addExtension(md);
    const vFS = new Map();

    const TEST = 'author: {{ author }}';

    const TEST_EXPECTED = 'author: Lea Rosema'

    vFS.set('index.html', TEST);

    config.resolve = (...paths) => {
      const resource = path.normalize(path.join(...paths));
      if (vFS.has(resource)) {
        return vFS.get(resource);
      }
    }

    const result = await handleTemplateFile(config, {author: 'Lea Rosema'}, 'index.html');
    assert.equal(result.content, TEST_EXPECTED);
  });

  it('should override provided data with frontmatter data in the template', async () => {
    const config = new SindieConfig();
    config.addExtension(md);
    const vFS = new Map();

    const TEST = 'author: {{ author }}';

    const TEST_EXPECTED = 'author: John Doe'

    vFS.set('index.html', withFrontmatter(TEST, {author: 'John Doe'}));

    config.resolve = (...paths) => {
      const resource = path.normalize(path.join(...paths));
      if (vFS.has(resource)) {
        return vFS.get(resource);
      }
    }

    const result = await handleTemplateFile(config, {author: 'Lea Rosema'}, 'index.html');
    assert.equal(result.content, TEST_EXPECTED);
  });

  it('should populate data provided by sindie in the template', async () => {
    const config = new SindieConfig();
    config.addExtension(md);
    const vFS = new Map();

    const PAGE_TEST = [
      'page.url: {{ page.url }}',
      'page.filePathStem: {{ page.filePathStem }}',
      'page.inputPath: {{ page.inputPath }}',
      'page.outputPath: {{ page.outputPath }}',
      'page.outputFileExtension: {{ page.outputFileExtension }}',
    ].join('\n');

    const PAGE_TEST_EXPECTED = [
      'page.url: /index.html',
      'page.filePathStem: /index',
      'page.inputPath: index.html',
      'page.outputPath: public' + path.sep + 'index.html',
      'page.outputFileExtension: html',
    ].join('\n');

    vFS.set('index.html', PAGE_TEST);

    config.resolve = (...paths) => {
      const resource = path.normalize(path.join(...paths));
      if (vFS.has(resource)) {
        return vFS.get(resource);
      }
    }

    const result = await handleTemplateFile(config, {}, 'index.html');
    assert.equal(result.content, PAGE_TEST_EXPECTED);
  });
});
