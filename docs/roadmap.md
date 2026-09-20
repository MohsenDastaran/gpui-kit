# Roadmap: Cross-Framework UI Registry (Slint + GPUI, later GPUIX/QuickGUI)

**Current phase = the first empty checkbox in Progress.** Tick a phase only when its **Done when** line is true (you can point at a folder, command, or file). Sub-steps have no boxes; they are how you get that evidence.

**Progress**

- [x] 1. Restructure
- [ ] 2. GPUI target source
- [ ] 3. Design tokens
- [ ] 4. Registry + CLI (GPUI only)
- [ ] 5. Slint target
- [ ] 6. Cross-framework component spec
- [ ] 7. Blocks / recipes
- [ ] 8. Later targets
- [ ] 9. Website content rewrite

---

## Target structure

Mirror shadcn/ui: docs/marketing site, CLI, and registry (component source + `registry.json`) as separate concerns. Do not bolt a registry onto the existing crate layout.

Keep as-is:

- `website/` — content rewrite is phase 9
- `crates/base/` — real `gpui-base` dependency, not copied
- `crates/component/` — source for GPUI-target files
- dock / table / editor (wherever they live today) — shelved, untouched for now

Create during phase 1:

```
├── website/
├── crates/
│   ├── base/
│   ├── component/
│   ├── slint-component/   # hand-authored Slint components
│   └── registry-cli/      # the `dui` CLI (Rust)
├── tokens/                # framework-independent design tokens
└── registry/              # registry.json + per-component/per-target manifests
```

---

## 1. Restructure

1. Confirm the baseline still builds (`cargo run` in `story`).
2. Reorganize the workspace to the tree above: leave `base` / `component` / dock / table / editor where they are; add empty crates for `slint-component` and `registry-cli`; add top-level `tokens/` and `registry/`.
3. Record Apache-2.0 attribution in NOTICE/README.

**Done when:** `crates/slint-component/`, `crates/registry-cli/`, `tokens/`, and `registry/` exist in this repo.

## 2. GPUI target source

1. From `crates/component`, pick the first set: Button, Input, Card, Badge, Checkbox, Switch, Dialog, Tabs, Dropdown, Tooltip, Avatar, Select.
2. Refactor each into a self-contained file with minimal internal coupling — copyable on its own, not only importable as part of the crate.
3. Keep `gpui-base` as a real dependency (like Radix under shadcn) — not copied.
4. Confirm `gpui-component`'s styled source is what the CLI will copy.

**Done when:** each of those twelve components is a copyable file and still builds against `gpui-base`.

## 3. Design tokens

1. Base `tokens/` on the existing `.theme-schema.json` and `themes/` — do not start from zero.
2. Define a framework-independent `tokens.json` (color, spacing, radius, typography).
3. Write a generator: `tokens.json → GPUI theme`.

**Done when:** you can regenerate a GPUI theme from `tokens.json` and the app still themes correctly.

## 4. Registry + CLI (GPUI only)

Finish this target before touching Slint.

1. Design the `registry.json` schema: component name, per-target file list, dependencies, tokens used.
2. Build the CLI in Rust (not Node). First consumers are Cargo/Rust projects; distribute the binary directly or via git — do not depend on npm.
3. `dui init`
4. `dui add button --target gpui`
5. Validate end-to-end: fresh GPUI project, `dui add button`, confirm it compiles.

**Done when:** a clean GPUI app compiles after `dui add button --target gpui`.

## 5. Slint target (fully net-new)

1. Hand-write the same component list in Slint (`.slint` + Rust glue) in `crates/slint-component` — nothing from gpui-kit is reused here.
2. Write a generator: `tokens.json → Slint global properties`.
3. Add `--target slint` to the CLI.
4. Document the real divergence: GPUI's imperative/retained Rust API vs. Slint's declarative DSL (props, events, layout) even when tokens match.

**Done when:** `dui add button --target slint` produces a compiling Slint component.

## 6. Cross-framework component spec

1. After writing each component twice, extract the common pattern into a JSON Schema (props, variants, states, tokens consumed).
2. Generator for both targets' skeletons from one spec — only for simple presentational components (Button, Badge, Card, Avatar).
3. Keep stateful/complex components (Dialog, Tabs, Dropdown) hand-maintained; generate only a starting skeleton.

**Done when:** Button / Badge / Card / Avatar skeletons generate for both targets, and Dialog / Tabs / Dropdown stay hand-written.

## 7. Blocks / recipes

1. Build Login, Dashboard, Settings using registry components — one hand-built implementation per target, not spec-generated.
2. Extend `registry.json` to cover blocks (multiple files per target instead of one).

**Done when:** each block exists for GPUI and Slint and can be added via the CLI.

## 8. Later targets

1. Add GPUIX before QuickGUI — it renders on top of GPUI, so its adapter should be lighter.
2. Leave QuickGUI until it is out of pre-alpha and its API has settled.

**Done when:** GPUIX is a working `--target` (QuickGUI still deferred if the API has not settled).

## 9. Website content rewrite

1. Restructure the inherited site around: registry browsing (by target), the CLI, design tokens, and the cross-framework spec — not around "add gpui-kit as a dependency."
2. Add a framework switcher to component doc pages (GPUI / Slint, more later).

**Done when:** the site explains the registry model and component pages switch between targets.

---

## Risks

- **Upstream drift:** once you copy-paste instead of depending, future gpui-kit updates will not automatically reach code users already copied. Same trade-off shadcn accepted. Mitigation: keep `gpui-base` as a dependency; only copy styled source.
- **Uneven target maturity:** GPUI is production-proven; the Slint side is written from scratch. Mitigation: finish phase 4 before phase 5.
- **Site content debt:** a working docs site is not documentation for this model. Mitigation: phase 9 is explicit, not "later if we have time."
