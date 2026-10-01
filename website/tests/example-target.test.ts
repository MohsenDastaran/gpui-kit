import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { findExampleHeading } from '../src/lib/example-target.js';
import {
  hasSlintExample,
  remarkSlintSource,
  usageBoxes,
  slintRoot,
} from '../src/lib/remark-slint-source.js';

function headingText(node) {
  return (node.children ?? [])
    .map((child) => (child.type === 'text' ? child.value : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function usageHeadings(slug) {
  const md = readFileSync(new URL(`../component/${slug}.md`, import.meta.url), 'utf8').replace(
    /^---[\s\S]*?---\n/,
    '',
  );
  const tree = unified().use(remarkParse).parse(md);
  remarkSlintSource()(tree, { path: `/component/${slug}.md` });
  let inUsage = false;
  const headings = [];
  visit(tree, (node) => {
    if (node.type !== 'heading') return;
    const text = headingText(node);
    if (node.depth === 2) inUsage = text === 'Usage';
    else if (node.depth < 2) inUsage = false;
    if (!inUsage || node.depth < 3) return;
    headings.push({
      text,
      titles: node.data?.hProperties?.['data-gallery-title'],
    });
  });
  return headings;
}

test('alert dialog Default scrolls to Default, not another example', () => {
  const headings = usageHeadings('alert-dialog');
  const match = findExampleHeading(headings, 'Default');
  assert.equal(match?.text, 'Default');
  assert.notEqual(match?.text, 'Custom footer');
  assert.match(match?.titles ?? '', /Default/);
});

test('every Slint gallery card lands on the section that shows it', () => {
  const ui = slintRoot(new URL('..', import.meta.url).pathname);
  const slugs = readdirSync(new URL('../component/', import.meta.url))
    .filter((name) => name.endsWith('.md') && name !== 'index.md')
    .map((name) => name.slice(0, -3));
  const misses = [];
  for (const slug of slugs) {
    if (!hasSlintExample(slug, new URL('..', import.meta.url).pathname)) continue;
    const headings = usageHeadings(slug);
    if (headings.length === 0) continue;
    for (const box of usageBoxes(ui, slug)) {
      const match = findExampleHeading(headings, box.title);
      if (!match) {
        misses.push(`${slug}: "${box.title}" has no section`);
        continue;
      }
      const tagged = String(match.titles ?? '')
        .split('|')
        .some((title) => title.trim().toLowerCase() === box.title.toLowerCase());
      const exact = match.text.toLowerCase() === box.title.toLowerCase();
      if (!tagged && !exact) misses.push(`${slug}: "${box.title}" -> "${match.text}"`);
    }
  }
  assert.deepEqual(misses, []);
});
