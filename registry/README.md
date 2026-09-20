# Registry

`registry.json` and per-component, per-target file manifests land in phase 4.
This directory exists so the workspace shape is in place.

The CLI will copy **GPUI Component styled source**, not `gpui-base`. Keep
`gpui-base` as a crate dependency (the Radix equivalent). Phase 2 copy units:

| Component | File |
| --- | --- |
| Button | `crates/component/src/button.rs` |
| Input | `crates/component/src/input/input.rs` |
| Card | `crates/component/src/card.rs` |
| Badge | `crates/component/src/badge.rs` |
| Checkbox | `crates/component/src/checkbox.rs` |
| Switch | `crates/component/src/switch.rs` |
| Dialog | `crates/component/src/dialog.rs` |
| Tabs | `crates/component/src/tab.rs` (`tab/tab_bar.rs` is the TabBar companion) |
| Dropdown | `crates/component/src/menu/dropdown_menu.rs` |
| Tooltip | `crates/component/src/tooltip.rs` |
| Avatar | `crates/component/src/avatar.rs` |
| Select | `crates/component/src/select.rs` |
