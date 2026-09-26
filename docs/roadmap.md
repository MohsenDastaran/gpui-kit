# Roadmap: Native UI Blocks — Website + Copy-Paste Components (GPUI + Slint)

Copy-paste components and blocks on the existing GPUI Kit site. People copy source into their own apps. `gpui-base` stays a crate dependency. Slint and later frameworks are hand-written sources plus a tab on the same pages.

The site is already Astro at <https://gpui-kit.com> (`website/`, English and zh-CN). This roadmap adds the gallery to that site. It does not start a second site.

**Current phase = the first empty checkbox in Progress.** Tick a phase only when its **Done when** line is true.

**Progress**

- [x] 1. Restructure folder layout
- [x] 2. GPUI catalog you can copy from the site
- [x] 3. Design tokens (GPUI)
- [x] 4. Framework selector on the website
- [x] 5. Write Slint components (one per GPUI component)
- [ ] 6. Add blocks (Login, Dashboard, Settings)
- [ ] 7. Starter templates
- [ ] 8. Deploy & launch

---

## Target structure

```text
website/                         # existing Astro site
├── component/                   # current GPUI Kit docs
├── blocks/                      # phase 6
├── templates/                   # phase 7 pages
└── zh-CN/                       # same sections in Chinese
crates/
├── base/                        # gpui-base (real dependency, never copied)
├── component/                   # GPUI copy sources
└── slint-component/             # hand-written Slint catalog + WASM gallery
templates/                       # phase 7 apps people copy
tokens/
├── tokens.json
└── schema.json
```

**Do not add:**

- A CLI (`dui add`, `dui init`, or any installer)
- A `registry/` tree or `registry.json`
- A code-generation pipeline (components, blocks, and Slint files are hand-written)

`crates/registry-cli` and `registry/` are leftovers from the installer approach. Remove them, and remove component comments that tell the registry CLI to copy files.

---

## 1. Restructure folder layout

1. `website/`, `crates/component/`, `crates/base/`, `tokens/`, and `crates/slint-component/` exist.
2. Apache-2.0 attribution stays in `README.md` and `NOTICE` (GPUI Kit / Longbridge, GPUI / Zed).

**Done when:** those folders exist and the workspace still builds.

---

## 2. GPUI catalog you can copy from the site

The component pages are the GPUI copy-paste set: `website/component/` and `website/zh-CN/component/`. A person copies a sample into an app that depends on `gpui-kit`. That crate already brings `gpui-component` and `gpui-base`, so the sample is usage, not a second copy of the component source.

`theme.md` is the theme guide and has no component sample. Every other catalog page has Rust you can copy. `CodeBlock` copies the block on the page.

**Done when:** those pages are on the site in both locales, and copying a block yields the Rust shown there.

---

## 3. Design tokens (GPUI)

Color, spacing, radius, and typography live in `tokens/tokens.json`, checked by `tokens/schema.json`. `tokens/README.md` maps those tokens onto the GPUI theme (`.theme-schema.json` and `crates/component/src/theme/default-theme.json`). `tokens/gpui/default.json` is the GPUI theme built from that file. The app still loads `default-theme.json` at runtime. Component-specific colors stay in the GPUI theme layer.

The Slint mapping is written in phase 5, with the Slint components.

**Done when:** `tokens/tokens.json`, `tokens/schema.json`, `tokens/gpui/default.json`, and the GPUI mapping note exist.

---

## 4. Framework selector on the website

Built on the existing Astro site. The GPUI Kit docs stay as they are (usage, API, both locales).

1. Every catalog component page has a GPUI / Slint selector below the live example (`website/src/lib/rehype-framework-code.js`). The choice is saved in `localStorage` (`selected-framework`) and applied before first paint, so a return visit never flashes the other framework.
2. Each code block on those pages is a pair of panels: `data-framework-panel="gpui"` holds the existing Rust, and `data-framework-panel="slint"` shows “No Slint version of this example yet.” until phase 5 fills it.
3. Switching reloads the page’s code in place (`website/src/lib/framework-switch.ts`): a progress bar runs under the nav, the blocks turn into a shimmering skeleton, then the chosen framework fades in. Reduced motion switches instantly. Arrow keys move between the two options, and the change is announced to screen readers.
4. Each code block has a copy button (`CodeBlock`), in both locales.

