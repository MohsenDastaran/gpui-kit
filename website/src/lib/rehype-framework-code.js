import { SKIP, visit } from 'unist-util-visit';
import { hasSlintExample, hasSlintUsage } from './remark-slint-source.js';
import { logoElement } from './toggle-logos.js';

// Component pages carry one copy-paste block per framework. ```slint fences
// directly after a Rust fence become that example's Slint version; any other
// block is GPUI. A block that only one framework has is omitted from the other
// framework, including the heading that introduces nothing else.

export const FRAMEWORKS = ['gpui', 'slint'];

const NAMES = { gpui: 'GPUI', slint: 'Slint' };

const COPY = {
  en: {
    label: 'Framework',
    missing: (name) => `No ${name} version of this example yet.`,
    covered: (name) => `This example is GPUI-specific. The ${name} usage near the top of the page covers this component.`,
    status: (name) => `Showing ${name} code`,
  },
};

const COMPONENT_PAGE = /[\\/]component[\\/]([^\\/]+)\.md$/;

const text = (value) => ({ type: 'text', value });
const element = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });

function frameworkOf(pre) {
  return pre.properties?.dataLanguage === 'slint' ? 'slint' : 'gpui';
}

function isBlank(node) {
  return node.type === 'text' && !node.value.trim();
}

function classNames(node) {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/\s+/);
  return [];
}

function headingDepth(node) {
  return node.type === 'element' ? Number(/^h([1-6])$/.exec(node.tagName)?.[1] ?? 0) : 0;
}

function panelIsMissing(panel) {
  return (panel.children ?? []).some((child) => classNames(child).includes('framework-code__missing'));
}

// A sample that exists in only one framework, and a heading whose section is
// made entirely of those samples. The other framework drops both.
function markSingleFramework(tree) {
  const visitNode = (node) => {
    for (const child of node.children ?? []) visitNode(child);
    if (node.children) markSections(node.children);
  };
  visitNode(tree);
}

function markSections(children) {
  for (const node of children) {
    if (!classNames(node).includes('framework-code')) continue;
    const panels = (node.children ?? []).filter((child) => child.properties?.dataFrameworkPanel);
    const present = panels.filter((panel) => !panelIsMissing(panel));
    if (present.length === 1) node.properties.dataFrameworkOnly = present[0].properties.dataFrameworkPanel;
  }

  const headings = children
    .map((node, index) => ({ node, index, depth: headingDepth(node) }))
    .filter((item) => item.depth > 0)
    .sort((a, b) => b.depth - a.depth || b.index - a.index);

  for (const heading of headings) {
    let end = children.length;
    for (let index = heading.index + 1; index < children.length; index += 1) {
      const depth = headingDepth(children[index]);
      if (depth && depth <= heading.depth) {
        end = index;
        break;
      }
    }
    for (const framework of FRAMEWORKS) {
      if (!sectionBelongsTo(children, heading.index + 1, end, framework)) continue;
      heading.node.properties ??= {};
      heading.node.properties.dataFrameworkOnly = framework;
      break;
    }
  }
}

function sectionBelongsTo(children, start, end, framework) {
  let saw = false;
  for (let index = start; index < end; index += 1) {
    const node = children[index];
    if (isBlank(node)) continue;
    if (headingDepth(node)) {
      if (node.properties?.dataFrameworkOnly !== framework) return false;
      saw = true;
      continue;
    }
    const only = node.properties?.dataFrameworkOnly;
    if (only === framework) {
      saw = true;
      continue;
    }
    return false;
  }
  return saw;
}

function missing(copy, framework, covered) {
  const message = covered ? copy.covered : copy.missing;
  return element('div', { className: ['framework-code__missing'], dataPagefindIgnore: '' }, [
    element('span', { className: ['framework-code__missing-name'] }, [text(NAMES[framework])]),
    element('span', {}, [text(message(NAMES[framework]))]),
  ]);
}

