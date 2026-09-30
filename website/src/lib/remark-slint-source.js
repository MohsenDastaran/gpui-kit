import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { visit } from 'unist-util-visit';

// Component pages show a Slint version beside each GPUI sample.
// The import panel is the import that works after `uni-kit add`: files live in
// `ui/components`, and that directory is on the Slint include path.
// Each GroupBox in `ui/examples/<slug>.slint` is one usage sample, in source
// order, paired with the Rust samples after the import. Gallery-only wrap
// layout is stripped so the snippet matches what the preview runs.

const COMPONENT_PAGE = /[\\/]component[\\/]([^\\/]+)\.md$/;
const EXPORTS = /^export\s+(?:component|struct|enum|global)\s+([A-Za-z_][\w-]*)/gm;

const COPY = {
  en: {
    installed:
      'Installed in ui/components. That directory is on the Slint include path, so import by file name:',
  },
};

export const slintRoot = (root = process.cwd()) =>
  resolve(root, '..', 'crates', 'slint-component', 'ui');

/** The slugs with a Slint component and example. */
export function hasSlintExample(slug, root = process.cwd()) {
  const ui = slintRoot(root);
  return existsSync(join(ui, `${slug}.slint`)) && existsSync(join(ui, 'examples', `${slug}.slint`));
}

/** True when this slug has one Slint sample per usage GroupBox. */
export function hasSlintUsage(slug, root = process.cwd()) {
  const ui = slintRoot(root);
  return usageSnippets(ui, slug).length > 0;
}

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

