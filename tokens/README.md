# Design tokens

Framework-independent tokens for color, spacing, radius, and typography.

- `schema.json` — JSON Schema for `tokens.json`
- `tokens.json` — source of truth, taken from `.theme-schema.json` and the Default Light/Dark palettes in `crates/component/src/theme/default-theme.json` (hex, not GPUI palette names)
- `gpui/default.json` — GPUI `ThemeSet` generated from `tokens.json`

Regenerate the GPUI theme:

```bash
cargo run -p registry-cli -- tokens generate
```

The app still loads `crates/component/src/theme/default-theme.json` at runtime. Applying the generated file produces the same semantic colors (background, foreground, primary, radius, type) as that default theme. Component-specific colors (table, sidebar, syntax highlight) stay in the GPUI theme layer; they are not copied into `tokens.json`.

Keep `gpui-base` as a crate dependency. Do not copy it.
