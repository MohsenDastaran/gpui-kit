import { SKIP, visit } from 'unist-util-visit';

// Component pages carry one copy-paste block per framework. A ```slint fence
// directly after a Rust fence becomes that example's Slint version; any other
// block is GPUI. A framework without a fence gets a visible placeholder, so the
// page shows what is missing instead of silently hiding the example.

export const FRAMEWORKS = ['gpui', 'slint'];

const NAMES = { gpui: 'GPUI', slint: 'Slint' };

const COPY = {
  en: {
    label: 'Framework',
    missing: (name) => `No ${name} version of this example yet.`,
    status: (name) => `Showing ${name} code`,
  },
  'zh-CN': {
    label: '框架',
    missing: (name) => `此示例暂无 ${name} 版本。`,
    status: (name) => `正在显示 ${name} 代码`,
  },
};

const COMPONENT_PAGE = /[\\/]component[\\/].+\.md$/;

const text = (value) => ({ type: 'text', value });
const element = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });

function frameworkOf(pre) {
  return pre.properties?.dataLanguage === 'slint' ? 'slint' : 'gpui';
}

function isBlank(node) {
  return node.type === 'text' && !node.value.trim();
}

function missing(copy, framework) {
  return element('div', { className: ['framework-code__missing'], dataPagefindIgnore: '' }, [
    element('span', { className: ['framework-code__missing-name'] }, [text(NAMES[framework])]),
    element('span', {}, [text(copy.missing(NAMES[framework]))]),
  ]);
}

function selector(copy) {
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
            [text(NAMES[framework])],
          ),
        ),
      ]),
      element('span', { className: ['sr-only'], role: 'status', dataFrameworkStatus: '' }),
    ],
  );
}

export function rehypeFrameworkCode() {
  return (tree, file) => {
    const path = String(file?.path ?? file?.history?.[0] ?? '');
    if (!COMPONENT_PAGE.test(path)) return;
    const copy = /[\\/]zh-CN[\\/]/.test(path) ? COPY['zh-CN'] : COPY.en;

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
        open.slint.children = [node];
        parent.children.splice(index, 1);
        open = null;
        continue;
      }

      const panels = Object.fromEntries(
        FRAMEWORKS.map((name) => [
          name,
          element('div', { className: ['framework-code__panel'], dataFrameworkPanel: name }, [
            name === framework ? node : missing(copy, name),
          ]),
        ]),
      );
      const group = element(
        'div',
        { className: ['framework-code'], dataFrameworkCode: '' },
        FRAMEWORKS.map((name) => panels[name]),
      );
      parent.children[index] = group;
      open = framework === 'gpui' ? { group, parent, slint: panels.slint } : null;
    }

    const title = tree.children.findIndex((node) => node.type === 'element' && node.tagName === 'h1');
    if (title === -1) return;
    let at = title + 1;
    while (tree.children[at] && isBlank(tree.children[at])) at += 1;
    const lead = tree.children[at];
    const after = lead?.type === 'element' && lead.tagName === 'p' ? at + 1 : title + 1;
    tree.children.splice(after, 0, selector(copy));
  };
}
