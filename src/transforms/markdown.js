const MAGIC = [
  [/ $/gm, '<br/>'],
  [/~~(.+?)~~/g, '<del>$1</del>'],
  [/\*\*(.+?)\*\*/g, '<strong>$1</strong>'],
  [/__(.+?)__/g, '<strong>$1</strong>'],
  [/\*(.+?)\*/g, '<em>$1</em>'],
  [/_(.+?)_/g, '<em>$1</em>'],
  [/`(.+?)`/g, (_, code) => `<code>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`],
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

const UL_PATTERN = /^[ \t]*(?:-|(?:\d+\.)+) /m
const ULLI_PATTERN = /(\s*)(\-|(?:(?:\d+\.)+)) (.+)\n?/g
const HR_PATTERN = /^(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/

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
    const taskMatch = li.content.match(/^\[([ x])\] (.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1] === 'x' ? ' checked' : '';
      html += `<li><input type="checkbox" disabled${checked}> ${inlines(taskMatch[2])}`;
    } else {
      html += '<li>' + inlines(li.content);
    }
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

function parseTable(block) {
  const rows = block.split('\n');
  if (rows.length < 2) return null;
  if (!/^\|?[\s|:\-]+\|?$/.test(rows[1])) return null;

  const parseRow = (row) =>
    row.replace(/^\||\|$/g, '').split('|').map(s => s.trim());

  const aligns = parseRow(rows[1]).map(s => {
    if (/^:-+:$/.test(s)) return 'center';
    if (/^-+:$/.test(s)) return 'right';
    if (/^:-+$/.test(s)) return 'left';
    return null;
  });

  const a = (i) => aligns[i] ? ` style="text-align:${aligns[i]}"` : '';
  const thead = '<tr>' + parseRow(rows[0]).map((h, i) => `<th${a(i)}>${inlines(h)}</th>`).join('') + '</tr>';
  const tbody = rows.slice(2).map(row =>
    '<tr>' + parseRow(row).map((cell, i) => `<td${a(i)}>${inlines(cell)}</td>`).join('') + '</tr>'
  ).join('\n');

  return `<table>\n<thead>\n${thead}\n</thead>\n<tbody>\n${tbody}\n</tbody>\n</table>`;
}

// Split a block at ATX headings, HRs, and setext underlines so that
// adjacent block elements without blank lines between them are handled correctly.
function splitAtSelfTerminating(block) {
  const lines = block.split('\n');
  const result = [];
  let pending = [];

  for (const line of lines) {
    const isATX = /^#{1,6} /.test(line);
    const isSetextUnder = pending.length > 0 && (/^=+$/.test(line) || /^-+$/.test(line));
    const isHR = !isSetextUnder && HR_PATTERN.test(line);

    if (isATX || isHR) {
      if (pending.length) { result.push(pending.join('\n')); pending = []; }
      result.push(line);
    } else if (isSetextUnder) {
      pending.push(line);
      result.push(pending.join('\n'));
      pending = [];
    } else {
      pending.push(line);
    }
  }
  if (pending.length) result.push(pending.join('\n'));
  return result;
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
  return str
    .replace(/\\([a-z\/\\`\{\}])/g, '$1')
    .replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, '&amp;')
    .replace(/(?<!\S)<(?!\S)/g, '&lt;')
    .replace(/(?<!\S)>(?!\S)/g, '&gt;');
}

export function markdown(input, escape = true) {
  if (! input) {
    return undefined;
  }
  const esc = (str) => escape ? markdownEscape(str) : str;
  return codeblocks(input.replace(/\r\n/g, '\n'))
    .flatMap(part => {
      if (part.type === 'snippet') return [part.html];
      return part.content.split('\n\n').flatMap(block => {
        block = block.trim();
        return block ? splitAtSelfTerminating(block) : [];
      }).map(block => {
        block = block.trim();
        if (!block) return null;
        if (/^<.+?>/.test(block)) return esc(block);
        if (HR_PATTERN.test(block)) return '<hr/>';
        const hm = block.match(/^(#{1,6}) (.+)$/);
        if (hm) return `<h${hm[1].length}>${inlines(hm[2])}</h${hm[1].length}>`;
        const sm = block.match(/^(.+)\n(=+|-+)$/s);
        if (sm) {
          const level = sm[2][0] === '=' ? 1 : 2;
          return `<h${level}>${inlines(sm[1])}</h${level}>`;
        }
        if (block.includes('|')) {
          const table = parseTable(block);
          if (table) return table;
        }
        if (UL_PATTERN.test(block)) return parseList(block);
        if (block.startsWith('> ')) {
          const inner = block.replace(/^>[ ]?/gm, '');
          return `<blockquote>\n${markdown(inner, false).trimEnd()}\n</blockquote>`;
        }
        return `<p>${inlines(block)}</p>`;
      }).filter(Boolean).map(esc);
    })
    .join('\n\n').trim() + '\n';
}
