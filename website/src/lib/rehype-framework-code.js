import { SKIP, visit } from 'unist-util-visit';
import { hasSlintExample, hasSlintUsage } from './remark-slint-source.js';
import { logoElement } from './toggle-logos.js';

// Component pages carry one copy-paste block per framework. ```slint fences
// directly after a Rust fence become that example's Slint version; any other
// block is GPUI. A framework without a fence gets a visible placeholder, so the
// page shows what is missing instead of silently hiding the example.

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

    const title = tree.children.findIndex((node) => node.type === 'element' && node.tagName === 'h1');
    if (title === -1) return;
    let at = title + 1;
    while (tree.children[at] && isBlank(tree.children[at])) at += 1;
    const lead = tree.children[at];
    const after = lead?.type === 'element' && lead.tagName === 'p' ? at + 1 : title + 1;
    tree.children.splice(after, 0, selector(copy, slug));
  };
}
