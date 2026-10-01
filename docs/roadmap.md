# Roadmap: Native UI Blocks — Website + Copy-Paste Components (GPUI + Slint)

Copy-paste components and blocks on the existing GPUI Kit site. People copy source into their own apps. `gpui-base` stays a crate dependency. Slint and later frameworks are hand-written sources plus a tab on the same pages.

The site is already Astro at [https://gpui-kit.com](https://gpui-kit.com) (`website/`, English). This roadmap adds the gallery to that site. It does not start a second site.

**Current phase = the first empty checkbox in Progress.** Tick a phase only when its **Done when** line is true.

**Progress**

- [x] 1. Restructure folder layout
- [x] 2. GPUI catalog you can copy from the site
- [x] 3. Design tokens (GPUI)
- [x] 4. Framework selector on the website
- [x] 5. Write Slint components (one per GPUI component)
- [x] 6. Slint usage, main controls first
- [ ] 7. Add blocks (Login, Dashboard, Settings)
- [ ] 8. Starter templates
- [ ] 9. Deploy & launch

---

## Target structure

```text
website/                         # existing Astro site
├── component/                   # current GPUI Kit docs
├── blocks/                      # phase 7
├── templates/                   # phase 8 pages
crates/
├── base/                        # gpui-base (real dependency, never copied)
├── component/                   # GPUI copy sources
└── slint-component/             # hand-written Slint catalog + WASM gallery
templates/                       # phase 8 apps people copy
tokens/
├── tokens.json
└── schema.json
registry/                        # uni-kit CLI and components.json
```

`uni-kit` only copies files named in `registry/components.json`. It does not generate components. Adding a toolkit is a new entry in that file, not a new CLI release.

**Do not add:**

- A code-generation pipeline (components, blocks, and Slint files are hand-written)

---

## 1. Restructure folder layout

1. `website/`, `crates/component/`, `crates/base/`, `tokens/`, and `crates/slint-component/` exist.
2. Apache-2.0 attribution stays in `README.md` and `NOTICE` (GPUI Kit / Longbridge, GPUI / Zed).

**Done when:** those folders exist and the workspace still builds.

---

## 2. GPUI catalog you can copy from the site

The component pages are the GPUI copy-paste set: `website/component/`. A person copies a sample into an app that depends on `gpui-kit`. That crate already brings `gpui-component` and `gpui-base`, so the sample is usage, not a second copy of the component source.

`theme.md` is the theme guide and has no component sample. Every other catalog page has Rust you can copy. `CodeBlock` copies the block on the page.

**Done when:** those pages are on the site, and copying a block yields the Rust shown there.

---

## 3. Design tokens (GPUI)

Color, spacing, radius, and typography live in `tokens/tokens.json`, checked by `tokens/schema.json`. `tokens/README.md` maps those tokens onto the GPUI theme (`.theme-schema.json` and `crates/component/src/theme/default-theme.json`). `tokens/gpui/default.json` is the GPUI theme built from that file. The app still loads `default-theme.json` at runtime. Component-specific colors stay in the GPUI theme layer.

The Slint mapping is written in phase 5, with the Slint components.

**Done when:** `tokens/tokens.json`, `tokens/schema.json`, `tokens/gpui/default.json`, and the GPUI mapping note exist.

---

## 4. Framework selector on the website

Built on the existing Astro site. The GPUI Kit docs stay as they are (usage, API).

1. Every catalog component page has a GPUI / Slint selector below the live example (`website/src/lib/rehype-framework-code.js`). The choice is saved in `localStorage` (`selected-framework`) and applied before first paint, so a return visit never flashes the other framework.
2. Each code block on those pages is a pair of panels: `data-framework-panel="gpui"` holds the existing Rust, and `data-framework-panel="slint"` shows “No Slint version of this example yet.” until phase 5 fills it.
3. Switching reloads the page’s code in place (`website/src/lib/framework-switch.ts`): a progress bar runs under the nav, the blocks turn into a shimmering skeleton, then the chosen framework fades in. Reduced motion switches instantly. Arrow keys move between the two options, and the change is announced to screen readers.
4. Each code block has a copy button (`CodeBlock`).

**Done when:** the dev server shows every catalog component with a working selector. GPUI source is visible and copyable. Slint blocks are ready and hidden until Slint is selected.

---

## 5. Write Slint components

`crates/slint-component/` is a standalone crate (excluded from the GPUI Kit workspace) so Slint never enters the GPUI lockfile.

1. Every catalog slug has a hand-written `ui/<slug>.slint` and an interactive `ui/examples/<slug>.slint`. Copy those files into a Slint app; there is no installer.
2. `ui/theme.slint` maps `tokens/tokens.json` (see `tokens/README.md`). Components read `Theme` and nothing else.
3. `scripts/check.sh` type-checks each example with the gallery's Slint version. The gallery window (`ui/gallery.slint`) shows one example, chosen by page slug.
4. The website live example follows the selector (`ComponentExample.vue`): GPUI stays at `/gallery`, Slint loads `/slint-gallery?component=<slug>`. Another framework later adds a source in the same map. Both iframes stay mounted after first open, so switching back is instant.
5. `remark-slint-source.js` fills the Import and the first Usage Slint panel from those files. Phase 6 replaces that with one sample per section.

**Done when:** every catalog page shows Slint source under the selector, and selecting Slint shows the Slint WASM example.

---

## 6. Slint usage, main controls first

Alert Dialog is the pattern. Each Rust sample on its page has its own Slint sample in `crates/slint-component/ui/usage/alert-dialog/`. The import is by file name (`alert-dialog.slint`) from `ui/components`, which is where `uni-kit add` writes the files and what it adds to the Slint include path. Samples import only files that command installs.

Check and finish the main controls before the rest of the catalog:

1. Button, Input, Textarea, Checkbox, Radio, Switch, Select, Label, Icon, Dialog.
2. Every remaining catalog slug.

For each one:

1. Match the GPUI page: one `ui/usage/<slug>/en/*.slint` file per Rust sample, in the same order. When samples are shared, `ui/usage/<slug>/*.slint` is enough.
2. Imports are bare file names. Do not import gallery-only files such as GroupBox.

**Done when:** every catalog page’s Slint panels are separate samples like Alert Dialog, and each sample compiles after that component is installed.

---

## Source icons scroll to the sample

Each gallery card’s code icon (GPUI and Slint) scrolls the docs page to that example’s copyable sample. A card with no section gets a short heading and a fence.

The sample is the gallery example that is already running, not a separately written usage file. The page shows that source, so the block is code that works, and every gallery card has a sample in the usage section. When several cards share a type, the card keeps the type as its title and adds a subtitle so each one scrolls to its own sample.

**Done when:** every catalog component below is ticked. `theme` has no sample.

- [x] Accordion
- [x] Alert
- [x] Alert Dialog
- [x] Attachment
- [x] Avatar
- [x] Badge
- [x] Bubble
- [x] Button
- [x] Calendar
- [x] Card
- [x] Carousel
- [x] Chart
- [ ] Checkbox
- [ ] Clipboard
- [ ] Collapsible
- [ ] Color picker
- [ ] Combobox
- [ ] Command
- [ ] Data table
- [ ] Date picker
- [ ] Description list
- [ ] Dialog
- [ ] Dock
- [ ] Dropdown button
- [ ] Editor
- [ ] Empty
- [ ] Focus trap
- [ ] Form
- [ ] Group box
- [ ] Hover card
- [ ] Icon
- [ ] Image
- [ ] Input
- [ ] Input group
- [ ] Kbd
- [ ] Label
- [ ] List
- [ ] Marker
- [ ] Menu
- [ ] Message
- [ ] Message scroller
- [ ] Notification
- [ ] Number input
- [ ] OTP input
- [ ] Pagination
- [ ] Plot
- [ ] Popover
- [ ] Progress
- [ ] Questionnaire
- [ ] Radio
- [ ] Rating
- [ ] Resizable
- [ ] Root
- [ ] Scrollable
- [ ] Select
- [ ] Settings
- [ ] Sheet
- [ ] Shimmer
- [ ] Sidebar
- [ ] Skeleton
- [ ] Slider
- [ ] Spinner
- [ ] Status bar
- [ ] Stepper
- [ ] Switch
- [ ] Table
- [ ] Tabs
- [ ] Tag
- [ ] Text view
- [ ] Textarea
- [ ] Time field
- [ ] Title bar
- [ ] Toggle
- [ ] Toolbar
- [ ] Tooltip
- [ ] Tree
- [ ] Virtual list

---

## 7. Add blocks (Login, Dashboard, Settings)

Build these in both frameworks:

- **Login** — email, password, submit, forgot-password
- **Dashboard** — sidebar, header, card grid, stat cards
- **Settings** — toggles, radio choices, text fields, save

1. Put the GPUI source with the copyable components, and the Slint source in `crates/slint-component/`.
2. Add a Blocks tab: `website/blocks/{name}.md`.
3. Each page uses the same framework selector and copy button.

**Done when:** all three blocks are on the site, with copy-paste source for GPUI and Slint.

---

## 8. Starter templates

Templates are apps a person copies. They are not installed by a command.

1. Add three directories under `templates/`:

- **Blank** — window, `gpui_component::init`, `Root`, default theme
- **Login** — blank plus the Login block
- **Dashboard** — blank plus the Dashboard block

1. Add a Templates tab, in English, with the tree to copy and what the app contains.
2. When Slint blocks exist, add a Slint variant of each template the same way (a directory people copy, listed on the same pages).

**Done when:** each template builds after it is copied into a new directory, and the site links to it.

---

## 9. Deploy & launch

The repository is already public and Apache-2.0. The site is already at [https://gpui-kit.com](https://gpui-kit.com).

1. Publish the selector, the full component catalog, the three blocks, and the templates on that site.
2. Say on the Blocks and component pages that this gallery is source you copy. There is no installer.

**Done when:** those pages are live on [https://gpui-kit.com](https://gpui-kit.com).

---

## What not to do

- Generate components or blocks from a spec. `uni-kit` only copies files listed in `registry/components.json`.
- Use git submodules for framework ports.
- Add QuickGUI until its API is stable.
- Replace the GPUI Kit docs site, or open a second docs site.
- List egui, Iced, or other frameworks in the selector before their source exists.

---

## Risks

| Risk                              | What to do                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| GPUI and Slint drift              | Finish each catalog component in both frameworks before starting the next. The three blocks wait until the components they use exist in both. |
| Slint’s API changes               | Use stable widgets. Skip new Slint APIs in this pass.                                                                                         |
| The website lags the source files | Update the page when the source file changes. A monthly pass is enough.                                                                       |
| Readers look for an installer     | The Blocks pages say to copy the source.                                                                                                      |

---

## Later

egui, Iced, or another toolkit can join after phase 9, one at a time, once its API is stable: hand-write the full catalog and the 3 blocks, add a value to the selector, and add the snippets on the English pages.
