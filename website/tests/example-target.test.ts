import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { findExampleHeading, exampleWords, galleryTitlesOf, gallerySourceTitle } from '../src/lib/example-target.js';
import {
  expectedGalleryTitles,
  gpuiSectionTitles,
  hasSlintExample,
  remarkSlintSource,
  usageBoxes,
  slintRoot,
} from '../src/lib/remark-slint-source.js';

const FIRST_BATCH = [
  'accordion',
  'alert-dialog',
  'alert',
  'attachment',
  'avatar',
  'badge',
  'bubble',
  'button',
  'calendar',
  'card',
  'carousel',
  'chart',
];

function headingText(node) {
  return (node.children ?? [])
    .map((child) => (child.type === 'text' ? child.value : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function described(node) {
  return {
    text: headingText(node),
    titles: node.data?.hProperties?.['data-gallery-title'],
  };
}

const WEBSITE = new URL('..', import.meta.url).pathname;

function headingsFor(slug) {
  const md = readFileSync(new URL(`../component/${slug}.md`, import.meta.url), 'utf8').replace(
    /^---[\s\S]*?---\n/,
    '',
  );
  const tree = unified().use(remarkParse).parse(md);
  remarkSlintSource({ root: WEBSITE })(tree, { path: `/component/${slug}.md` });
  let afterApi = false;
  const headings = [];
  visit(tree, (node) => {
    if (afterApi || node.type !== 'heading') return;
    if (node.depth < 2 || node.depth > 4) return;
    const text = headingText(node);
    if (/^api reference\b/i.test(text)) {
      afterApi = true;
      return;
    }
    if (/^import$/i.test(text)) return;
    headings.push(described(node));
  });
  return headings;
}

test('attachment source buttons scroll to the documented section', () => {
  const headings = headingsFor('attachment');
  const ui = slintRoot(WEBSITE);
  const misses = usageBoxes(ui, 'attachment').flatMap((box) => {
    const match = findExampleHeading(headings, box.title);
    return match ? [] : [`${box.title}`];
  });
  assert.deepEqual(misses, []);
  assert.equal(findExampleHeading(headings, 'File metadata')?.text, 'Anatomy and basic usage');
  assert.equal(findExampleHeading(headings, 'Composer')?.text, 'Anatomy and basic usage');
  assert.equal(findExampleHeading(headings, 'Whole-card click')?.text, 'Whole-card click');
  assert.equal(findExampleHeading(headings, 'Upload states')?.text, 'Lifecycle states');
  assert.equal(findExampleHeading(headings, 'Custom style')?.text, 'Custom styling and theme tokens');
});

test('alert dialog Default scrolls to Default, not another example', () => {
  const headings = headingsFor('alert-dialog');
  const match = findExampleHeading(headings, 'Default');
  assert.equal(match?.text, 'Default');
  assert.notEqual(match?.text, 'Custom footer');
  assert.match(match?.titles ?? '', /Default/);
});

test('chart gallery cards scroll to the chart-type heading', () => {
  const headings = headingsFor('chart');
  assert.equal(findExampleHeading(headings, 'LineChart')?.text, 'LineChart');
  assert.equal(findExampleHeading(headings, 'AreaChart')?.text, 'AreaChart');
  assert.equal(findExampleHeading(headings, 'BarChart')?.text, 'BarChart');
  assert.equal(findExampleHeading(headings, 'PieChart')?.text, 'PieChart');
  assert.equal(findExampleHeading(headings, 'RadarChart')?.text, 'RadarChart');
  assert.equal(findExampleHeading(headings, 'CandlestickChart')?.text, 'CandlestickChart');
  assert.equal(findExampleHeading(headings, 'SankeyChart')?.text, 'SankeyChart');
});

test('every first-batch gallery card lands on the section that shows it', () => {
  const website = WEBSITE;
  const ui = slintRoot(website);
  const misses = [];
  for (const slug of FIRST_BATCH) {
    const headings = headingsFor(slug);
    for (const title of expectedGalleryTitles(ui, website, slug)) {
      const match = findExampleHeading(headings, title);
      if (!match) {
        misses.push(`${slug}: "${title}" has no section`);
        continue;
      }
      const tagged = galleryTitlesOf(match.titles).some(
        (item) => exampleWords(item) === exampleWords(title),
      );
      const exact = exampleWords(match.text) === exampleWords(title);
      if (!tagged && !exact) misses.push(`${slug}: "${title}" -> "${match.text}"`);
    }
  }
  assert.deepEqual(misses, []);
});

test('every Slint gallery card lands on the section that shows it', () => {
  const ui = slintRoot(WEBSITE);
  const slugs = readdirSync(new URL('../component/', import.meta.url))
    .filter((name) => name.endsWith('.md') && name !== 'index.md')
    .map((name) => name.slice(0, -3));
  const misses = [];
  for (const slug of slugs) {
    if (!hasSlintExample(slug, WEBSITE)) continue;
    const headings = headingsFor(slug);
    if (headings.length === 0) continue;
    for (const box of usageBoxes(ui, slug)) {
      const match = findExampleHeading(headings, box.title);
      if (!FIRST_BATCH.includes(slug)) continue;
      if (!match) {
        misses.push(`${slug}: "${box.title}" has no section`);
        continue;
      }
      const tagged = galleryTitlesOf(match.titles).some(
        (title) => exampleWords(title) === exampleWords(box.title),
      );
      const exact = exampleWords(match.text) === exampleWords(box.title);
      if (!tagged && !exact) misses.push(`${slug}: "${box.title}" -> "${match.text}"`);
    }
  }
  assert.deepEqual(misses, []);
});

test('first-batch GPUI section titles are tagged', () => {
  const website = WEBSITE;
  const misses = [];
  for (const slug of FIRST_BATCH) {
    const headings = headingsFor(slug);
    for (const title of gpuiSectionTitles(website, slug)) {
      const match = findExampleHeading(headings, title);
      if (!match) misses.push(`${slug}: "${title}" has no section`);
    }
  }
  assert.deepEqual(misses, []);
});

test('chart source titles pair the type with the subtitle', () => {
  assert.equal(gallerySourceTitle('LineChart', '2025', 'Natural cubic spline', 'Curved'), 'LineChart — Curved');
  assert.equal(gallerySourceTitle('LineChart', '2025', 'Straight segments', 'Linear'), 'LineChart — Linear');
  assert.notEqual(
    gallerySourceTitle('LineChart', '2025', 'Natural cubic spline', 'Curved'),
    gallerySourceTitle('LineChart', '2025', 'Straight segments', 'Linear'),
  );
});