function extractGroupBoxes(src) {
  const boxes = [];
  const pattern = /GroupBox\s*\{/g;
  let match;
  while ((match = pattern.exec(src))) {
    const openAt = match.index + match[0].length - 1;
    const closeAt = matchBrace(src, openAt);
    if (closeAt < 0) break;
    boxes.push({
      openAt: match.index,
      closeAt,
      inner: src.slice(openAt + 1, closeAt),
    });
    pattern.lastIndex = closeAt + 1;
  }
  return boxes;
}

function isStretchRectangle(block) {
  const body = block.replace(/^Rectangle\s*\{/, '').replace(/\}$/, '');
  const properties = body
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  if (properties.length === 0) return false;
  return properties.every((property) =>
    /^(row:|col:|horizontal-stretch:)/.test(property.replace(/\s+/g, ' ').trim()),
  );
}

function stripGalleryLayout(inner) {
  let src = inner.replace(/^\s*title:\s*"[^"]*";\s*/m, '');
  src = src.replace(/^\s*variant:\s*GroupBoxVariant\.\w+;\s*/m, '');

  const pieces = [];
  let i = 0;
  while (i < src.length) {
    const start = src.slice(i).search(/\bRectangle\s*\{/);
    if (start < 0) {
      pieces.push(src.slice(i));
      break;
    }
    pieces.push(src.slice(i, i + start));
    const openAt = i + start + src.slice(i + start).indexOf('{');
    const closeAt = matchBrace(src, openAt);
    if (closeAt < 0) {
      pieces.push(src.slice(i + start));
      break;
    }
    const block = src.slice(i + start, closeAt + 1);
    if (!isStretchRectangle(block)) pieces.push(block);
    i = closeAt + 1;
  }
  src = pieces.join('');
  src = src.replace(/^\s*row:\s*Theme\.wrap-row\([^;]+;\s*$/gm, '');
  src = src.replace(/^\s*col:\s*Theme\.wrap-col\([^;]+;\s*$/gm, '');
  src = src.replace(/^\s*row:\s*\d+;\s*$/gm, '');
  src = src.replace(/^\s*col:\s*root\.wrap-cols;\s*$/gm, '');
  return src;
}

function skipSpace(src, i) {
  while (i < src.length && /\s/.test(src[i])) i += 1;
  return i;
}

function isCompactLiteral(src, openAt, closeAt) {
  for (let i = openAt + 1; i < closeAt; ) {
    const char = src[i];
    if (char === '"' || char === "'") {
      i = skipString(src, i);
      continue;
    }
    if (char === '{' || char === '[' || char === ';') return false;
    i += 1;
  }
  return true;
}

function compactLiteral(src, openAt, closeAt) {
  let inner = '';
  for (let i = openAt + 1; i < closeAt; ) {
    const char = src[i];
    if (char === '"' || char === "'") {
      const start = i;
      i = skipString(src, i);
      inner += src.slice(start, i);
      continue;
    }
    if (/\s/.test(char)) {
      if (inner.length > 0 && inner.at(-1) !== ' ') inner += ' ';
      i += 1;
      continue;
    }
    inner += char;
    i += 1;
  }
  inner = inner.trim();
  return inner ? `{ ${inner} }` : '{}';
}

export function prettyPrintSlint(src) {
  const out = [];
  let indent = 0;
  let line = '';
  let paren = 0;
  const pad = () => '    '.repeat(indent);
  const flush = () => {
    const trimmed = line.trim();
    if (trimmed) out.push(`${pad()}${trimmed}`);
    line = '';
  };
  const closeBlock = (i, closer) => {
    flush();
    indent = Math.max(0, indent - 1);
    let text = closer;
    let next = skipSpace(src, i + 1);
    if (src[next] === ',' || src[next] === ';') {
      text += src[next];
      next += 1;
    }
    out.push(`${pad()}${text}`);
    return next;
  };

  for (let i = 0; i < src.length; ) {
    const char = src[i];
    if (char === '"' || char === "'") {
      const start = i;
      i = skipString(src, i);
      line += src.slice(start, i);
      continue;
    }
    if (char === '/' && src[i + 1] === '/') {
      const start = i;
      while (i < src.length && src[i] !== '\n') i += 1;
      line += src.slice(start, i);
      continue;
    }
    if (char === '(') {
      paren += 1;
      line += char;
      i += 1;
      continue;
    }
    if (char === ')') {
      paren = Math.max(0, paren - 1);
      line += char;
      i += 1;
      continue;
    }
    if ((char === ' ' || char === '\t') && line.length === 0) {
      i += 1;
      continue;
    }
    if (char === '{') {
      const closeAt = matchBrace(src, i);
      if (closeAt >= 0 && isCompactLiteral(src, i, closeAt)) {
        line += compactLiteral(src, i, closeAt);
        i = closeAt;
        const next = skipSpace(src, i + 1);
        if (src[next] === ',' || src[next] === ';') {
          line += src[next];
          i = next;
        }
        flush();
        i += 1;
        continue;
      }
      line += '{';
      flush();
      indent += 1;
      i += 1;
      continue;
    }
    if (char === '}') {
      i = closeBlock(i, '}');
      continue;
    }
    if (char === '[') {
      line += '[';
      flush();
      indent += 1;
      i += 1;
      continue;
    }
    if (char === ']') {
      i = closeBlock(i, ']');
      continue;
    }
    if (char === ';' && paren === 0) {
      line += ';';
      flush();
      i += 1;
      continue;
    }
    if (char === ',' && paren === 0) {
      line += ',';
      flush();
      i += 1;
      continue;
    }
    if (char === '\n') {
      flush();
      i += 1;
      continue;
    }
    line += char;
    i += 1;
  }
  flush();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function usageSnippets(ui, slug) {
  const path = join(ui, 'examples', `${slug}.slint`);
  if (!existsSync(path)) return [];
  const boxes = extractGroupBoxes(readFileSync(path, 'utf8'));
  // Gallery samples are the titled GroupBoxes; an untitled wrapper is layout
  // chrome and has no code-button heading, so it is not a usage snippet.
  return boxes
    .filter((box) => /^\s*title:\s*"[^"]+"\s*;/m.test(box.inner))
    .map((box) => prettyPrintSlint(stripGalleryLayout(box.inner)))
    .filter(Boolean);
}

function importBlock(ui, slug, copy) {
  const source = readFileSync(join(ui, `${slug}.slint`), 'utf8');
  const names = [...source.matchAll(EXPORTS)].map(([, name]) => name);
  return [`// ${copy.installed}`, `import { ${names.join(', ')} } from "${slug}.slint";`].join('\n');
}

const code = (value) => ({ type: 'code', lang: 'slint', meta: null, value });

export function formatExampleFile(path) {
  const src = readFileSync(path, 'utf8');
  const boxes = extractGroupBoxes(src);
  if (boxes.length === 0) return false;
  let next = src;
  for (let i = boxes.length - 1; i >= 0; i -= 1) {
    const box = boxes[i];
    const openBrace = next.indexOf('{', box.openAt);
    const formatted = prettyPrintSlint(box.inner);
    const indented = formatted
      .split('\n')
      .map((line) => (line ? `        ${line}` : ''))
      .join('\n');
    next = `${next.slice(0, openBrace + 1)}\n${indented}\n    ${next.slice(box.closeAt)}`;
  }
  if (next === src) return false;
  writeFileSync(path, next);
  return true;
}

export function formatAllExamples(root = process.cwd()) {
  const dir = join(slintRoot(root), 'examples');
  let changed = 0;
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.slint'))) {
    if (formatExampleFile(join(dir, name))) changed += 1;
  }
  return changed;
}

export function remarkSlintSource({ root = process.cwd() } = {}) {
  const ui = slintRoot(root);

  return (tree, file) => {
    const path = String(file?.path ?? file?.history?.[0] ?? '');
    const slug = COMPONENT_PAGE.exec(path)?.[1];
    if (!slug || !hasSlintExample(slug, root)) return;
    const copy = COPY.en;

    const rust = [];
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'slint' && parent && index !== undefined) rust.push({ node, parent });
    });
    const [imports, usage] = rust;
    if (!imports || !usage) return;

    const after = ({ node, parent }, ...nodes) =>
      parent.children.splice(parent.children.indexOf(node) + 1, 0, ...nodes);
    after(imports, code(importBlock(ui, slug, copy)));

    const snippets = usageSnippets(ui, slug);
    if (snippets.length > 0) {
      snippets.forEach((value, index) => {
        const target = rust[index + 1];
        if (target) after(target, code(value));
      });
      return;
    }

    const example = readFileSync(join(ui, 'examples', `${slug}.slint`), 'utf8')
      .replaceAll('from "../', 'from "')
      .trimEnd();
    after(usage, code(prettyPrintSlint(example)));
  };
}