**Done when:** the dev server shows every catalog component with a working selector in both locales. GPUI source is visible and copyable. Slint blocks are ready and hidden until Slint is selected.

---

## 5. Write Slint components

`crates/slint-component/` is a standalone crate (excluded from the GPUI Kit workspace) so Slint never enters the GPUI lockfile.

1. Every catalog slug has a hand-written `ui/<slug>.slint` and an interactive `ui/examples/<slug>.slint`. Copy those files into a Slint app; there is no installer.
2. `ui/theme.slint` maps `tokens/tokens.json` (see `tokens/README.md`). Components read `Theme` and nothing else.
3. `scripts/check.sh` type-checks each example with the gallery's Slint version. The gallery window (`ui/gallery.slint`) shows one example, chosen by page slug.
4. The website live example follows the selector (`ComponentExample.vue`): GPUI stays at `/gallery`, Slint loads `/slint-gallery?component=<slug>`. Another framework later adds a source in the same map. Both iframes stay mounted after first open, so switching back is instant.
5. `remark-slint-source.js` fills the Import and Usage Slint panels from those files, in both locales. Remaining GPUI-only samples say the Slint usage at the top of the page covers the component.

**Done when:** every catalog page shows Slint source under the selector, and selecting Slint shows the Slint WASM example.

---

## 6. Add blocks (Login, Dashboard, Settings)

Build these in both frameworks:

- **Login** — email, password, submit, forgot-password
- **Dashboard** — sidebar, header, card grid, stat cards
- **Settings** — toggles, radio choices, text fields, save

1. Put the GPUI source with the copyable components, and the Slint source in `crates/slint-component/`.
2. Add a Blocks tab: `website/blocks/{name}.md` and `website/zh-CN/blocks/{name}.md`.
3. Each page uses the same framework selector and copy button.

**Done when:** all three blocks are on the site, in both locales, with copy-paste source for GPUI and Slint.

---

## 7. Starter templates

Templates are apps a person copies. They are not installed by a command.

1. Add three directories under `templates/`:
   - **Blank** — window, `gpui_component::init`, `Root`, default theme
   - **Login** — blank plus the Login block
   - **Dashboard** — blank plus the Dashboard block
2. Add a Templates tab, English and zh-CN, with the tree to copy and what the app contains.
3. When Slint blocks exist, add a Slint variant of each template the same way (a directory people copy, listed on the same pages).

**Done when:** each template builds after it is copied into a new directory, and both locales link to it.

---

## 8. Deploy & launch

The repository is already public and Apache-2.0. The site is already at <https://gpui-kit.com>.

1. Publish the selector, the full component catalog, the three blocks, and the templates on that site.
2. Say on the Blocks and component pages that this gallery is source you copy. There is no installer.

**Done when:** those pages are live on <https://gpui-kit.com> in both locales.

---

## What not to do

- Build a CLI.
- Build a registry (`registry.json`, manifests, install commands).
- Generate components or blocks from a spec.
- Use git submodules for framework ports.
- Add QuickGUI until its API is stable.
- Replace the GPUI Kit docs site, or open a second docs site.
- List egui, Iced, or other frameworks in the selector before their source exists.

---

## Risks

| Risk | What to do |
| --- | --- |
| GPUI and Slint drift | Finish each catalog component in both frameworks before starting the next. The three blocks wait until the components they use exist in both. |
| Slint’s API changes | Use stable widgets. Skip new Slint APIs in this pass. |
| The website lags the source files | Update the page when the source file changes. A monthly pass is enough. |
| Readers look for an installer | The Blocks pages say to copy the source. |

---

## Later

egui, Iced, or another toolkit can join after phase 8, one at a time, once its API is stable: hand-write the full catalog and the 3 blocks, add a value to the selector, and add the snippets in both locales.
