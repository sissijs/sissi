// smolYAML is a subset of YAML

// Token types
const KEY_VALUE  = 0; // key: value
const LIST_ITEM  = 1; // - value
const LIST_KEY   = 2; // - key: value (first key of an inline object in a list)
const BARE_VALUE = 3; // scalar at root level

const parseValue = (str) => {
  if (str === 'NaN') return NaN;
  if (str === 'undefined') return undefined;
  if (/^\-?\d+(?:\.\d+)?(?:e\d+)?$/.test(str) || ['true', 'false', 'null'].includes(str) || /^["\{\}\[\]\/]/.test(str)) return JSON.parse(str);
  if (str.startsWith("'") && str.endsWith("'")) return str.slice(1, -1).replace(/''/g, "'");
  return str;
};

function buildObject(lines) {
  if (lines.length === 0) {
    return null;
  }
  if (lines.length === 1 && lines[0].t === BARE_VALUE) {
    return parseValue(lines[0].v)
  }
  const result = lines[0].t === KEY_VALUE ? {} : [];
  let ref = result;
  const stack = [];
  let temp = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.t >= BARE_VALUE) {
      throw new Error('unsupported Syntax');
    }
    const nextLine = i < lines.length - 1 ? lines[i + 1] : null;
    if (line.t === LIST_KEY && line.k && ref instanceof Array) {
      temp = {[line.k]: parseValue(line.v)};
      ref.push(temp);
      stack.push([ref, line.i]);
      ref = temp;
    } else if (line.t === KEY_VALUE && line.k && ref instanceof Array === false) {
      if (line.v) {
        ref[line.k] = parseValue(line.v);
      } else {
        ref[line.k] = nextLine?.t === KEY_VALUE ? {} : [];
      }
      if (nextLine && nextLine.i > line.i) {
        stack.push([ref, line.i]);
        ref = ref[line.k];
        continue;
      }
    } else if (line.t === LIST_ITEM && line.v && ref instanceof Array) {
      ref.push(parseValue(line.v));
    }
    if (nextLine && nextLine.i < line.i) {
      let indent = line.i;
      while (indent > nextLine.i) {
        const stackItem = stack.pop();
        if (!stackItem) {
          throw new Error('stack underflow');
        }
        const [formerRef, formerIndent] = stackItem;
        ref =  formerRef;
        indent = formerIndent;
      }
    }
  }
  return result;
}

export function smolYAML(str) {
  const analyzed = str.split(/\r?\n/).map(line => {
    const m0 = line.match(/^(\s*)([\w-]+):\s*(.+)?$/);
    if (m0) {
      return {t: KEY_VALUE, i: m0[1].length, k: m0[2], v: m0[3]};
    }
    const m2 = line.match(/^(\s*)- ([\w-]+):\s*(.+)$/)
    if (m2) {
      return {t: LIST_KEY, i: m2[1].length, k: m2[2], v: m2[3]};
    }
    const m1 = line.match(/^(\s*)- (.+)$/);
    if (m1) {
      return {t: LIST_ITEM, i: m1[1].length, v: m1[2]};
    }
    if (line.trim() === '' || /^\s*#/.test(line)) {
      return undefined;
    }
    const m3 = line.match(/^(\s*)(.+)$/);
    return {t: BARE_VALUE, i: m3[1].length, v: m3[2].trimEnd()};
  }).filter(Boolean);
  return buildObject(analyzed);
}
