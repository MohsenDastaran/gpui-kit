<p align="center">
  <img src="https://raw.githubusercontent.com/longbridge/gpui-kit/main/website/public/logo.svg" width="112" alt="GPUI Kit logo" />
  <br>
  <strong>GPUI Kit</strong>
</p>

[![Build Status](https://github.com/longbridge/gpui-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/longbridge/gpui-kit/actions/workflows/ci.yml) [![Docs](https://docs.rs/gpui-kit/badge.svg)](https://docs.rs/gpui-kit/) [![Crates.io](https://img.shields.io/crates/v/gpui-kit.svg)](https://crates.io/crates/gpui-kit)

Copy-paste native UI for Rust desktop toolkits. The same component catalog is hand-written for each framework and published on <https://gpui-kit.com>. You copy the source into your own app. There is no CLI, no registry, and no code generator.

GPUI and Slint are in the catalog now. egui, QuickGUI, and other toolkits join the same pages after their components are written. The work is tracked in the [roadmap](docs/roadmap.md).

## Frameworks

| Framework | How an app uses it | Status |
| --- | --- | --- |
| [GPUI](https://github.com/zed-industries/zed) | Depend on the `gpui-kit` crate. Copy a sample from the component page. | On the site |
| [Slint](https://slint.dev) | Copy the `.slint` files into the app and compile them with `slint-build`. | On the site |
| egui, QuickGUI, and others | The same pages, once the source exists. | [Roadmap](docs/roadmap.md) |

The site docs stay one site, in English and zh-CN. A framework selector on each component page switches the live example and the copyable source. GPUI samples assume an app that depends on `gpui-kit` (that crate already brings `gpui-component` and `gpui-base`). Slint samples are the files under `crates/slint-component/ui/`.

Blocks (Login, Dashboard, Settings) and starter templates are next. See the [roadmap](docs/roadmap.md).

## GPUI

`gpui-kit` is the crate a GPUI application depends on. It pins the matching GPUI release and re-exports GPUI, `gpui-base`, `gpui-component`, and the default assets.

```text
gpui-kit             The one crate applications depend on
├── gpui-base        Unstyled behavior, state, and infrastructure
└── gpui-component   The styled component library
```

```toml
[dependencies]
gpui-kit = "0.6"
```

`gpui_kit::init` runs before any component is used, and the first view in a window is a `Root`. The component pages on the site are the samples to copy. Architecture of the GPUI crates is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

The default `assets` feature bundles the [Lucide](https://lucide.dev) icon set. Pass it in with `gpui_kit::application().with_assets(gpui_kit::assets::Assets)`.

JavaScript extension hosts add `gpui-shell` separately. `gpui-component-shell` supplies the styled catalog for that host.

## Slint

Slint components are source you copy, not a crate from this repository. `crates/slint-component` is the gallery used by the website. An application does not depend on it.

From `crates/slint-component/ui/`, copy `theme.slint`, the component, the files it imports, and the `icons/` folder beside `icon.slint`. These files are written for Slint 1.17.

```bash
cargo add slint@1.17
cargo add --build slint-build@1.17
```

`build.rs` compiles the app window:

```rust
fn main() {
    slint_build::compile("ui/app.slint").unwrap();
}
```

`AlertDialog` fills its parent, so place it on the window. `destructive: true` uses the danger confirm button. The dialog sets `open` to false when either button is pressed.

```slint
import { Theme } from "theme.slint";
import { Button } from "button.slint";
import { AlertDialog } from "alert-dialog.slint";

export component App inherits Window {
    in-out property <bool> ask-delete;

    background: Theme.background;

    VerticalLayout {
        width: 100%;
        height: 100%;
        alignment: center;
        Button {
            text: "Delete project";
            clicked => { root.ask-delete = true; }
        }
    }

    AlertDialog {
        open <=> root.ask-delete;
        title: "Delete project?";
        description: "This cannot be undone.";
        confirm-text: "Delete";
        destructive: true;
    }
}
```

## Roadmap

The [roadmap](docs/roadmap.md) is the plan for this catalog. Current progress:

1. Folder layout
2. GPUI catalog you can copy from the site
3. Design tokens
4. Framework selector
5. Slint components, one per GPUI component
6. Blocks — Login, Dashboard, Settings
7. Starter templates
8. Deploy and launch

egui, QuickGUI, and other toolkits are added after that, one at a time, once the API is stable: the full catalog and the three blocks, hand-written, then a value in the same selector.

## Skills for AI coding agents

```bash
npx skills add longbridge/gpui-kit
```

| Skill | Description |
| --- | --- |
| `gpui-kit` | Setup, the component catalog, usage patterns, GPUI mechanics, and the Coding Guides. |
| `gpui-kit-design-guides` | Layout, spacing, hierarchy, interaction states, overlays, and interface copy. |

## Development

```bash
# GPUI component gallery
cargo run

# Website
make dev:website

# Website, rebuilding the Slint gallery first
make dev:website-slint
```

Larger GPUI examples run as their own packages: `cargo run -p example-dock`, `example-editor`, `example-markdown`, `system_monitor`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0. Third-party attribution is in [NOTICE](./NOTICE).

- Built on [GPUI](https://github.com/zed-industries/zed), the UI framework from Zed Industries, also Apache-2.0. The `gpui-pre-*` crates are snapshots of it, published with Zed's license and notices intact.
- The GPUI component library is extracted from [Longbridge Pro](https://longbridge.com/desktop).
- UI design based on [shadcn/ui](https://ui.shadcn.com), some from [Reui](https://reui.io).
- Icons from [Lucide](https://lucide.dev).
