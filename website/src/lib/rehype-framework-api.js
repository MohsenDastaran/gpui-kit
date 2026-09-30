import { slintAnchor, slintApiFor, slintCatalog } from './slint-api.js';

// The API Reference written in the page is the GPUI one. A component that has
// a Slint file gets that reference beside it, and the framework switch shows
// only the matching one. Related-component links follow the same switch:
// GPUI keeps the docs.rs pages, Slint goes to the matching export on this site.

const COMPONENT_PAGE = /[\\/]component[\\/]([^\\/]+)\.md$/;
const API_HEADING = /^api reference\b/i;
const RELATED_HEADING = /^related (components|types)$/i;
const DOC_LINK = /docs\.rs|crates\.io/i;
const PARTS = new Set(['header', 'title', 'description', 'footer', 'action', 'actions', 'close', 'content', 'icon', 'media', 'group']);

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
  return slintAnchor(name);
}

function cell(value, code = false) {
  const content = code && value ? [element('code', {}, [text(value)])] : [text(value)];
  return element('td', {}, content);
}

function memberTable(componentName, members) {
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
      return element('tr', { id: slintAnchor(componentName, member.name) }, cells);
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
      blocks.push(memberTable(item.name, item.members));
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

function sectionEnd(children, index, rank) {
  let end = index + 1;
  while (end < children.length) {
    const next = children[end];
    const nextRank = next?.type === 'element' ? headingRank(next) : 0;
    if (nextRank && nextRank <= rank) break;
    end += 1;
  }
  return end;
}

function typeFromHref(href) {
  return String(href ?? '').match(/\/(?:struct|enum|trait|type|fn)\.([A-Za-z0-9_]+)\.html/)?.[1] ?? '';
}

function exportHref(item) {
  return `/component/${item.slug}#${slintAnchor(item.name)}`;
}

// DialogTitle lands on Dialog's `title` property. DialogHeader has no export
// of its own, so it lands on Dialog, which draws that header.
function resolveSlint(label, catalog) {
  const key = normalize(label);
  if (!key) return null;
  const exact = catalog.find((item) => normalize(item.name) === key);
  if (exact) return exportHref(exact);

  let best = null;
  for (const item of catalog) {
    const prefix = normalize(item.name);
    if (prefix.length < 3 || !key.startsWith(prefix) || key.length === prefix.length) continue;
    if (best && prefix.length <= best.prefix.length) continue;
    best = { item, prefix, rest: key.slice(prefix.length) };
  }
  if (!best) return null;

  const member = best.item.members.find((entry) => normalize(entry.name) === best.rest)
    ?? (best.rest.length >= 4
      ? best.item.members
        .filter((entry) => normalize(entry.name).startsWith(best.rest))
        .sort((left, right) => left.name.length - right.name.length)[0]
      : undefined);
  if (member) return `/component/${best.item.slug}#${slintAnchor(best.item.name, member.name)}`;
  if (PARTS.has(best.rest)) return exportHref(best.item);
  return null;
}

function anchorsIn(node, found = []) {
  if (!node || node.type !== 'element') return found;
  if (node.tagName === 'a') found.push(node);
  for (const child of node.children ?? []) anchorsIn(child, found);
  return found;
}

function stripDropped(node) {
  if (!node?.children) return;
  node.children = node.children.filter((child) => child.properties?.dataDrop !== '1');
  for (const child of node.children) stripDropped(child);
}

function retargetItem(item, catalog) {
  const docs = anchorsIn(item).filter((anchor) => DOC_LINK.test(String(anchor.properties?.href ?? '')));
  if (docs.length === 0) return 'keep';
  let resolved = 0;
  for (const anchor of docs) {
    const target = resolveSlint(textOf(anchor), catalog) ?? resolveSlint(typeFromHref(anchor.properties?.href), catalog);
    if (!target) {
      anchor.properties = { ...anchor.properties, dataDrop: '1' };
      continue;
    }
    anchor.properties.href = target;
    resolved += 1;
  }
  stripDropped(item);
  return resolved > 0 ? 'changed' : 'drop';
}

function retargetRelated(nodes, catalog) {
  const copy = structuredClone(nodes);
  let changed = false;
  const walk = (node) => {
    if (!node || node.type !== 'element') return;
    if (node.tagName === 'ul' || node.tagName === 'ol') {
      node.children = (node.children ?? []).filter((child) => {
        if (child.type !== 'element' || child.tagName !== 'li') return true;
        const result = retargetItem(child, catalog);
        if (result === 'changed') changed = true;
        return result !== 'drop';
      });
      if ((node.children ?? []).length === 0) node.properties = { ...(node.properties ?? {}), dataDrop: '1' };
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of copy) walk(node);
  if (!changed) return null;
  const kept = copy.filter((node) => node.properties?.dataDrop !== '1');
  return kept.length > 0 ? kept : null;
}

function relatedCopies(nodes, catalog) {
  const blocks = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const rank = node?.type === 'element' ? headingRank(node) : 0;
    if (!rank || !RELATED_HEADING.test(textOf(node).trim())) continue;
    const slintNodes = retargetRelated(nodes.slice(index + 1, sectionEnd(nodes, index, rank)), catalog);
    if (!slintNodes) continue;
    blocks.push(
      element('h3', { id: slintAnchor('related-components') }, [text(textOf(node).trim())]),
      ...slintNodes,
    );
  }
  return blocks;
}

function split(parent, slug, root, catalog) {
  const children = parent.children ?? [];
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    if (node.type !== 'element') continue;
    const rank = headingRank(node);
    if (rank && RELATED_HEADING.test(textOf(node).trim())) {
      const end = sectionEnd(children, index, rank);
      const body = children.slice(index + 1, end);
      const slintNodes = retargetRelated(body, catalog);
      if (slintNodes) {
        const wrap = element('div', { className: ['framework-api'] }, [
          panel('gpui', body),
          panel('slint', slintNodes),
        ]);
        children.splice(index + 1, body.length, wrap);
        index += 1;
      }
      continue;
    }
    if (rank && API_HEADING.test(textOf(node).trim())) {
      const end = sectionEnd(children, index, rank);
      const body = children.slice(index + 1, end);
      const wrap = element('div', { className: ['framework-api'] }, [
        panel('gpui', body),
        panel('slint', [
          ...slintBody(itemsFor(slintApiFor(slug, root), children, index, rank)),
          ...relatedCopies(body, catalog),
        ]),
      ]);
      children.splice(index + 1, body.length, wrap);
      index += 1;
      continue;
    }
    if (node.children) split(node, slug, root, catalog);
  }
}

export function rehypeFrameworkApi({ root = process.cwd() } = {}) {
  return (tree, file) => {
    const path = String(file?.path ?? file?.history?.[0] ?? '');
    const slug = COMPONENT_PAGE.exec(path)?.[1];
    if (!slug || slintApiFor(slug, root).length === 0) return;
    split(tree, slug, root, slintCatalog(root));
  };
}
