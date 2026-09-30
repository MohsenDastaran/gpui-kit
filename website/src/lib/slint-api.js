import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { slintRoot } from './remark-slint-source.js';

// The public surface of a component file: exported components, structs, and
// enums, without the private properties the gallery uses internally.

const EXPORT = /^export\s+(component|struct|enum)\s+([A-Za-z_][\w-]*)/;

function skipString(src, i) {
  const quote = src[i];
  i += 1;
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2;
      continue;
    }
    if (src[i] === quote) return i + 1;
    i += 1;
  }
  return i;
}

function matchBrace(src, openAt) {
  let depth = 0;
  for (let i = openAt; i < src.length; i += 1) {
    const char = src[i];
    if (char === '"' || char === "'") {
      i = skipString(src, i) - 1;
      continue;
    }
    if (char === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function readType(line, from) {
  let depth = 0;
  let i = from;
  for (; i < line.length; i += 1) {
    const char = line[i];
    if (char === '<') depth += 1;
    else if (char === '>') {
      depth -= 1;
      if (depth === 0) return { type: line.slice(from, i + 1), end: i + 1 };
    }
  }
  return null;
}

function propertyOf(line) {
  const start = line.match(/^(in-out|in|out)\s+property\s*</);
  if (!start) return null;
  const type = readType(line, start[0].length - 1);
  if (!type) return null;
  const rest = line.slice(type.end).match(/^\s+([\w-]+)\s*(?::\s*([^;]+))?;/);
  if (!rest) return null;
  return {
    name: rest[1],
    kind: start[1],
    type: type.type.slice(1, -1).trim(),
    defaultValue: rest[2]?.trim() ?? '',
  };
}

function callbackOf(line) {
  const match = line.match(/^callback\s+([\w-]+)\s*(\([^)]*\))?/);
  if (!match) return null;
  return {
    name: match[1],
    kind: 'callback',
    type: match[2]?.trim() || '()',
    defaultValue: '',
  };
}

function fieldOf(line) {
  const match = line.match(/^([\w-]+)\s*:\s*([^,]+),?$/);
  if (!match) return null;
  return { name: match[1], kind: 'field', type: match[2].trim(), defaultValue: '' };
}

function variantsOf(body) {
  return body
    .replace(/\/\/.*$/gm, '')
    .split(/[\s,]+/)
    .map((name) => name.trim())
    .filter((name) => /^[A-Za-z_][\w-]*$/.test(name));
}

function membersOf(body, kind) {
  const members = [];
  let comment = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('//')) {
      comment.push(line.replace(/^\/\/\s?/, ''));
      continue;
    }
    if (!line || line === '{' || line === '}') {
      comment = [];
      continue;
    }
    const member = kind === 'struct' ? fieldOf(line) : propertyOf(line) ?? callbackOf(line);
    if (!member) {
      comment = [];
      continue;
    }
    members.push({ ...member, description: comment.join(' ') });
    comment = [];
  }
  return members;
}

export function parseSlintApi(source) {
  const items = [];
  const lines = source.split('\n');
  let pending = [];
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const length = line.length + 1;
    if (trimmed.startsWith('//')) {
      pending.push(trimmed.replace(/^\/\/\s?/, ''));
      offset += length;
      continue;
    }
    const header = trimmed.match(EXPORT);
    if (!header) {
      if (trimmed) pending = [];
      offset += length;
      continue;
    }
    const braceAt = source.indexOf('{', offset);
    if (braceAt < 0) break;
    const closeAt = matchBrace(source, braceAt);
    if (closeAt < 0) break;
    const body = source.slice(braceAt + 1, closeAt);
    const kind = header[1];
    items.push({
      kind,
      name: header[2],
      doc: pending.join(' '),
      variants: kind === 'enum' ? variantsOf(body) : [],
      members: kind === 'enum' ? [] : membersOf(body, kind),
    });
    pending = [];
    const consumed = source.slice(offset, closeAt + 1);
    const extra = consumed.split('\n').length - 1;
    index += extra;
    offset = closeAt + 1;
    while (offset < source.length && source[offset] !== '\n') offset += 1;
    offset += 1;
  }
  return items;
}

export function slintApiFor(slug, root = process.cwd()) {
  const path = join(slintRoot(root), `${slug}.slint`);
  if (!existsSync(path)) return [];
  return parseSlintApi(readFileSync(path, 'utf8'));
}

export function slintAnchor(name, member = '') {
  const base = `slint-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (!member) return base;
  return `${base}-${member.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

let catalogCache;
let catalogRoot;

// Every public export that has a component page, so a related-component link
// can land on that export instead of the GPUI docs.
export function slintCatalog(root = process.cwd()) {
  if (catalogCache && catalogRoot === root) return catalogCache;
  const ui = slintRoot(root);
  const pages = new Set(
    readdirSync(join(root, 'component'))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -3)),
  );
  const items = [];
  for (const file of readdirSync(ui)) {
    if (!file.endsWith('.slint')) continue;
    const slug = file.slice(0, -'.slint'.length);
    if (!pages.has(slug)) continue;
    for (const item of parseSlintApi(readFileSync(join(ui, file), 'utf8'))) {
      items.push({ ...item, slug });
    }
  }
  catalogCache = items;
  catalogRoot = root;
  return items;
}
