dev-web:
	cd crates/story-web && make dev

# `--cwd` moves only the spawned process, so the site's own package.json and
# astro.config stay inside website/ and the repository root stays Rust-only.
dev\:website:
	bun run --cwd website dev

# The site serves crates/story-web/www/dist at `/gallery`, so this rebuilds the
# GPUI story gallery (WASM + Vite bundle) before starting the same dev server.
dev\:website-gpui:
	$(MAKE) -C crates/story-web build
	bun run --cwd website dev

# The site serves crates/slint-component/www/dist as-is, so this rebuilds the
# Slint gallery before starting the same dev server.
dev\:website-slint:
	$(MAKE) -C crates/slint-component build
	bun run --cwd website dev

# Release WASM for the GPUI component story gallery (`/gallery`).
build\:wasm-gpui:
	$(MAKE) -C crates/story-web build-wasm

# Release WASM gallery bundle for Slint (`/slint-gallery`).
build\:wasm-slint:
	$(MAKE) -C crates/slint-component build

# Release WASM for GPUI Base examples (`/examples/base`). Uses nightly Rust.
build\:wasm-base:
	$(MAKE) -C crates/base/examples/wasm build-wasm

# All website WASM targets (same three as release-docs CI).
build\:wasms: build\:wasm-gpui build\:wasm-slint build\:wasm-base

build\:website:
	bun run --cwd website build
