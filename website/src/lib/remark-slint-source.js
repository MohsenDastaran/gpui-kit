import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { visit } from 'unist-util-visit';

// Component pages show a Slint version beside each GPUI sample.
// The import panel is the import that works after `uni-kit add`: files live in
// `ui/components`, and that directory is on the Slint include path.
// When `ui/usage/<slug>/<locale>/*.slint` exists, each file is one usage sample,
// in filename order, paired with that locale's Rust samples after the import.
// A shared `ui/usage/<slug>/*.slint` folder is the fallback. Otherwise the
// gallery example fills the first usage panel.

const COMPONENT_PAGE = /[\\/]component[\\/]([^\\/]+)\.md$/;
const EXPORTS = /^export\s+(?:component|struct|enum|global)\s+([A-Za-z_][\w-]*)/gm;

const COPY = {
  en: {
    installed:
      'Installed in ui/components. That directory is on the Slint include path, so import by file name:',
  },
  'zh-CN': {
    installed: '安装到 ui/components。该目录已加入 Slint 的 include path，按文件名导入：',
  },
};

export const slintRoot = (root = process.cwd()) =>
  resolve(root, '..', 'crates', 'slint-component', 'ui');

/** The slugs with a Slint component and example. */
export function hasSlintExample(slug, root = process.cwd()) {
  const ui = slintRoot(root);
  return existsSync(join(ui, `${slug}.slint`)) && existsSync(join(ui, 'examples', `${slug}.slint`));
}

/** True when this slug has one Slint sample per usage section. */
export function hasSlintUsage(slug, root = process.cwd()) {
  const ui = slintRoot(root);
  return usageSnippets(ui, slug, 'en').length > 0 || usageSnippets(ui, slug, 'zh-CN').length > 0;
}

function usageDirectory(ui, slug, locale) {
  const localized = join(ui, 'usage', slug, locale);
  if (existsSync(localized)) return localized;
  return join(ui, 'usage', slug);
}

function usageSnippets(ui, slug, locale = 'en') {
  const dir = usageDirectory(ui, slug, locale);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.slint'))
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8').trimEnd());
}

function importBlock(ui, slug, copy) {
  const source = readFileSync(join(ui, `${slug}.slint`), 'utf8');
  const names = [...source.matchAll(EXPORTS)].map(([, name]) => name);
  return [`// ${copy.installed}`, `import { ${names.join(', ')} } from "${slug}.slint";`].join('\n');
}

const code = (value) => ({ type: 'code', lang: 'slint', meta: null, value });

export function remarkSlintSource({ root = process.cwd() } = {}) {
  const ui = slintRoot(root);

  return (tree, file) => {
    const path = String(file?.path ?? file?.history?.[0] ?? '');
    const slug = COMPONENT_PAGE.exec(path)?.[1];
    if (!slug || !hasSlintExample(slug, root)) return;
    const locale = /[\\/]zh-CN[\\/]/.test(path) ? 'zh-CN' : 'en';
    const copy = COPY[locale];

    const rust = [];
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'slint' && parent && index !== undefined) rust.push({ node, parent });
    });
    const [imports, usage] = rust;
    if (!imports || !usage) return;

    const after = ({ node, parent }, ...nodes) =>
      parent.children.splice(parent.children.indexOf(node) + 1, 0, ...nodes);
    after(imports, code(importBlock(ui, slug, copy)));

    const snippets = usageSnippets(ui, slug, locale);
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
    after(usage, code(example));
  };
}
