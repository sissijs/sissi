import { smolYAML } from "./smolyaml.js";

const REGEX = /^\-{3}(\w+)?\n((?:.*\n)*?)\-{3}\n((?:(?:.*)\n?)*)/;

export function frontmatter(str) {
  const matches = str.replace(/\r\n/g, '\n').match(REGEX);
  if (! matches) {
    return { data: null, body: str };
  }
  const matterType = matches[1] || 'yaml';
  const data = matterType === 'json' ? JSON.parse(matches[2]) : 
    matterType === 'yaml' ? smolYAML(matches[2]) : null;
  const body = matches[3];
  return { data, body };
}
