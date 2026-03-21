const MAGIC = [
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

function codeblocks(str) {
  const parts = [];
  str.split(/\n```/g).forEach((part, idx) => {
    if (idx % 2 === 0) {
      parts.push({type: 'text', content: part});
      return;
    }
    const lf = part.indexOf('\n');
    if (lf === -1) {
      parts[parts.length - 1].content += '\n```' + part;
      return;
    }
    const lang = part.slice(0, lf);
    const code = part.slice(lf + 1);
    const l = lang ? ` class="language-${lang}"` : '';
    parts.push({type: 'snippet', html:
      `<pre${l}><code${l}>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n</code></pre>`
    });
  });
  return parts;
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
  const esc = (str) => escape ? markdownEscape(str) : str;
  return codeblocks(input.replace(/\r\n/g, '\n'))
    .flatMap(part => {
      if (part.type === 'snippet') return [part.html];
      return part.content.split('\n\n').map(block => {
        block = block.trim();
        if (!block) return null;
        if (/^<.+?>/.test(block)) return esc(block);
        const hm = block.match(/^(#{1,6}) (.+)$/);
        if (hm) return `<h${hm[1].length}>${inlines(hm[2])}</h${hm[1].length}>`;
        if (UL_PATTERN.test(block)) return parseList(block);
        if (block.startsWith('> ')) {
          return `<blockquote>\n${inlines(block.replace(/^> /gm, ''))}\n</blockquote>`;
        }
        return `<p>${inlines(block)}</p>`;
      }).filter(Boolean).map(esc);
    })
    .join('\n\n').trim() + '\n';
}
