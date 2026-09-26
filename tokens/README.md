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

## Slint

`crates/slint-component/ui/theme.slint` is the Slint mapping, written by hand. Its `Theme` global carries both palettes and switches with `Theme.dark`:

| `tokens.json` | `Theme` |
| --- | --- |
| `color.<name>` (light and dark) | `Theme.<name>`, with `_` as `-` (`primary_foreground` → `primary-foreground`) |
| `spacing.xxs` … `spacing.xxl` | `Theme.spacing-xxs` … `Theme.spacing-xxl` |
| `radius.sm` … `radius.xl` | `Theme.radius-sm` … `Theme.radius-xl` |
| `typography.xs` … `typography.xl`, `mono_font_size` | `Theme.font-size-xs` … `Theme.font-size-xl`, `Theme.font-size-mono` |

`surface_foreground` is not mapped: it equals `foreground` in both palettes. The status colors (`info`, `success`, `warning`, `danger`), chart series, popover, sidebar, overlay, and shadow come from `default-theme.json`, like the component-specific colors on the GPUI side. When `tokens.json` changes, update `theme.slint` to match.
