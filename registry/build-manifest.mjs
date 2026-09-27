// Rebuilds registry/components.json from the Slint sources.
// Rust toolkits stay in the manifest with an empty component map until their
// files exist. Adding one is a new entry here, not a new CLI release.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = path.join(root, 'crates/slint-component/ui');

function importsOf(file) {
  const text = fs.readFileSync(path.join(ui, file), 'utf8');
  return [...text.matchAll(/from\s+"([^"]+\.slint)"/g)].map((match) => path.basename(match[1]));
}

const slintFiles = fs
  .readdirSync(ui)
  .filter((name) => name.endsWith('.slint') && name !== 'gallery.slint');
const icons = fs
  .readdirSync(path.join(ui, 'icons'))
  .filter((name) => name.endsWith('.svg'))
  .sort();

function closure(start) {
  const seen = new Set();
  const pending = [start];
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const imported of importsOf(file)) pending.push(imported);
  }
  return [...seen].sort();
}

const slint = {
  default_target_dir: 'ui/components',
  components: {},
};
for (const file of slintFiles.sort()) {
  const name = file.replace(/\.slint$/, '');
  const files = closure(file).map((imported) => ({
    src: `crates/slint-component/ui/${imported}`,
    target: imported,
  }));
  if (files.some((item) => item.target === 'icon.slint')) {
    for (const icon of icons) {
      files.push({
        src: `crates/slint-component/ui/icons/${icon}`,
        target: `icons/${icon}`,
      });
    }
  }
  slint.components[name] = files;
}

const rust = (dir) => ({
  default_target_dir: dir,
  mod_file: `${dir}/mod.rs`,
  components: {},
});

const registry = {
  slint,
  egui: rust('src/components'),
  gpui: rust('src/components'),
  quickgui: rust('src/components'),
};

fs.writeFileSync(
  path.join(root, 'registry/components.json'),
  `${JSON.stringify(registry, null, 2)}\n`,
);
console.log(
  `slint components: ${Object.keys(slint.components).length}, icons: ${icons.length}`,
);
