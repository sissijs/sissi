import html from './src/html.js';
import css from './src/css.js';

export default function(config) {
  config.addPlugin(html);
  config.addPlugin(css);
  return {
    dir: {
      input: 'docs',
      output: 'dist'
    }
  }
}
