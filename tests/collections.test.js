import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, writeFile, readFile, rm, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { CollectionsAPI, buildCollections } from '../src/collections.js';
import {
  getCollectionItemIndex,
  getPreviousCollectionItem,
  getNextCollectionItem,
} from '../src/builtin-filters.js';
import { SissiConfig } from '../src/sissi-config.js';
import { Sissi } from '../src/sissi.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const withFrontmatter = (str, data) => `---json\n${JSON.stringify(data)}\n---\n${str}`;

function makeVFS(entries) {
  const vFS = new Map(entries);
  return (...paths) => {
    const resource = path.normalize(path.join(...paths));
    return vFS.has(resource) ? vFS.get(resource) : undefined;
  };
}

// ---------------------------------------------------------------------------
// Unit tests: CollectionsAPI
// ---------------------------------------------------------------------------

describe('CollectionsAPI', () => {
  const items = [
    {
      page: { inputPath: 'b.html', date: new Date('2024-02-01'), url: '/b.html' },
      data: { tags: ['post', 'news'] },
      content: '<p>B</p>',
    },
    {
      page: { inputPath: 'a.html', date: new Date('2024-01-01'), url: '/a.html' },
      data: { tags: ['post'] },
      content: '<p>A</p>',
    },
    {
      page: { inputPath: 'c.html', date: new Date('2024-03-01'), url: '/c.html' },
      data: { tags: ['news'] },
      content: '<p>C</p>',
    },
  ];

  const api = new CollectionsAPI(items);

  it('getAll() returns all items (unsorted)', () => {
    assert.equal(api.getAll().length, 3);
  });

  it('getAll() does not sort', () => {
    // Returns in the same order as input
    assert.equal(api.getAll()[0].page.inputPath, 'b.html');
  });

  it('getAllSorted() returns items sorted by date ascending', () => {
    const sorted = api.getAllSorted();
    assert.equal(sorted[0].page.inputPath, 'a.html');
    assert.equal(sorted[1].page.inputPath, 'b.html');
    assert.equal(sorted[2].page.inputPath, 'c.html');
  });

  it('getAllSorted() uses inputPath as tiebreaker for equal dates', () => {
    const tiedItems = [
      { page: { inputPath: 'z.html', date: new Date('2024-01-01') }, data: {} },
      { page: { inputPath: 'a.html', date: new Date('2024-01-01') }, data: {} },
      { page: { inputPath: 'm.html', date: new Date('2024-01-01') }, data: {} },
    ];
    const tiedApi = new CollectionsAPI(tiedItems);
    const sorted = tiedApi.getAllSorted();
    assert.equal(sorted[0].page.inputPath, 'a.html');
    assert.equal(sorted[1].page.inputPath, 'm.html');
    assert.equal(sorted[2].page.inputPath, 'z.html');
  });

  it('getFilteredByTag() returns only items with that tag, sorted', () => {
    const posts = api.getFilteredByTag('post');
    assert.equal(posts.length, 2);
    assert.equal(posts[0].page.inputPath, 'a.html'); // oldest first
    assert.equal(posts[1].page.inputPath, 'b.html');
  });

  it('getFilteredByTag() returns empty array for unknown tag', () => {
    assert.deepEqual(api.getFilteredByTag('unknown'), []);
  });

  it('getFilteredByTags() returns items that have ALL specified tags', () => {
    const results = api.getFilteredByTags('post', 'news');
    assert.equal(results.length, 1);
    assert.equal(results[0].page.inputPath, 'b.html');
  });

  it('getFilteredByTags() returns empty array when no item matches all tags', () => {
    assert.deepEqual(api.getFilteredByTags('post', 'news', 'nope'), []);
  });

  it('getFilteredByGlob() returns items whose inputPath matches the glob', () => {
    const all = api.getFilteredByGlob('*.html');
    assert.equal(all.length, 3);
  });

  it('getFilteredByGlob() matches a subdirectory glob', () => {
    const subItems = [
      { page: { inputPath: 'posts/a.html', date: new Date('2024-01-01') }, data: {} },
      { page: { inputPath: 'posts/b.html', date: new Date('2024-02-01') }, data: {} },
      { page: { inputPath: 'index.html',   date: new Date('2024-01-01') }, data: {} },
    ];
    const subApi = new CollectionsAPI(subItems);
    const posts = subApi.getFilteredByGlob('posts/*.html');
    assert.equal(posts.length, 2);
    assert.ok(posts.every(item => item.page.inputPath.startsWith('posts/')));
  });

  it('getFilteredByTag() works with a string tags value (not array)', () => {
    const strItems = [
      { page: { inputPath: 'x.html', date: new Date('2024-01-01') }, data: { tags: 'post' } },
    ];
    const strApi = new CollectionsAPI(strItems);
    const posts = strApi.getFilteredByTag('post');
    assert.equal(posts.length, 1);
  });
});

