import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getDependencyGraph } from '../src/dependency-graph.js';

describe('Dependency Graph', () => {

  const withFrontmatter = (str, data) => `---json\n${JSON.stringify(data)}\n---\n${str}`

  function setupVFS(files) {
    const vFS = new Map();
    for (const [file, content] of Object.entries(files)) {
      vFS.set(file, content);
    }
    return (...paths) => {
      const resource = path.normalize(path.join(...paths));
      return vFS.get(resource);
    }
  }

  it('should return a records, mapping each dependants per file', async () => {
    const files = {
      'index.html': withFrontmatter('# {{ title }}', {title: 'Hello', layout: 'base.html'}),
      '_layouts/base.html': '<body>{{ content | safe }}</body>',
    };

    const resolve = setupVFS(files);
    
    const dependencies = await getDependencyGraph('', Object.keys(files), resolve);

    assert.deepEqual(dependencies, {
      '_layouts/base.html': ['index.html'],
    });
  });

  it('should handle layouts depending on other layouts correctly', async () => {
    const files = {
      'index.html': withFrontmatter('# {{ title }}', {title: 'Hello', layout: 'base.html'}),
      '_layouts/base.html': '<body>{{ content | safe }}</body>',
      '_layouts/article.html': withFrontmatter('<article><h1>{{ title }}</h1>{{ content | safe }}</article>', {layout: 'base.html'})
    };

    const resolve = setupVFS(files);
    
    const dependencies = await getDependencyGraph('', Object.keys(files), resolve);

    assert.deepEqual(dependencies, {
      '_layouts/base.html': ['index.html', '_layouts/article.html'],
    });
  });

  it('should handle css dependencies correctly', async () => {
    const files = {
      'styles.css': 'import "./_reset.css";',
      '_reset.css': '*{box-sizing:border-box;margin:0}\n'
    };

    const resolve = setupVFS(files);
    
    const dependencies = await getDependencyGraph('', Object.keys(files), resolve);

    assert.deepEqual(dependencies, {
      '_reset.css': ['styles.css'],
    });
  });

  it('should handle html dependencies correctly', async () => {
    const files = {
      'index.html': '<html-include src="top.html">',
      '_includes/top.html': '<header>header</header>\n'
    };

    const resolve = setupVFS(files);
    
    const dependencies = await getDependencyGraph('', Object.keys(files), resolve);

    assert.deepEqual(dependencies, {
      '_includes/top.html': ['index.html'],
    });
  });

  it('should handle html includes in markdown correctly', async () => {
    const files = {
      'index.md': '<html-include src="top.html">',
      '_includes/top.html': '<header>header</header>\n'
    };

    const resolve = setupVFS(files);
    
    const dependencies = await getDependencyGraph('', Object.keys(files), resolve);

    assert.deepEqual(dependencies, {
      '_includes/top.html': ['index.md'],
    });
  });


});
