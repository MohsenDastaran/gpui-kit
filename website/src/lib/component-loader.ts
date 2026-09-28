import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob, type Loader } from 'astro/loaders';

// Component pages are rendered once and cached by the markdown digest. The
// Slint samples live outside those files, so a new usage file would stay
// invisible until the markdown itself changed. This loader drops that cache
// when anything under ui/usage changes, then renders the pages again.

const usageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../crates/slint-component/ui/usage');

function usageStamp() {
  const hash = createHash('sha1');
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.slint')) {
        hash.update(relative(usageRoot, path));
        hash.update(readFileSync(path));
      }
    }
  };
  walk(usageRoot);
  return hash.digest('hex');
}

function isUsageFile(path: string) {
  return path.endsWith('.slint') && path.includes(`${sep}usage${sep}`);
}

export function componentMarkdownLoader(base: string): Loader {
  const inner = glob({ pattern: '**/*.md', base });
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    name: `component-markdown (${base})`,
    async load(context) {
      const next = usageStamp();
      if (context.meta.get('slint-usage') !== next) {
        context.store.clear();
        context.meta.set('slint-usage', next);
      }
      await inner.load(context);

      const watcher = context.watcher;
      if (!watcher) return;
      watcher.add(usageRoot);
      const reload = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const updated = usageStamp();
          if (context.meta.get('slint-usage') === updated) return;
          context.store.clear();
          context.meta.set('slint-usage', updated);
          await inner.load(context);
        }, 200);
      };
      const onUsage = (changedPath: string) => {
        if (isUsageFile(changedPath)) reload();
      };
      watcher.on('add', onUsage);
      watcher.on('change', onUsage);
      watcher.on('unlink', onUsage);
    },
  };
}
