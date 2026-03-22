import path from 'node:path';
import vm from 'node:vm';
import { frontmatter } from './frontmatter.js';
import { resolve } from '../resolver.js';
import { SindieConfig } from "../sindie-config.js";
import { replaceAsync } from '../utils/replace-async.js';

const TEMPLATE_REGEX = /\{\{\s*(.+?)\s*\}\}/gs;

function mergeMaps(map1, map2) {
  return new Map([...map1, ...map2]);
}

function htmlEscape(input) {
  return input?.toString().replace(/\&/g, '&amp;').replace(/\</g, '&lt;').replace(/\>/g, '&gt;');
}

function safeEval(snippet, context) {
  try {
    const s = new vm.Script(snippet);
    let result = context && vm.isContext(context) ? s.runInContext(context) : s.runInNewContext(context || {Object, Array});
    return result;
  } catch (err) {
    if (err.name === 'ReferenceError') {
      console.warn(`ReferenceError: ${err.message}`);
      return '';
    }
    throw err;
  }
}

export function parseFilterExpression(expr, ctx) {
  const colonSyntax = expr.match(/^([a-zA-Z_]\w+?)(?:\: (.+?))?$/);
  if (colonSyntax !== null) {
    const filter = colonSyntax[1];
    const args = colonSyntax[2] ? Array.from(safeEval(`[${colonSyntax[2]}]`, ctx)).map(item => {
      if (typeof item === 'function') {
        return item();
      }
      return item;
    }) : null;
    return [filter, args];
  }
  throw new Error('filter syntax error');
}

/**
 * Poor girl's handlebars
 * 
 * @param {string} str the template content
 * @returns {Promise<(data: any, filters: Map<string, function>) => Promise<string>>} a function that takes a data object and returns the processed template
 */
export function template(str) {
  if (! str) {
    return async () => str;
  }
  return async (data, providedFilters) => {
    const context = vm.createContext({...data});

    // Extract <pre> and <code> blocks before template evaluation so that
    // {{ }} inside code blocks is never interpreted as a template expression.
    const snippets = [];
    const withPlaceholders = str.replace(/<(pre|code)(\b[^>]*)?>[\s\S]*?<\/\1>/g, (match) => {
      snippets.push(match);
      return `\x00${snippets.length - 1}\x00`;
    });

    return (await replaceAsync(withPlaceholders, TEMPLATE_REGEX, async (_, templateString) => {
      let isSafe = false;
      const defaultFilters = new Map();
      defaultFilters.set('safe', (input) => { isSafe = true; return input; });
      const filters = mergeMaps(defaultFilters, providedFilters || new Map());
      const expressions = templateString.split('|').map(e => e.trim());
      const mainExpression = expressions[0];
      const filterExpressions = expressions.slice(1);
      let result = safeEval(mainExpression, context);
      if (typeof result === 'undefined') {
        result = '';
      }
      if (typeof result === 'function') {
        result = result();
      }
      for (const filterExpression of filterExpressions) {
        const [filter, args] = parseFilterExpression(filterExpression, context);
        if (!filter || filters instanceof Map === false || !filters.has(filter) ||
          typeof filters.get(filter) !== 'function') {
          // TODO: more helpful error message:
          throw new Error('unregistered or invalid filter: ' + filter);
        }
        
        result = args ? filters.get(filter)(result, ...args) : filters.get(filter)(result);
        if (result instanceof Promise) {
          result = await result;
        }
      }
      
      if (result instanceof Promise) {
        result = await result;
      }
      return isSafe ? result : htmlEscape(result);
    }))
    .replace(/\\([\{\}])/gm, '$1')
    .replace(/\x00(\d+)\x00/g, (_, i) => snippets[parseInt(i)]);
  }
}

/**
 * Complete Template processing function
 * 
 * @param {SindieConfig} config 
 * @param {any} data 
 * @param {string} inputFile 
 * @returns {Promise<{content: Buffer|string, filename}>} the content file name and the output file name
 */
export async function handleTemplateFile(config, data, inputFile) {
  const content = await (config.resolve || resolve)(config.dir.input, inputFile);
  if (typeof content === "undefined") {
    throw new Error('Not Found');
  }
  if (content === null) {
    return null;
  }
  const parsed = path.parse(inputFile);
  const ext = parsed.ext?.slice(1);
  if (! config.extensions.has(ext)) {
    return {
      content,
      filename: path.normalize(path.join(config.dir.output, config.naming(inputFile)))
    };
  }
  
  const plugin = config.extensions.get(ext);
  const pageUrl = config.naming(inputFile, plugin?.outputFileExtension);
  const absOutputFile = path.join(path.normalize(config.dir.output), pageUrl);

  const page = {
    url: pageUrl,
    fileSlug: parsed.name,
    filePathStem: path.join('/', parsed.dir, parsed.name),
    inputPath: inputFile,
    outputPath: absOutputFile,
    outputFileExtension: plugin.outputFileExtension || 'html',
    rawInput: content
  }; 
  
  const { data: matterData, body } = frontmatter(content);
  const fileData = Object.assign({}, data, matterData);

  if (! fileData.page) {
    fileData.page = page;
  }

  const processor = await plugin.compile(body, inputFile);

  let fileContentTemplate = await (template(await processor(fileData)));
  let fileContent = await fileContentTemplate(fileData, config.filters);

  if (fileData.layout) {
    const layoutFilePath = path.normalize(path.join(config.dir.layouts, fileData.layout));
    const l = await handleTemplateFile(config, 
      {...fileData, content: fileContent, layout: null}, layoutFilePath, true);
    if (l) {
      fileContent = l.content;
    } else {
      throw new Error('Layout not found:' + layoutFilePath);
    }
  }

  return {content: fileContent, filename: page.outputPath, page};
}

