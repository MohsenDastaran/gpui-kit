# uni-kit

Copies catalog components into the app you run it from. The file list is [`components.json`](components.json) in this folder. Publishing a new component is a new entry in that file, not a new release of this package. Rebuild it with `node build-manifest.mjs` after a Slint import changes.

```bash
npx uni-kit add slint alert-dialog
bunx uni-kit add slint alert-dialog
pnpm dlx uni-kit add slint alert-dialog

npx uni-kit add egui alert-dialog
npx uni-kit add gpui button
npx uni-kit add quickgui button
```

`--dir <path>` overrides the framework's default directory.

Slint files land in `ui/components/`. A component that uses icons also copies `icons/`, because `icon.slint` names every SVG. Rust frameworks land in `src/components/`. A file entry with `"module": "alert_dialog"` adds `pub mod alert_dialog;` to that framework's `mod_file` when the line is missing.

From this repository, the command reads `components.json` and the source files on disk. The published package reads them from [MohsenDastaran/uni-kit](https://github.com/MohsenDastaran/uni-kit) `main`. `components.json` is not part of the npm tarball, so adding a component does not require a new release.

Publish this folder:

```bash
cd registry
npm publish
```
