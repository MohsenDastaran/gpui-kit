import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob, type Loader } from 'astro/loaders';

// Component pages are rendered once and cached by the markdown digest. The
// Slint samples live in ui/examples, so a change there would stay invisible
// until the markdown itself changed. This loader drops that cache when
// anything under ui/examples changes, then renders the pages again.

const examplesRoot = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../crates/slint-component/ui/examples',
);

function examplesStamp() {
  const hash = createHash('sha1');
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.slint')) {
        hash.update(relative(examplesRoot, path));
        hash.update(readFileSync(path));
      }
    }
  };
  walk(examplesRoot);
  return hash.digest('hex');
}

function isExampleFile(path: string) {
  return path.endsWith('.slint') && path.includes(`${sep}examples${sep}`);
}

export function componentMarkdownLoader(base: string): Loader {
  const inner = glob({ pattern: '**/*.md', base });
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    name: `component-markdown (${base})`,
    async load(context) {
      const next = examplesStamp();
      if (context.meta.get('slint-examples') !== next) {
        context.store.clear();
        context.meta.set('slint-examples', next);
      }
      await inner.load(context);

      const watcher = context.watcher;
      if (!watcher) return;
      watcher.add(examplesRoot);
      const reload = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const updated = examplesStamp();
          if (context.meta.get('slint-examples') === updated) return;
          context.store.clear();
          context.meta.set('slint-examples', updated);
          await inner.load(context);
        }, 200);
      };
      const onExample = (changedPath: string) => {
        if (isExampleFile(changedPath)) reload();
      };
      watcher.on('add', onExample);
      watcher.on('change', onExample);
      watcher.on('unlink', onExample);
    },
  };
}
