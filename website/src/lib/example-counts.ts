import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Counts the examples the gallery window actually paints, one per framework.
// GPUI stories mark each example with `section(...)`. Slint examples mark each
// one with a GroupBox. A window that is a single example has neither.

const ROOT = process.cwd();
const STORIES = join(ROOT, '../crates/story/src/stories');
const SLINT_EXAMPLES = join(ROOT, '../crates/slint-component/ui/examples');
const GALLERY = join(ROOT, '../crates/story/src/gallery.rs');
const SANKEY = join(ROOT, '../crates/story/src/fixtures/tsla-income-statement.json');

/** Story title when it is not the PascalCase of the page slug. Mirrors the example window. */
const STORY_TITLES: Record<string, string> = {
  'alert-dialog': 'AlertDialog',
  'color-picker': 'ColorPicker',
  'data-table': 'DataTable',
  'date-picker': 'DatePicker',
  'description-list': 'DescriptionList',
  dropdown_button: 'DropdownButton',
  'focus-trap': 'Dialog',
  'group-box': 'GroupBox',
  'hover-card': 'HoverCard',
  'input-group': 'Input Group',
  'native-menu': 'NativeMenu',
  notification: 'Notification',
  'number-input': 'NumberInput',
  'otp-input': 'OtpInput',
  plot: 'Chart',
  scrollable: 'Scrollbar',
  'status-bar': 'StatusBar',
  'text-view': 'Editor',
  'title-bar': 'Introduction',
  'virtual-list': 'VirtualList',
};

export interface GalleryCounts {
  gpui?: number;
  slint?: number;
}

function titleCase(value: string): string {
  return value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function stemFromTitle(title: string): string {
  return title
    .replace(/[\s-]+/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function wasmStoryStems(): Set<string> {
  let source = '';
  try {
    source = readFileSync(GALLERY, 'utf8');
  } catch {
    return new Set();
  }
  source = source.replace(
    /#\[cfg\(not\(target_family = "wasm"\)\)\]\s*StoryContainer::panel::<\w+>\([^)]*\),?/g,
    '',
  );
  const stems = new Set<string>();
  for (const match of source.matchAll(/StoryContainer::panel::<(\w+)Story>/g)) {
    stems.add(stemFromTitle(match[1]));
  }
  return stems;
}

const wasmStories = wasmStoryStems();

function readStory(stem: string): string {
  const parts: string[] = [];
  const file = join(STORIES, `${stem}_story.rs`);
  const dir = join(STORIES, `${stem}_story`);
  if (existsSync(file)) parts.push(readFileSync(file, 'utf8'));
  if (existsSync(dir) && statSync(dir).isDirectory()) {
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.rs')) parts.push(readFileSync(join(dir, name), 'utf8'));
    }
  }
  return parts.join('\n');
}

function countSections(source: string): number {
  return stripComments(source).match(/(^|[^.\w])section\s*\(/g)?.length ?? 0;
}

function countChartCards(source: string): number {
  const start = source.search(/fn sections\s*\(/);
  if (start < 0) return 0;
  const end = source.indexOf('\n}', start);
  const body = source.slice(start, end < 0 ? undefined : end);
  let sankey = 0;
  if (/0\s*\.\.\s*sankey_count/.test(body)) {
    try {
      const fixture = JSON.parse(readFileSync(SANKEY, 'utf8')) as { list?: unknown[] };
      sankey = Array.isArray(fixture.list) ? fixture.list.length : 0;
    } catch {
      sankey = 0;
    }
  }
  const withoutSankey = body.replace(/\(0\s*\.\.\s*sankey_count\)\.map\([^)]*\)/g, '');
  let cards = 0;
  for (const array of withoutSankey.matchAll(/\[([\s\S]*?)\]/g)) {
    const names = array[1].match(/\b[A-Z][A-Za-z0-9]*\b/g) ?? [];
    cards += names.filter((name) => name !== 'ChartSection').length;
  }
  return cards + sankey;
}

function countSlint(slug: string): number {
  const path = join(SLINT_EXAMPLES, `${slug}.slint`);
  if (!existsSync(path)) return 0;
  const source = stripComments(readFileSync(path, 'utf8'));
  const boxes = source.match(/\bGroupBox\s*\{/g)?.length ?? 0;
  if (boxes > 0) return boxes;
  const cards = source.match(/\bChartCard\s*\{/g)?.length ?? 0;
  if (cards > 0) return cards;
  const sections = source.match(/\bExampleSection\s*\{/g)?.length ?? 0;
  if (sections > 0) return sections;
  return /\bexport\s+component\b/.test(source) ? 1 : 0;
}

function countGpui(component: string): number {
  const title = STORY_TITLES[component] ?? titleCase(component);
  const stem = title === 'Introduction' ? 'welcome' : stemFromTitle(title);
  if (!wasmStories.has(stem)) return 0;
  const source = readStory(stem);
  if (!source) return 0;
  const count = stem === 'chart' ? countChartCards(source) : countSections(source);
  return count > 0 ? count : 1;
}

/**
 * Examples painted in the gallery window for this component page.
 * `example` is the page's frontmatter override; `false` means the page has no window.
 */
export function galleryCounts(
  slug: string,
  example?: string | false,
): GalleryCounts | undefined {
  if (example === false) return undefined;
  const gpui = countGpui(example ?? slug);
  const slint = countSlint(slug);
  if (!gpui && !slint) return undefined;
  return {
    ...(gpui > 0 ? { gpui } : {}),
    ...(slint > 0 ? { slint } : {}),
  };
}
