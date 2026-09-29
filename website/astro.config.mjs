import { readdirSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import pagefind from 'astro-pagefind';
import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import { remarkCallouts } from './src/lib/remark-callouts.js';
import { remarkDocLinks } from './src/lib/remark-doc-links.js';
import { remarkSnippets } from './src/lib/remark-snippets.js';
import { rehypeHeadingAnchors } from './src/lib/rehype-heading-anchors.js';
import { rehypeFrameworkCode } from './src/lib/rehype-framework-code.js';
import { remarkSlintSource } from './src/lib/remark-slint-source.js';
import { wasmExamplesDevServer } from './src/lib/wasm-middleware.js';
import { shikiConfig, defaultHighlightLang } from './src/lib/markdown.js';

const BASE = '/';

// GitHub Pages serves static HTML redirects for old component bookmarks.
const componentRedirects = Object.fromEntries([
  ['/docs/components', '/component'],
  ...readdirSync(new URL('./component/', import.meta.url))
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const slug = name.slice(0, -3);
      return [
        `/docs/components/${slug}`,
        `/component${slug === 'index' ? '' : `/${slug}`}`,
      ];
    }),
]);

// PR #3010 (root/theme/dock migration): these three guides lived directly
// under /docs before this move, so they need a literal old->new mapping —
// componentRedirects only recognizes the /docs/components/<slug> prefix.
const legacyDocRedirects = Object.fromEntries(
  ['root', 'theme', 'dock'].map((slug) => [`/docs/${slug}`, `/component/${slug}`]),
);

export default defineConfig({
  site: 'https://gpui-kit.com',
  base: BASE,
  output: 'static',
  trailingSlash: 'never',
  redirects: {
    ...componentRedirects,
    ...legacyDocRedirects,
    '/docs/ui-testing': '/docs/test',
  },

  integrations: [
    vue({ devtools: false }),
    pagefind(),
  ],

  markdown: {
    // Astro 7 made Sätteri the default processor; the remark/rehype pipeline is
    // opt-in now, and the math plugins only run on it.
    processor: unified({
      remarkPlugins: [remarkMath, remarkSnippets, remarkSlintSource, remarkCallouts, [remarkDocLinks, { base: BASE }]],
      rehypePlugins: [rehypeMathjax, rehypeFrameworkCode, rehypeHeadingIds, rehypeHeadingAnchors],
    }),
    shikiConfig,
    defaultHighlightLang,
  },

  vite: {
    plugins: [tailwindcss(), wasmExamplesDevServer(BASE)],
  },
});
