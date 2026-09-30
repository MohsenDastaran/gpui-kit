import { slintApiFor } from './slint-api.js';

// The API Reference written in the page is the GPUI one. A component that has
// a Slint file gets that reference beside it, and the framework switch shows
// only the matching one.

const COMPONENT_PAGE = /[\\/]component[\\/]([^\\/]+)\.md$/;
const API_HEADING = /^api reference\b/i;

const textOf = (node) => {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  if (node.children) return node.children.map(textOf).join('');
  return '';
};

const element = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });

function headingRank(node) {
  const match = /^h([1-6])$/.exec(node.tagName ?? '');
  return match ? Number(match[1]) : 0;
}

function slugId(name) {
  return `slint-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function cell(value, code = false) {
  const content = code && value ? [element('code', {}, [text(value)])] : [text(value)];
  return element('td', {}, content);
}

function memberTable(members) {
  const described = members.some((member) => member.description);
  const head = ['Name', 'Kind', 'Type', 'Default', ...(described ? ['Description'] : [])];
  return element('table', {}, [
    element('thead', {}, [
      element('tr', {}, head.map((label) => element('th', {}, [text(label)]))),
    ]),
    element('tbody', {}, members.map((member) => {
      const cells = [
        cell(member.name, true),
        cell(member.kind),
        cell(member.type, true),
        cell(member.defaultValue, Boolean(member.defaultValue)),
      ];
      if (described) cells.push(cell(member.description));
      return element('tr', {}, cells);
    })),
  ]);
}

function slintBody(items) {
  if (items.length === 0) {
    return [element('p', {}, [text('This component has no exported Slint API.')])];
  }
  return items.flatMap((item) => {
    const blocks = [
      element('h3', { id: slugId(item.name) }, [text(item.name)]),
    ];
    if (item.doc) blocks.push(element('p', {}, [text(item.doc)]));
    if (item.kind === 'enum') {
      blocks.push(element('p', {}, item.variants.flatMap((name, index) => {
        const nodes = [element('code', {}, [text(name)])];
        if (index < item.variants.length - 1) nodes.push(text(', '));
        return nodes;
      })));
    } else if (item.members.length > 0) {
      blocks.push(memberTable(item.members));
    }
    return blocks;
  });
}

function panel(framework, children) {
  return element('div', { className: ['framework-api__panel'], dataFrameworkPanel: framework }, children);
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// A page-level reference documents every export. A reference nested under a
// named section, such as Progress and ProgressCircle, documents that export.
function itemsFor(items, children, index, rank) {
  if (rank <= 2) return items;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const node = children[cursor];
    if (node.type !== 'element') continue;
    const nodeRank = headingRank(node);
    if (!nodeRank || nodeRank >= rank) continue;
    const key = normalize(textOf(node));
    const matched = items.filter((item) => normalize(item.name) === key);
    return matched.length > 0 ? matched : items;
  }
  return items;
}

function split(parent, slug, root) {
  const children = parent.children ?? [];
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    if (node.type !== 'element') continue;
    const rank = headingRank(node);
    if (rank && API_HEADING.test(textOf(node).trim())) {
      let end = index + 1;
      while (end < children.length) {
        const next = children[end];
        const nextRank = next.type === 'element' ? headingRank(next) : 0;
        if (nextRank && nextRank <= rank) break;
        end += 1;
      }
      const body = children.slice(index + 1, end);
      const wrap = element('div', { className: ['framework-api'] }, [
        panel('gpui', body),
        panel('slint', slintBody(itemsFor(slintApiFor(slug, root), children, index, rank))),
      ]);
      children.splice(index + 1, body.length, wrap);
      index += 1;
      continue;
    }
    if (node.children) split(node, slug, root);
  }
}

export function rehypeFrameworkApi({ root = process.cwd() } = {}) {
  return (tree, file) => {
    const path = String(file?.path ?? file?.history?.[0] ?? '');
    const slug = COMPONENT_PAGE.exec(path)?.[1];
    if (!slug || slintApiFor(slug, root).length === 0) return;
    split(tree, slug, root);
  };
}
