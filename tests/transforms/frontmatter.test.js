import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { frontmatter } from '../../src/transforms/frontmatter.js'

const helloWorld = `---
layout: base.html
title: Hello World
---
<h1>{{ title }}</h1>
`

const noMatter = '<h1>Hello World</h1>\n'

const helloWorldJson = `---json
{
  "layout": "base.html",
  "title": "Hello World"
}
---
<h1>{{ title }}</h1>
`

const emptyMatter = `---
---
<h1>{{ title }}</h1>
`


describe('frontmatter', () => {

  it('should parse frontmatter', () => {
    const { data, body } = frontmatter(helloWorld);
    
    assert.deepEqual(data, {layout: 'base.html', title: 'Hello World'});
    assert.equal(body, '<h1>{{ title }}</h1>\n');
  });

  it('should parse JSON-style frontmatter', () => {
    const { data, body } = frontmatter(helloWorldJson);
    
    assert.deepEqual(data, {layout: 'base.html', title: 'Hello World'});
    assert.equal(body, '<h1>{{ title }}</h1>\n');
  });

  it('should handle it nicely when there is no frontmatter', () => {
    const { data, body } = frontmatter(noMatter);
    assert.equal(data, null);
    assert.equal(body, noMatter);
  });

  it('should stop at the first closing --- and not consume horizontal rules in the body', () => {
    const input = `---
layout: base.html
---
# Hello

---

Some content after a horizontal rule
`;
    const { data, body } = frontmatter(input);
    assert.deepEqual(data, { layout: 'base.html' });
    assert(body.includes('---'), 'horizontal rule should remain in body');
    assert(body.includes('Some content after a horizontal rule'));
  });

  it('should handle it nicely when there is an empyt frontmatter', () => {
    const { data, body } = frontmatter(emptyMatter);
    assert.equal(data, null);
    assert.equal(body, '<h1>{{ title }}</h1>\n');
  });
});