// ---------------------------------------------------------------------------
// buildCollections() integration tests (virtual FS)
// ---------------------------------------------------------------------------

describe('buildCollections', () => {
  it('collections.all contains all template files (regardless of tags)', async () => {
    const config = new SissiConfig({ dir: { input: '.', output: 'public' } });
    config.resolve = makeVFS([
      ['index.html', '<h1>Home</h1>'],
      ['about.html', '<p>About</p>'],
    ]);

    const collections = await buildCollections(config, {}, ['index.html', 'about.html']);

    assert.ok(Array.isArray(collections.all));
    assert.equal(collections.all.length, 2);
  });

  it('each item in collections.all has page, data, content, and rawInput fields', async () => {
    const config = new SissiConfig({ dir: { input: '.', output: 'public' } });
    config.resolve = makeVFS([
      ['index.html', withFrontmatter('<h1>Home</h1>', { title: 'Home' })],
    ]);

    const collections = await buildCollections(config, {}, ['index.html']);
    const item = collections.all[0];

    assert.ok(item.page);
    assert.equal(typeof item.page.url, 'string');
    assert.equal(typeof item.page.inputPath, 'string');
    assert.ok('data' in item);
    assert.ok('content' in item);
    assert.ok('rawInput' in item);
  });

  it('builds tag-based collections from frontmatter tags', async () => {
    const config = new SissiConfig({ dir: { input: '.', output: 'public' } });
    config.resolve = makeVFS([
      ['post-a.html', withFrontmatter('<p>A</p>', { tags: ['post'] })],
      ['post-b.html', withFrontmatter('<p>B</p>', { tags: ['post', 'featured'] })],
      ['index.html',  '<h1>Home</h1>'],
    ]);

    const collections = await buildCollections(config, {}, ['post-a.html', 'post-b.html', 'index.html']);

    assert.ok(Array.isArray(collections.post));
    assert.equal(collections.post.length, 2);

    assert.ok(Array.isArray(collections.featured));
    assert.equal(collections.featured.length, 1);
    assert.equal(collections.featured[0].page.inputPath, 'post-b.html');

    // index.html has no tags, so it only appears in `all`
    assert.ok(!collections.all.every(item => item.data.tags)); // some items have no tags
  });

  it('string tags value (not array) also creates a tag collection', async () => {
    const config = new SissiConfig({ dir: { input: '.', output: 'public' } });
    config.resolve = makeVFS([
      ['post.html', withFrontmatter('<p>Post</p>', { tags: 'post' })],
    ]);

    const collections = await buildCollections(config, {}, ['post.html']);

    assert.ok(Array.isArray(collections.post));
    assert.equal(collections.post.length, 1);
  });

  it('eleventyExcludeFromCollections: true excludes from all collections including all', async () => {
    const config = new SissiConfig({ dir: { input: '.', output: 'public' } });
    config.resolve = makeVFS([
      ['secret.html', withFrontmatter('<p>Secret</p>', { eleventyExcludeFromCollections: true, tags: ['post'] })],
      ['public.html', withFrontmatter('<p>Public</p>', { tags: ['post'] })],
    ]);

    const collections = await buildCollections(config, {}, ['secret.html', 'public.html']);

    assert.equal(collections.all.length, 1);
    assert.equal(collections.all[0].page.inputPath, 'public.html');

    assert.equal(collections.post.length, 1);
    assert.equal(collections.post[0].page.inputPath, 'public.html');
  });

  it('eleventyExcludeFromCollections: [tags] excludes from specific tag collections but stays in all', async () => {
    const config = new SissiConfig({ dir: { input: '.', output: 'public' } });
    config.resolve = makeVFS([
      ['page.html', withFrontmatter('<p>Page</p>', {
        tags: ['post', 'featured'],
        eleventyExcludeFromCollections: ['featured'],
      })],
    ]);

    const collections = await buildCollections(config, {}, ['page.html']);

    // Still in all
    assert.equal(collections.all.length, 1);
    // Still in post
    assert.equal(collections.post.length, 1);
    // Excluded from featured
    assert.ok(!collections.featured || collections.featured.length === 0);
  });

  it('skips passthrough-copied files (non-template extensions)', async () => {
    const config = new SissiConfig({ dir: { input: '.', output: 'public' } });
    config.resolve = makeVFS([
      ['image.png', Buffer.from('fake-png')],
      ['index.html', '<h1>Home</h1>'],
    ]);

    const collections = await buildCollections(config, {}, ['image.png', 'index.html']);

    assert.equal(collections.all.length, 1);
    assert.equal(collections.all[0].page.inputPath, 'index.html');
  });

  it('skips underscore-prefixed files', async () => {
    const config = new SissiConfig({ dir: { input: '.', output: 'public' } });
    config.resolve = makeVFS([
      ['_partial.html', '<p>partial</p>'],
      ['index.html', '<h1>Home</h1>'],
    ]);

    const collections = await buildCollections(config, {}, ['_partial.html', 'index.html']);

    assert.equal(collections.all.length, 1);
  });
});