function selector(copy, slug) {
  return element(
    'div',
    {
      className: ['framework-bar'],
      id: 'framework-bar',
      dataPagefindIgnore: '',
      ...Object.fromEntries(
        FRAMEWORKS.map((framework) => [
          `dataStatus${framework[0].toUpperCase()}${framework.slice(1)}`,
          copy.status(NAMES[framework]),
        ]),
      ),
    },
    [
      element('span', { className: ['framework-bar__label'], id: 'framework-bar-label' }, [text(copy.label)]),
      element('div', { className: ['framework-switch'], role: 'radiogroup', ariaLabelledBy: 'framework-bar-label' }, [
        element('span', { className: ['framework-switch__thumb'], ariaHidden: 'true' }),
        ...FRAMEWORKS.map((framework, index) =>
          element(
            'button',
            {
              type: 'button',
              className: ['framework-switch__option'],
              role: 'radio',
              dataFrameworkOption: framework,
              ariaChecked: index === 0 ? 'true' : 'false',
              tabIndex: index === 0 ? 0 : -1,
            },
            [logoElement(framework), text(NAMES[framework])],
          ),
        ),
      ]),
      element('div', { className: ['install-command-host'], dataInstallSlug: slug }),
      element('span', { className: ['sr-only'], role: 'status', dataFrameworkStatus: '' }),
    ],
  );
}

const FRAMEWORK_MARK = /framework:\s*(gpui|slint)/;

function isMdBlank(node) {
  return node.type === 'text' && !String(node.value ?? '').trim();
}

// `<!-- framework: gpui -->` before a heading keeps that section on one
// framework. The marker is removed; the heading and the blocks under it carry
// `data-framework-only`.
export function remarkFrameworkOnly() {
  return (tree) => {
    const visitNode = (node) => {
      const children = node.children;
      if (!children) return;
      for (let index = 0; index < children.length; index += 1) {
        const child = children[index];
        if (child.type !== 'html') {
          visitNode(child);
          continue;
        }
        const match = FRAMEWORK_MARK.exec(child.value ?? '');
        if (!match) continue;
        const framework = match[1];
        children.splice(index, 1);
        index -= 1;
        let heading = index + 1;
        while (heading < children.length && isMdBlank(children[heading])) heading += 1;
        const head = children[heading];
        if (!head || head.type !== 'heading') continue;
        let end = heading + 1;
        while (end < children.length) {
          const next = children[end];
          if (next.type === 'heading' && next.depth <= head.depth) break;
          end += 1;
        }
        for (let at = heading; at < end; at += 1) {
          const sectionNode = children[at];
          if (sectionNode.type === 'html' || isMdBlank(sectionNode)) continue;
          const data = (sectionNode.data ??= {});
          const props = (data.hProperties ??= {});
          props['data-framework-only'] = framework;
        }
      }
    };
    visitNode(tree);
  };
}

export function rehypeFrameworkCode() {
  return (tree, file) => {
    const path = String(file?.path ?? file?.history?.[0] ?? '');
    if (!COMPONENT_PAGE.test(path)) return;
    const copy = COPY.en;
    const slug = COMPONENT_PAGE.exec(path)?.[1];
    const covered = {
      gpui: false,
      slint: Boolean(slug && hasSlintExample(slug) && !hasSlintUsage(slug)),
    };

    const blocks = [];
    visit(tree, 'element', (node, _index, parent) => {
      if (node.tagName !== 'pre' || !parent) return;
      blocks.push({ node, parent });
      return SKIP;
    });
    if (blocks.length === 0) return;

    let open = null;
    for (const { node, parent } of blocks) {
      const framework = frameworkOf(node);
      const index = parent.children.indexOf(node);

      if (
        framework === 'slint' &&
        open?.parent === parent &&
        parent.children.slice(parent.children.indexOf(open.group) + 1, index).every(isBlank)
      ) {
        open.slint.children = open.filled ? [...open.slint.children, node] : [node];
        open.filled = true;
        parent.children.splice(index, 1);
        continue;
      }

      const panels = Object.fromEntries(
        FRAMEWORKS.map((name) => [
          name,
          element('div', { className: ['framework-code__panel'], dataFrameworkPanel: name }, [
            name === framework ? node : missing(copy, name, covered[name]),
          ]),
        ]),
      );
      const group = element(
        'div',
        { className: ['framework-code'], dataFrameworkCode: '' },
        FRAMEWORKS.map((name) => panels[name]),
      );
      parent.children[index] = group;
      open = framework === 'gpui' ? { group, parent, slint: panels.slint, filled: false } : null;
    }

    markSingleFramework(tree);

    const title = tree.children.findIndex((node) => node.type === 'element' && node.tagName === 'h1');
    if (title === -1) return;
    let at = title + 1;
    while (tree.children[at] && isBlank(tree.children[at])) at += 1;
    const lead = tree.children[at];
    const after = lead?.type === 'element' && lead.tagName === 'p' ? at + 1 : title + 1;
    tree.children.splice(after, 0, selector(copy, slug));
  };
}
