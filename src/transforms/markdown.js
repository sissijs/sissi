const MAGIC = [
  [/^###### (.+)$/g, '<h6>$1</h6>'],
  [/^##### (.+)$/g, '<h5>$1</h5>'],
  [/^#### (.+)$/g, '<h4>$1</h4>'],
  [/^### (.+)$/g, '<h3>$1</h3>'],
  [/^## (.+)$/g, '<h2>$1</h2>'],
  [/^# (.+)$/g, '<h1>$1</h1>'],
  [/ $/gm, '<br/>'],
  [/\*\*(.+?)\*\*/g, '<strong>$1</strong>'],
  [/__(.+?)__/g, '<strong>$1</strong>'],
  [/\*(.+?)\*/g, '<em>$1</em>'],
  [/_(.+?)_/g, '<em>$1</em>'],
  [/`(.+?)`/g, '<code>$1</code>'],
  [/<(https?:\/\/.+)>/g, '<a href="$1">$1</a>'],
  [
    /\!\[(.+?)\]\((.+?)\)/g,
    '<img src="$2" alt="$1" />'
  ],
  [
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2">$1</a>'
  ]
];

const UL_PATTERN = /((\s*)(\-|(?:(?:\d+\.)+)) (.+)\n)+/
const ULLI_PATTERN = /(\s*)(\-|(?:(?:\d+\.)+)) (.+)\n?/g

function inlines(str) {
  let result = str
  for (const [search, replace] of MAGIC) {
    result = result.replace(search, replace);
  }
  return result
}

function renderList(list) {
  let u = Number.isNaN(list.start)
  let html = u ? '<ul>' : `<ol${list.start!==1?` start="${list.start}"`:''}>`;
  for (const li of list.items) {
    html += '<li>' + inlines(li.content);
    if (li.childList) {
      html+=renderList(li.childList);
    }
    html += '</li>';
  }
  return html + (u?'</ul>':'</ol>');
}

function parseList(block) {
  const matches = block.matchAll(ULLI_PATTERN);
  if (! matches) {
    throw new Error('could not be parsed', block);
  }
  const m = Array.from(matches);
  const listItems = m.map(match => ({
    indent: match[1].length,
    prefix: match[2],
    content: match[3],
  }));
  const parseStart = (str) => {
    const idxPattern = str.match(/(\d+)\.$/);
    return idxPattern ? parseInt(idxPattern[1]): NaN;
  }

  const list = {start: parseStart(listItems[0].prefix), items: []};
  let currentList = list;
  let stack = [];
  let last = null;

  for (const li of listItems) {
    if (last !== null && li.indent > last.indent) {
      stack.push({list: currentList, indent: last.indent});
      currentList = last.childList = {
        start: parseStart(li.prefix),
        items: []
      };
    } else if (last && li.indent < last.indent) {
      while (stack.length > 0 && stack[stack.length - 1].indent >= li.indent) {
        currentList = stack.pop().list;
      }
    }
    const item = {...li, childList: null};
    currentList.items.push(item);
    last = item;
  }
  return renderList(list);
}

function codeblocks(str, snippetStore) {
  let counter = 1;
  return str.split(/\n```/g).map((part, idx) => {
    if (idx % 2 === 0) {
      return part;
    }
    const lf = part.indexOf('\n');
    if (lf === -1) {
      return part;
    }
    const lang = part.slice(0, lf);
    const code = part.slice(lf + 1);
    const key =  'MARKDOWNSNIPPET' + (counter++)
    const l = lang ? ` class="language-${lang}"` : '';
    snippetStore.set(key,
      `<pre${l}><code${l}>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n</code></pre>`
    );
    
    return `{{ ${key} }}`
  }).join('\n').trim();
}

export function markdownEscape(str) {
  return str.replace(/\\([a-z\/\\`\{\}])/, '$1').replace(/(.?)([<>&])(.?)/g, 
    (_, before, char, after) => 
      before + (/[^\s]+/.test(before) || /[^\s]+/.test(after) ? char:`&${{'<':'lt','>':'gt','&':'amp'}[char]};`) + after
    );
}

export function markdown(input, escape = true) {
  if (! input) {
    return undefined;
  }
  const vars = new Map();
  const esc = (str) => escape?markdownEscape(str):str;
  return esc(codeblocks(input.replace(/\r\n/g,'\n'), vars).split('\n\n')
    .map(block => inlines(block.trim()))
    .map(block => {
    if (UL_PATTERN.test(block)) {
      return parseList(block);
    }
    if (block.startsWith('> ')) {
      return `<blockquote>\n${block.replace(/^> /gm, '')}\n</blockquote>`
    }
    if (/^<.+?>/.test(block)) {
      return block;
    }
    if (/\{\{ MARKDOWNSNIPPET\d+ \}\}/.test(block)) {
      return block;
    }
    return `<p>${block}</p>`
  }).join('\n\n')).replace(/\{\{\s*(\w+)\s*\}\}/g, 
    (outer, expr) => (vars.get(expr)) ? vars.get(expr) : outer
  ).trim() + '\n';
}