// ---------------------------------------------------------------------------
// SissiConfig.addCollection()
// ---------------------------------------------------------------------------

describe('SissiConfig.addCollection', () => {
  it('registers a custom collection', () => {
    const config = new SissiConfig();
    config.addCollection('featured', (api) => api.getFilteredByTag('featured'));
    assert.ok(config.collections.has('featured'));
    assert.equal(typeof config.collections.get('featured'), 'function');
  });

  it('supports multiple custom collections', () => {
    const config = new SissiConfig();
    config.addCollection('a', (api) => api.getAllSorted());
    config.addCollection('b', (api) => api.getFilteredByTag('b'));
    assert.ok(config.collections.has('a'));
    assert.ok(config.collections.has('b'));
  });
});

// ---------------------------------------------------------------------------
// Sissi integration: collections available in templates
// ---------------------------------------------------------------------------

describe('Sissi collections integration', () => {
  async function makeTmpSite(files) {
    const tmpDir = await realpath(await mkdtemp(path.join(tmpdir(), 'sissi-test-')));
    for (const [name, content] of Object.entries(files)) {
      const full = path.join(tmpDir, name);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content);
    }
    return tmpDir;
  }

  it('collections.all is accessible in templates and returns the right count', async () => {
    const tmpDir = await makeTmpSite({
      'post-a.html': withFrontmatter('<p>A</p>', { tags: ['post'] }),
      'post-b.html': withFrontmatter('<p>B</p>', { tags: ['post'] }),
      'index.html':  '{{ collections.all.length }}',
    });

    try {
      const outDir = path.join(tmpDir, 'public');
      const config = new SissiConfig({ dir: { input: tmpDir, output: outDir } });
      const sissi = new Sissi(config);
      await sissi.build();

      const output = await readFile(path.join(outDir, 'index.html'), 'utf8');
      assert.equal(output.trim(), '3');
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it('tag collections are available in templates', async () => {
    const tmpDir = await makeTmpSite({
      'post-a.html': withFrontmatter('<p>Post A</p>', { tags: ['post'], date: '2024-01-01' }),
      'post-b.html': withFrontmatter('<p>Post B</p>', { tags: ['post'], date: '2024-02-01' }),
      'index.html':  '{{ collections.post.length }}',
    });

    try {
      const outDir = path.join(tmpDir, 'public');
      const config = new SissiConfig({ dir: { input: tmpDir, output: outDir } });
      const sissi = new Sissi(config);
      await sissi.build();

      const output = await readFile(path.join(outDir, 'index.html'), 'utf8');
      assert.equal(output.trim(), '2');
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it('custom collection via addCollection is available in templates', async () => {
    const tmpDir = await makeTmpSite({
      'post.html':  withFrontmatter('<p>Post</p>', { tags: ['post'] }),
      'index.html': '{{ collections.myPosts.length }}',
    });

    try {
      const outDir = path.join(tmpDir, 'public');
      const config = new SissiConfig({ dir: { input: tmpDir, output: outDir } });
      config.addCollection('myPosts', (api) => api.getFilteredByTag('post'));
      const sissi = new Sissi(config);
      await sissi.build();

      const output = await readFile(path.join(outDir, 'index.html'), 'utf8');
      assert.equal(output.trim(), '1');
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it('collections.post is sorted by date ascending', async () => {
    const config = new SissiConfig({ dir: { input: '.', output: 'public' } });
    config.resolve = makeVFS([
      ['newer.html', withFrontmatter('<p>New</p>', { tags: ['post'], date: '2024-12-01' })],
      ['older.html', withFrontmatter('<p>Old</p>', { tags: ['post'], date: '2024-01-01' })],
    ]);

    const collections = await buildCollections(config, {}, ['newer.html', 'older.html']);

    assert.equal(collections.post[0].page.inputPath, 'older.html');
    assert.equal(collections.post[1].page.inputPath, 'newer.html');
  });
});

// ---------------------------------------------------------------------------
// Collection item filters
// ---------------------------------------------------------------------------

describe('getCollectionItemIndex', () => {
  const collection = [
    { page: { inputPath: 'a.html' }, data: {} },
    { page: { inputPath: 'b.html' }, data: {} },
    { page: { inputPath: 'c.html' }, data: {} },
  ];

  it('returns the 0-based index of the page in the collection', () => {
    assert.equal(getCollectionItemIndex(collection, { inputPath: 'a.html' }), 0);
    assert.equal(getCollectionItemIndex(collection, { inputPath: 'b.html' }), 1);
    assert.equal(getCollectionItemIndex(collection, { inputPath: 'c.html' }), 2);
  });

  it('returns -1 when the page is not in the collection', () => {
    assert.equal(getCollectionItemIndex(collection, { inputPath: 'x.html' }), -1);
  });

  it('returns -1 when collection is empty', () => {
    assert.equal(getCollectionItemIndex([], { inputPath: 'a.html' }), -1);
  });

  it('returns -1 when page is null or undefined', () => {
    assert.equal(getCollectionItemIndex(collection, null), -1);
    assert.equal(getCollectionItemIndex(collection, undefined), -1);
  });
});

describe('getPreviousCollectionItem', () => {
  const collection = [
    { page: { inputPath: 'a.html' }, data: { title: 'A' } },
    { page: { inputPath: 'b.html' }, data: { title: 'B' } },
    { page: { inputPath: 'c.html' }, data: { title: 'C' } },
  ];

  it('returns the item before the current page', () => {
    const prev = getPreviousCollectionItem(collection, { inputPath: 'b.html' });
    assert.equal(prev.page.inputPath, 'a.html');
  });

  it('returns null for the first item (no previous)', () => {
    assert.equal(getPreviousCollectionItem(collection, { inputPath: 'a.html' }), null);
  });

  it('returns null when page is not in the collection', () => {
    assert.equal(getPreviousCollectionItem(collection, { inputPath: 'z.html' }), null);
  });

  it('returns null when collection is empty', () => {
    assert.equal(getPreviousCollectionItem([], { inputPath: 'a.html' }), null);
  });
});

describe('getNextCollectionItem', () => {
  const collection = [
    { page: { inputPath: 'a.html' }, data: { title: 'A' } },
    { page: { inputPath: 'b.html' }, data: { title: 'B' } },
    { page: { inputPath: 'c.html' }, data: { title: 'C' } },
  ];

  it('returns the item after the current page', () => {
    const next = getNextCollectionItem(collection, { inputPath: 'b.html' });
    assert.equal(next.page.inputPath, 'c.html');
  });

  it('returns null for the last item (no next)', () => {
    assert.equal(getNextCollectionItem(collection, { inputPath: 'c.html' }), null);
  });

  it('returns null when page is not in the collection', () => {
    assert.equal(getNextCollectionItem(collection, { inputPath: 'z.html' }), null);
  });

  it('returns null when collection is empty', () => {
    assert.equal(getNextCollectionItem([], { inputPath: 'a.html' }), null);
  });
});

describe('collection item filters: integration via template', () => {
  async function makeTmpSite(files) {
    const tmpDir = await realpath(await mkdtemp(path.join(tmpdir(), 'sissi-test-')));
    for (const [name, content] of Object.entries(files)) {
      const full = path.join(tmpDir, name);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content);
    }
    return tmpDir;
  }

  it('getPreviousCollectionItem filter renders prev post url in a template', async () => {
    const tmpDir = await makeTmpSite({
      'post-a.html': withFrontmatter('<p>A</p>', { title: 'Post A', tags: ['post'], date: '2024-01-01' }),
      'post-b.html': withFrontmatter(
        '{{ getPreviousCollectionItem(collections.post, page)?.page?.url }}',
        { title: 'Post B', tags: ['post'], date: '2024-02-01' }
      ),
    });

    try {
      const outDir = path.join(tmpDir, 'public');
      const config = new SissiConfig({ dir: { input: tmpDir, output: outDir } });
      const sissi = new Sissi(config);
      await sissi.build();

      const output = await readFile(path.join(outDir, 'post-b.html'), 'utf8');
      assert.ok(output.includes('post-a.html'));
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it('getNextCollectionItem filter renders next post url in a template', async () => {
    const tmpDir = await makeTmpSite({
      'post-a.html': withFrontmatter(
        '{{ getNextCollectionItem(collections.post, page)?.page?.url }}',
        { title: 'Post A', tags: ['post'], date: '2024-01-01' }
      ),
      'post-b.html': withFrontmatter('<p>B</p>', { title: 'Post B', tags: ['post'], date: '2024-02-01' }),
    });

    try {
      const outDir = path.join(tmpDir, 'public');
      const config = new SissiConfig({ dir: { input: tmpDir, output: outDir } });
      const sissi = new Sissi(config);
      await sissi.build();

      const output = await readFile(path.join(outDir, 'post-a.html'), 'utf8');
      assert.ok(output.includes('post-b.html'));
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it('getCollectionItemIndex filter returns the correct index', async () => {
    const tmpDir = await makeTmpSite({
      'post-a.html': withFrontmatter('<p>A</p>', { tags: ['post'], date: '2024-01-01' }),
      'post-b.html': withFrontmatter('<p>B</p>', { tags: ['post'], date: '2024-02-01' }),
      'post-c.html': withFrontmatter(
        '{{ getCollectionItemIndex(collections.post, page) }}',
        { tags: ['post'], date: '2024-03-01' }
      ),
    });

    try {
      const outDir = path.join(tmpDir, 'public');
      const config = new SissiConfig({ dir: { input: tmpDir, output: outDir } });
      const sissi = new Sissi(config);
      await sissi.build();

      const output = await readFile(path.join(outDir, 'post-c.html'), 'utf8');
      assert.equal(output.trim(), '2');
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });
});
