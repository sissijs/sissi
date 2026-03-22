import path from 'node:path';
import { handleTemplateFile } from './transforms/template-data.js';

/**
 * Language-agnostic include method to handle includes in sindie
 * @param {string} inputContent the content
 * @param {string} inputPath the full path to the file processed
 * @param {SindieConfig} config the configuration
 * @param {any} data the data object
 * @param {string} includePath the include path to be used. If nullish, it's relative to the inputPath
 * @param {Regexp} regex the regular expression to match include directives
 * @param {(context, ...args: string[]) => string} replaceFunction the callback function of the string.replace 
 * @returns {string} the contents with the includes resolved
 */
export async function handleIncludes(
  content, inputPath, config, data, includePath, regex, replaceFunction) {
  if (!content) {
    return null;
  }
  const includes = new Map();
  let parsed = path.parse(inputPath);
  const matches = Array.from(content.matchAll(regex));
  for (const [, file] of matches) {
    if (includes.has(file)) {
      continue;
    }
    const _dependants = data?._dependants instanceof Array ? data._dependants.slice(0) : [inputPath];
    const includeFile = path.join(includePath ?? parsed.dir, file);
    if (_dependants.includes(includeFile)) {
      console.warn(`Skipping Circular include detected in ${inputPath}: ${includeFile}`);
      continue;
    }
    _dependants.push(includeFile);
    const include = await handleTemplateFile(config, {_dependants, ...(data ?? {})}, includeFile);
    includes.set(file, include);
  }

  const defaultReplaceFunction = (context, _, file) => {
    return context.includes.get(file)?.content ?? `<!-- missing include: ${file} -->`;
  };
  
  const replaceContext = {
    inputPath,
    includes,
  };
  
  return content.replace(regex, 
    (...args) => (replaceFunction ?? defaultReplaceFunction)(replaceContext, ...args)
  );
}
