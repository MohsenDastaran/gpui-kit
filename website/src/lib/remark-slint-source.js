import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { visit } from 'unist-util-visit';
import { gallerySourceTitle } from './example-target.js';

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

function extractBlocks(src, name) {
  const boxes = [];
  const pattern = new RegExp(`\\b${name}\\s*\\{`, 'g');
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

function extractGroupBoxes(src) {
  return extractBlocks(src, 'GroupBox');
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
  src = src.replace(/^\s*source-title:\s*"[^"]*";\s*/m, '');
  src = src.replace(/^\s*variant:\s*GroupBoxVariant\.\w+;\s*/m, '');
  src = src.replace(/^\s*subtitle:\s*"[^"]*";\s*/m, '');
  src = src.replace(/^\s*period:\s*"[^"]*";\s*/m, '');
  src = src.replace(/^\s*headline:\s*"[^"]*";\s*/m, '');
  src = src.replace(/^\s*note:\s*"[^"]*";\s*/m, '');
  src = src.replace(/^\s*body:\s*"[^"]*";\s*/m, '');

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

function headingText(node) {
  return (node.children ?? [])
    .map((child) => (child.type === 'text' ? child.value : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameTitle(heading, title) {
  return heading.localeCompare(title, undefined, { sensitivity: 'accent' }) === 0;
}

export function usageBoxes(ui, slug) {
  const path = join(ui, 'examples', `${slug}.slint`);
  if (!existsSync(path)) return [];
  const src = readFileSync(path, 'utf8');
  const group = extractGroupBoxes(src)
    .map((box) => titledBox(box.inner, stripGalleryLayout))
    .filter(Boolean);
  if (group.length > 0) return group;
  const charts = extractBlocks(src, 'ChartCard')
    .map((box) => chartBox(box.inner))
    .filter(Boolean);
  if (charts.length > 0) return charts;
  return extractBlocks(src, 'ExampleSection')
    .map((box) => titledBox(box.inner, stripGalleryLayout))
    .filter(Boolean);
}

function propertyString(inner, name) {
  return inner.match(new RegExp(`^\\s*${name}:\\s*"([^"]+)"\\s*;`, 'm'))?.[1] ?? '';
}

function titledBox(inner, strip) {
  const title = propertyString(inner, 'title');
  if (!title) return null;
  const source = propertyString(inner, 'source-title') || title;
  const value = prettyPrintSlint(strip(inner));
  return value ? { title: source, value } : null;
}

function chartBox(inner) {
  const title = propertyString(inner, 'title');
  if (!title) return null;
  const source =
    propertyString(inner, 'source-title') ||
    gallerySourceTitle(
      title,
      propertyString(inner, 'period'),
      propertyString(inner, 'note'),
      propertyString(inner, 'subtitle'),
    );
  const value = prettyPrintSlint(stripGalleryLayout(inner));
  return value ? { title: source, value } : null;
}

function usageSnippets(ui, slug) {
  return usageBoxes(ui, slug).map((box) => box.value);
}

// Headings that demonstrate a behavior the gallery already runs under another
// GroupBox title. The sample reuses that box instead of a second copy.
const ALIASES = {
  accordion: {
    'With Borders': 'Single',
    'Handle Toggle Events': 'Single',
    'Nested Accordions': 'Icons and custom content',
  },
  alert: {
    'Alert with Title': 'Default',
    'Success Notification': 'Variants',
    'System Status Banner': 'Banner',
    'Form Validation Errors': 'Variants',
  },
  'alert-dialog': {
    'Prevent Dialog from Closing': 'Prevent close',
    'Session Timeout': 'Custom footer',
    'Update Available': 'Custom content',
  },
  // Attachment documents each behavior as its own section, not under Usage.
  attachment: {
    'Anatomy and basic usage': 'File metadata',
    'Media and image previews': 'Thumbnail',
    'Lifecycle states': 'Upload states',
    'Status inheritance and overrides': 'Status inheritance',
    'Sizes and axes': 'Sizes',
    Groups: 'Group',
    'Custom styling and theme tokens': 'Custom style',
  },
  avatar: {
    'Team Display': 'Group',
    'Anonymous User': 'Fallback',
  },
  badge: {
    'Count Formatting': 'Icon',
    'Notification Indicators': 'Icon',
  },
  button: {
    'Icon Types': 'Icons and states',
    'Spinner Icon': 'Icons and states',
    'Loading State with Icons': 'Icons and states',
    'Button States': 'Icons and states',
    Sizeable: 'Sizes',
  },
  calendar: {
    'Multiple Months Display': 'Two columns',
  },
  checkbox: {
    'Disabled State': 'Basic',
    'Checkbox List': 'Basic',
  },
  clipboard: {
    'Basic Clipboard': 'Copy',
  },
  collapsible: {
    'Animated reveal': 'Details',
  },
  'data-table': {
    'Sorting Implementation': 'Invoices',
    'Selection Modes': 'Invoices',
  },
  'date-picker': {
    'With Initial Date': 'Date',
  },
  'hover-card': {
    'User Profile Preview': 'Hover',
  },
  icon: {
    'Basic Icon': 'Icons',
    'Icon with Custom Color': 'Icons',
    'Animated Loading Icon': 'Icons',
  },
  input: {
    'With Default Value': 'Basic',
    'Cleanable Input': 'Prefix, suffix and clear button',
    'Search Input': 'Prefix, suffix and clear button',
    'Currency Input': 'Prefix, suffix and clear button',
    'Disabled Input': 'States',
    'Read-only Input': 'States',
    'Input Validation': 'States',
    'Clean on ESC': 'Password',
    'Input Masking': 'Password',
  },
  kbd: {
    'Basic Keyboard Shortcut': 'Shortcuts',
    'Multiple Modifiers': 'Shortcuts',
  },
  label: {
    'Basic Label': 'Form labels',
  },
  'number-input': {
    'Basic Number Input': 'Quantity',
    'With Min/Max/Step': 'Quantity',
    'With Prefix and Suffix': 'Quantity',
    'Floating Point Input': 'Quantity',
  },
  pagination: {
    'Basic Pagination': 'Pages',
    'Large Dataset Pagination': 'Pages',
  },
  popover: {
    'Basic Popover': 'Click',
  },
  radio: {
    'Disabled State': 'Standalone',
  },
  'otp-input': {
    'Basic OTP Input': 'Verification',
    'PIN Entry': 'Different Length Codes',
  },
  rating: {
    'Controlled Rating': 'Rate this',
    'Click Behavior': 'Rate this',
    'Read-only Display': 'Disabled State',
  },
  select: {
    Placeholder: 'Framework',
  },
  skeleton: {
    'Basic Skeleton': 'Loading',
    'Text Line Skeleton': 'Loading',
    'Rectangle Skeleton': 'Loading',
  },
  slider: {
    'Basic Slider': 'Volume',
  },
  spinner: {
    'Loading States': 'Colors',
    'Size Variations': 'Sizes',
    'In UI Components': 'In context',
  },
  stepper: {
    'Basic Stepper': 'With icons',
    'Disabled State': 'Sizes and disabled',
  },
  switch: {
    'With Label': 'Basic',
    'Disabled State': 'Basic',
  },
  table: {
    'Text Alignment': 'Column widths',
    'Without Border (via Styled)': 'Striped, bordered and sizes',
  },
  tag: {
    'Tag Variants': 'Tags',
    'Outline Tags': 'Tags',
  },
  tooltip: {
    'Basic Tooltip with Text': 'Hover the button',
  },
};

// Gallery cards that share a documented section. The card scrolls there; the
// section's own sample is already the one inserted beside its code.
const SHARED = {
  accordion: {
    Default: 'Single',
    'Custom style': 'Icons and custom content',
  },
  'alert-dialog': {
    'Imperative API': 'Delete file',
    Keyboard: 'Prevent close',
    'Confirm mode': 'Confirm',
  },
  attachment: {
    Composer: 'Anatomy and basic usage',
    Lifecycle: 'Lifecycle states',
    'Preview card': 'Media and image previews',
    Sizes: 'Sizes and axes',
    'Custom style': 'Custom styling and theme tokens',
    'Optional slots': 'Anatomy and basic usage',
    'Image overlays': 'Media and image previews',
    Orientation: 'Sizes and axes',
    'Long filenames': 'Sizes and axes',
    'Attachment trigger': 'Content and actions',
  },
  badge: {
    Nested: 'Complex Nested Badges',
  },
  bubble: {
    Reactions: 'Reactions and interactive content',
    Group: 'Groups',
    'Links and buttons': 'Reactions and interactive content',
    'Collapsible content': 'Rich content and long messages',
    Tooltip: 'Reactions and interactive content',
    Popover: 'Reactions and interactive content',
    'Rich content': 'Rich content and long messages',
    'Custom style': 'Custom styling and theme tokens',
  },
  button: {
    Icons: 'Icons and states',
    Progress: 'Icons and states',
    Dropdown: 'Icon only',
    'Horizontal group': 'Button group',
    'Vertical group': 'Button group',
    'Selection group': 'Toggle Button Group',
    'Icon-only': 'Icon only',
    'Custom size': 'Sizeable',
    'Custom color': 'Custom Variant',
  },
  calendar: {
    'Single month': 'Calendar',
    'Multiple months': 'Two columns',
    'Disabled dates': 'Disabled Weekends',
  },
  carousel: {
    Basic: 'Usage',
    Vertical: 'Orientation',
    Controlled: 'Controlled selection',
  },
  chart: {
    LineChart: 'LineChart',
    AreaChart: 'AreaChart',
    BarChart: 'BarChart',
    PieChart: 'PieChart',
    RadarChart: 'RadarChart',
    CandlestickChart: 'CandlestickChart',
    SankeyChart: 'SankeyChart',
  },
};

// A titled GroupBox is attached to every Usage sample with that title, or with
// a heading aliased to it. One gallery sample can fill several doc blocks that
// show the same behavior.
export function expectedGalleryTitles(ui, root, slug) {
  const titles = new Set(usageBoxes(ui, slug).map((box) => box.title));
  for (const title of gpuiSectionTitles(root, slug)) titles.add(title);
  for (const title of Object.keys(SHARED[slug] ?? {})) titles.add(title);
  return [...titles];
}

export function assignSnippets(samples, boxes, aliases = {}) {
  const assigned = new Map();
  samples.forEach((sample, index) => {
    const want = aliases[sample.heading] ?? sample.heading;
    const box = boxes.findIndex((item) => sameTitle(want, item.title));
    if (box < 0) return;
    assigned.set(index, boxes[box].value);
  });
  return assigned;
}

function importBlock(ui, slug, copy) {
  const source = readFileSync(join(ui, `${slug}.slint`), 'utf8');
  const names = [...source.matchAll(EXPORTS)].map(([, name]) => name);
  return [`// ${copy.installed}`, `import { ${names.join(', ')} } from "${slug}.slint";`].join('\n');
}

const code = (value) => ({ type: 'code', lang: 'slint', meta: null, value });

// The gallery posts the GroupBox title. The heading that received that sample
// keeps the title, so the page can scroll to the sample instead of to whichever
// code block happens to share the card's index.
function tagExample(node, title) {
  const data = (node.data ??= {});
  const props = (data.hProperties ??= {});
  const key = 'data-gallery-title';
  const current = String(props[key] ?? '')
    .split('|')
    .filter(Boolean);
  if (current.some((item) => sameTitle(item, title))) return;
  current.push(title);
  props[key] = current.join('|');
}

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

function sectionForTitle(sections, slug, title) {
  const mapped = SHARED[slug]?.[title];
  const want = mapped ?? title;
  return sections.find((item) => sameTitle(item.heading, want));
}

function insertPoint(section) {
  const children = section.parent.children;
  const start = children.indexOf(section.node);
  let rust = -1;
  let end = start + 1;
  while (end < children.length) {
    const child = children[end];
    if (child.type === 'heading' && child.depth <= section.depth) break;
    if (child.type === 'code' && child.lang !== 'slint') rust = end;
    end += 1;
  }
  return rust >= 0 ? rust + 1 : end;
}

function sectionHasSlint(section) {
  const children = section.parent.children;
  const start = children.indexOf(section.node);
  for (let i = start + 1; i < children.length; i += 1) {
    const child = children[i];
    if (child.type === 'heading' && child.depth <= section.depth) break;
    if (child.type === 'code' && child.lang === 'slint') return true;
  }
  return false;
}

export function gpuiSectionTitles(root, slug) {
  const stories = resolve(root, '..', 'crates', 'story', 'src', 'stories');
  const stem = slug.replaceAll('-', '_');
  const files = [];
  const file = join(stories, `${stem}_story.rs`);
  const dir = join(stories, `${stem}_story`);
  if (existsSync(file)) files.push(file);
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.rs')) files.push(join(dir, name));
    }
  }
  const titles = [];
  for (const path of files) {
    const src = readFileSync(path, 'utf8');
    for (const match of src.matchAll(/(?:^|[^.\w])section\s*\(\s*"([^"]+)"/g)) {
      titles.push(match[1]);
    }
    if (slug === 'chart') {
      for (const match of src.matchAll(/Card::new\s*\(\s*"([^"]+)"/g)) {
        titles.push(match[1]);
      }
    }
  }
  return titles;
}

function dedent(text) {
  const lines = String(text ?? '').replace(/^\n/, '').trimEnd().split('\n');
  const widths = lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length);
  const cut = widths.length ? Math.min(...widths) : 0;
  return lines.map((line) => (line.trim() ? line.slice(cut) : '')).join('\n').trim();
}

function balancedParen(src, openAt) {
  let depth = 0;
  for (let i = openAt; i < src.length; i += 1) {
    const char = src[i];
    // Lifetimes (`'static`) are not strings. Only double quotes wrap text.
    if (char === '"') {
      i = skipString(src, i) - 1;
      continue;
    }
    if (char === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function chartExpression(src, from) {
  const at = src.indexOf('.chart(', from);
  if (at < 0 || at - from > 4000) return '';
  const open = src.indexOf('(', at);
  const close = balancedParen(src, open);
  if (close < 0) return '';
  return dedent(src.slice(open + 1, close));
}

function extractGpuiCharts(root) {
  const path = join(resolve(root, '..', 'crates', 'story', 'src', 'stories', 'chart_story'), 'chart_story.rs');
  if (!existsSync(path)) return [];
  const src = readFileSync(path, 'utf8');
  const samples = [];
  for (const match of src.matchAll(/\.subtitle\(\s*"([^"]+)"\s*\)/g)) {
    const before = src.slice(Math.max(0, match.index - 600), match.index);
    const types = [...before.matchAll(/Card::new\(\s*"([^"]+)"/g)];
    const title = types.at(-1)?.[1];
    const rust = chartExpression(src, match.index);
    if (title && rust) samples.push({ title, subtitle: match[1], rust });
  }
  const candleAt = src.indexOf('fn candlestick(');
  const candle = candleAt < 0 ? '' : chartExpression(src, candleAt);
  if (candle) {
    for (const match of src.matchAll(/candlestick\(\s*data,\s*"([^"]+)"/g)) {
      samples.push({ title: 'CandlestickChart', subtitle: match[1], rust: candle });
    }
  }
  const sankeyAt = src.indexOf('let chart = SankeyChart::new');
  const sankeyEnd = sankeyAt < 0 ? -1 : src.indexOf('let revenue =', sankeyAt);
  const sankey = sankeyAt < 0 || sankeyEnd < 0 ? '' : dedent(src.slice(sankeyAt, sankeyEnd));
  if (sankey) {
    const fixture = join(resolve(root, '..', 'crates', 'story', 'src', 'fixtures'), 'tsla-income-statement.json');
    let periods = ['FY 2025', 'FY 2024'];
    if (existsSync(fixture)) {
      try {
        const list = JSON.parse(readFileSync(fixture, 'utf8')).list;
        if (Array.isArray(list)) {
          periods = list.map((item) => item.period).filter(Boolean);
        }
      } catch {
        periods = ['FY 2025', 'FY 2024'];
      }
    }
    for (const subtitle of periods) samples.push({ title: 'SankeyChart', subtitle, rust: sankey });
  }
  return samples;
}

function insertRunningCharts(sections, ui, root, tagExample) {
  const gpui = extractGpuiCharts(root);
  const byKey = new Map(gpui.map((item) => [`${item.title} — ${item.subtitle}`, item]));
  const seen = new Set();
  const cards = [];
  for (const box of usageBoxes(ui, 'chart')) {
    seen.add(box.title);
    cards.push({ title: box.title, slint: box.value, rust: byKey.get(box.title)?.rust ?? '' });
  }
  for (const item of gpui) {
    const title = `${item.title} — ${item.subtitle}`;
    if (seen.has(title)) continue;
    cards.push({ title, slint: '', rust: item.rust });
  }
  const groups = new Map();
  for (const card of cards) {
    const type = card.title.split(' — ')[0];
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(card);
  }
  const heading = (value) => ({ type: 'heading', depth: 4, children: [{ type: 'text', value }] });
  const rust = (value) => ({ type: 'code', lang: 'rust', meta: null, value });
  for (const [type, group] of groups) {
    const section = sections.find((item) => item.depth === 3 && sameTitle(item.heading, type));
    if (!section) continue;
    const children = section.parent.children;
    let at = children.indexOf(section.node) + 1;
    while (at < children.length && children[at].type !== 'heading') at += 1;
    const nodes = [];
    for (const card of group) {
      const node = heading(card.title);
      nodes.push(node);
      if (card.rust) nodes.push(rust(card.rust));
      if (card.slint) nodes.push(code(card.slint));
      tagExample(node, card.title);
    }
    children.splice(at, 0, ...nodes);
  }
}

export function remarkSlintSource({ root = process.cwd() } = {}) {
  const ui = slintRoot(root);

  return (tree, file) => {
    const path = String(file?.path ?? file?.history?.[0] ?? '');
    const slug = COMPONENT_PAGE.exec(path)?.[1];
    if (!slug || !hasSlintExample(slug, root)) return;
    const copy = COPY.en;

    let heading = '';
    let headingNode = null;
    let inUsage = false;
    const rust = [];
    const usageHeadings = [];
    const sections = [];
    visit(tree, (node, index, parent) => {
      if (node.type === 'heading') {
        heading = headingText(node);
        headingNode = node;
        if (node.depth === 2) inUsage = heading === 'Usage';
        else if (node.depth < 2) inUsage = false;
        if (parent && index !== undefined && node.depth >= 2 && node.depth <= 4) {
          sections.push({ node, parent, heading, depth: node.depth });
        }
        if (inUsage && node.depth >= 3 && parent && index !== undefined) {
          usageHeadings.push({ node, parent, heading, depth: node.depth });
        }
      }
      if (node.type === 'code' && node.lang !== 'slint' && parent && index !== undefined) {
        rust.push({ node, parent, heading, headingNode });
      }
    });
    const [imports, usage] = rust;
    if (!imports || !usage) return;

    const after = ({ node, parent }, ...nodes) =>
      parent.children.splice(parent.children.indexOf(node) + 1, 0, ...nodes);
    after(imports, code(importBlock(ui, slug, copy)));

    const tagGalleryTitles = () => {
      for (const [title, heading] of Object.entries(SHARED[slug] ?? {})) {
        const section = sections.find((item) => sameTitle(item.heading, heading));
        if (section) tagExample(section.node, title);
      }
      for (const title of gpuiSectionTitles(root, slug)) {
        const section = sectionForTitle(sections, slug, title);
        if (section) tagExample(section.node, title);
      }
    };

    if (slug === 'chart') {
      insertRunningCharts(sections, ui, root, tagExample);
      tagGalleryTitles();
      return;
    }

    const boxes = usageBoxes(ui, slug);
    if (boxes.length > 0) {
      const aliases = ALIASES[slug] ?? {};
      const assigned = assignSnippets(rust.slice(1), boxes, aliases);
      const used = new Set();
      assigned.forEach((value, index) => {
        const sample = rust[index + 1];
        after(sample, code(value));
        const title = aliases[sample.heading] ?? sample.heading;
        const box = boxes.findIndex((item) => sameTitle(title, item.title));
        if (box >= 0) used.add(box);
        if (sample.headingNode) tagExample(sample.headingNode, title);
      });
      const inserts = [];
      const claimed = new Set();
      boxes.forEach((box, index) => {
        if (used.has(index)) return;
        const section =
          usageHeadings.find((item) => sameTitle(item.heading, box.title)) ??
          sectionForTitle(sections, slug, box.title);
        if (!section) return;
        if (sectionHasSlint(section) || claimed.has(section.node)) {
          tagExample(section.node, box.title);
          return;
        }
        claimed.add(section.node);
        const at = insertPoint(section);
        inserts.push({ parent: section.parent, at, value: box.value, node: section.node, title: box.title });
      });
      inserts.sort((a, b) => b.at - a.at);
      for (const item of inserts) {
        item.parent.children.splice(item.at, 0, code(item.value));
        tagExample(item.node, item.title);
      }
      tagGalleryTitles();
      return;
    }

    const example = readFileSync(join(ui, 'examples', `${slug}.slint`), 'utf8')
      .replaceAll('from "../', 'from "')
      .trimEnd();
    after(usage, code(prettyPrintSlint(example)));
    tagGalleryTitles();
  };
}
