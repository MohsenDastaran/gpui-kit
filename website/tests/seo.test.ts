import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const dist = new URL('../dist/', import.meta.url);
const read = (path) => readFileSync(new URL(path, dist), 'utf8');

function htmlFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? htmlFiles(path) : path.endsWith('.html') ? [path] : [];
  });
}

function tag(html, pattern) {
  return html.match(pattern)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
}

test('primary landing pages contain server-rendered headings and copy', () => {
  for (const path of ['index.html', 'apps/index.html', 'skills/index.html', 'contributors/index.html']) {
    const html = read(path);
    assert.match(html, /<h1[\s>]/, `${path} must contain an H1 before JavaScript runs`);
    assert.ok(tag(html, /<main[^>]*>([\s\S]*?)<\/main>/).length > 100, `${path} must contain meaningful main content`);
  }
});

test('indexable pages have canonical and English alternates', () => {
  for (const path of ['index.html', 'docs/index.html', 'apps/index.html']) {
    const html = read(path);
    assert.match(html, /<link rel="canonical" href="https:\/\/gpui-kit\.com\//, `${path} canonical`);
    assert.match(html, /hreflang="en"/, `${path} English alternate`);
    assert.match(html, /hreflang="x-default"/, `${path} default alternate`);
    assert.doesNotMatch(html, /hreflang="zh-CN"/, `${path} has no Chinese alternate`);
  }
});

test('titles contain the GPUI Kit brand exactly once', () => {
  for (const file of htmlFiles(dist.pathname)) {
    if (file.endsWith('/404.html') || file.endsWith('/og-template.html')) continue;
    if (/<meta[^>]+http-equiv="refresh"/i.test(readFileSync(file, 'utf8'))) continue;
    const html = readFileSync(file, 'utf8');
    const title = tag(html, /<title>([\s\S]*?)<\/title>/);
    assert.equal((title.match(/GPUI Kit/g) ?? []).length, 1, `${file} title: ${title}`);
  }
});

test('titles are unique', () => {
  const seen = new Map();
  for (const file of htmlFiles(dist.pathname)) {
    if (file.endsWith('/404.html') || file.endsWith('/og-template.html')) continue;
    if (/<meta[^>]+http-equiv="refresh"/i.test(readFileSync(file, 'utf8'))) continue;
    const title = tag(readFileSync(file, 'utf8'), /<title>([\s\S]*?)<\/title>/);
    assert.ok(!seen.has(title), `${file} duplicates title from ${seen.get(title)}: ${title}`);
    seen.set(title, file);
  }
});

test('every indexable HTML page has exactly one H1', () => {
  for (const file of htmlFiles(dist.pathname)) {
    if (file.endsWith('/404.html') || file.endsWith('/og-template.html')) continue;
    if (/<meta[^>]+http-equiv="refresh"/i.test(readFileSync(file, 'utf8'))) continue;
    const count = (readFileSync(file, 'utf8').match(/<h1[\s>]/g) ?? []).length;
    assert.equal(count, 1, `${file} has ${count} H1 elements`);
  }
});

test('SEO discovery files and structured data are generated', () => {
  assert.ok(existsSync(new URL('robots.txt', dist)));
  assert.ok(existsSync(new URL('sitemap.xml', dist)));
  assert.match(read('index.html'), /<script type="application\/ld\+json">/);
  assert.match(read('docs/getting-started/index.html'), /BreadcrumbList/);
});

test('404 is excluded from indexing', () => {
  assert.match(read('404.html'), /<meta name="robots" content="noindex, nofollow"/);
});

test('component pages have independent routes and readable legacy URLs', () => {
  const source = new URL('../component/', import.meta.url);
  for (const name of readdirSync(source).filter(name => name.endsWith('.md'))) {
    const slug = name.slice(0, -3);
    const route = `component${slug === 'index' ? '' : `/${slug}`}`;
    const html = read(`${route}/index.html`);
    assert.ok(html.includes(`rel="canonical" href="https://gpui-kit.com/${route}"`), route);
    assert.match(html, /hreflang="en"/);
    assert.match(read(`${route}.md`), new RegExp(`^---\nurl: /${route}\\.md\n`));
    assert.match(read(`docs/components/${slug}/index.html`), /http-equiv="refresh"/);
    assert.ok(read(`docs/components/${slug}/index.html`).includes(`url=/${route}`));
    assert.equal(read(`docs/components/${slug}.md`), read(`${route}.md`));
  }
  assert.ok(read('docs/components/index.html').includes('url=/component'));
  assert.equal(read('docs/components.md'), read('component.md'));
});

test('shared guides remain under docs and sidebars keep the sections separate', () => {
  for (const guide of ['coding-guides', 'design-guides']) {
    const html = read(`docs/${guide}/index.html`);
    assert.ok(html.includes(`rel="canonical" href="https://gpui-kit.com/docs/${guide}"`));
    const sidebar = html.match(/<aside class="docs-sidebar"[\s\S]*?<\/aside>/)?.[0] ?? '';
    assert.ok(sidebar.includes('href="/docs/coding-guides"'));
    assert.ok(sidebar.includes('href="/docs/design-guides"'));
    assert.ok(!sidebar.includes('href="/component/'));
  }
  const html = read('component/button/index.html');
  const sidebar = html.match(/<aside class="docs-sidebar"[\s\S]*?<\/aside>/)?.[0] ?? '';
  assert.ok(sidebar.includes('href="/component/input"'));
  assert.ok(!sidebar.includes('href="/docs/'));
  assert.ok(read('index.html').includes('href="/docs"'));
  assert.ok(read('index.html').includes('href="/component"'));
});

test('component links and discovery use canonical routes', () => {
  const sitemap = read('sitemap.xml');
  const index = read('llms.txt');
  const full = read('llms-full.txt');
  assert.ok(sitemap.includes('https://gpui-kit.com/component/button'));
  assert.ok(!sitemap.includes('https://gpui-kit.com/zh-CN/'));
  assert.ok(index.includes('/component.md'));
  assert.ok(index.includes('/component/button.md'));
  assert.ok(!index.includes('/zh-CN/'));
  assert.ok(full.includes('Source: /component/button'));
  assert.ok(!full.includes('/zh-CN/'));
  assert.ok(read('base/primitives/input/index.html').includes('href="/component/input"'));
  assert.ok(read('component/icon/index.html').includes('href="/docs/assets"'));
  assert.ok(read('component/index.html').includes('href="/component/button"'));
  assert.ok(!sitemap.includes('/docs/components'));
  assert.ok(!index.includes('/docs/components'));
  assert.ok(!full.includes('/docs/components'));
});

test('LLM discovery identifies tested consumer recipes', () => {
  const index = read('llms.txt');
  const full = read('llms-full.txt');
  assert.match(index, /Tested consumer recipe: command-control/);
  assert.match(full, /Tested consumer recipe: command-control/);
  assert.match(full, /Source: \/component\/button/);
});

test('primary navigation follows the Kit section order', () => {
  const html = read('docs/index.html');
  const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
  const links = [...nav.matchAll(/<a\s+href="([^"]+)"\s+class="site-nav__link[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/g)];
  assert.deepEqual(links.slice(0, 5).map(match => match[2]), ['Docs', 'Component', 'Base', 'Shell', 'App Stories']);
  assert.deepEqual(links.slice(0, 5).map(match => match[1]), ['/docs', '/component', '/base', '/shell', '/apps']);
  assert.doesNotMatch(nav, /site-nav__lang-btn/);
});

test('testing guide has canonical routes and readable legacy URLs', () => {
  const route = 'docs/test';
  const html = read(`${route}/index.html`);
  assert.ok(html.includes('https://gpui-kit.com/docs/test'));
  assert.ok(read('docs/ui-testing/index.html').includes('url=/docs/test'));
  assert.equal(read('docs/ui-testing.md'), read(`${route}.md`));
  assert.ok(read('llms.txt').includes(`/${route}.md`));
});
