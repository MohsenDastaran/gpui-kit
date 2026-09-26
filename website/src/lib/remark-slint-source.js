import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { visit } from 'unist-util-visit';

// Component pages show the Slint version of a component beside the GPUI code.
// The Slint source lives in `crates/slint-component/ui/<slug>.slint`, with the
// gallery example in `ui/examples/<slug>.slint`. This reads both and places
// them as ```slint blocks straight after the page's first two Rust blocks —
// the import and the basic usage, on every component page — where
// `rehype-framework-code` pairs them into those blocks' Slint panels.

const COMPONENT_PAGE = /[\\/]component[\\/]([^\\/]+)\.md$/;
const IMPORT = /^import\s*\{[^}]*\}\s*from\s*"([^"]+\.slint)"\s*;/gm;
const EXPORTS = /^export\s+(?:component|struct|enum|global)\s+([A-Za-z_][\w-]*)/gm;

const COPY = {
  en: {
    copy: 'Copy these files from crates/slint-component/ui into your project:',
    icons: 'with its icons/ folder',
  },
  'zh-CN': {
    copy: '将以下文件从 crates/slint-component/ui 复制到你的项目：',
    icons: '以及 icons/ 目录',
  },
};

export const slintRoot = (root = process.cwd()) =>
  resolve(root, '..', 'crates', 'slint-component', 'ui');

/** The slugs with a Slint component and example. */
export function hasSlintExample(slug, root = process.cwd()) {
  const ui = slintRoot(root);
  return existsSync(join(ui, `${slug}.slint`)) && existsSync(join(ui, 'examples', `${slug}.slint`));
}

/** `file` and every `.slint` file it imports, transitively, relative to `ui`. */
function dependencies(ui, file, seen = new Set()) {
  const name = relative(ui, file);
  if (seen.has(name) || !existsSync(file)) return seen;
  seen.add(name);
  for (const [, target] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
    dependencies(ui, resolve(dirname(file), target), seen);
  }
  return seen;
}

function importBlock(ui, slug, copy) {
  const file = join(ui, `${slug}.slint`);
  const source = readFileSync(file, 'utf8');
  const names = [...source.matchAll(EXPORTS)].map(([, name]) => name);
  const files = [...dependencies(ui, file)].map((name) =>
    name === 'icon.slint' ? `${name} (${copy.icons})` : name,
  );
  return [
    `// ${copy.copy}`,
    `//   ${files.join(', ')}`,
    `import { ${names.join(', ')} } from "${slug}.slint";`,
  ].join('\n');
}

const code = (value) => ({ type: 'code', lang: 'slint', meta: null, value });

export function remarkSlintSource({ root = process.cwd() } = {}) {
  const ui = slintRoot(root);

  return (tree, file) => {
    const path = String(file?.path ?? file?.history?.[0] ?? '');
    const slug = COMPONENT_PAGE.exec(path)?.[1];
    if (!slug || !hasSlintExample(slug, root)) return;
    const copy = /[\\/]zh-CN[\\/]/.test(path) ? COPY['zh-CN'] : COPY.en;

    const rust = [];
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'slint' && parent && index !== undefined) rust.push({ node, parent });
    });
    const [imports, usage] = rust;
    if (!imports || !usage) return;

    const source = readFileSync(join(ui, `${slug}.slint`), 'utf8').trimEnd();
    const example = readFileSync(join(ui, 'examples', `${slug}.slint`), 'utf8')
      .replaceAll('from "../', 'from "')
      .trimEnd();

    const after = ({ node, parent }, ...nodes) =>
      parent.children.splice(parent.children.indexOf(node) + 1, 0, ...nodes);
    after(usage, code(example));
    after(imports, code(importBlock(ui, slug, copy)), code(`// ${slug}.slint\n${source}`));
  };
}
