#!/usr/bin/env bash
# Builds the Slint gallery into `www/dist`, the folder the website serves at
# `/slint-gallery`.
set -euo pipefail

crate_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
profile="debug"
cargo_args=(build --manifest-path "$crate_dir/Cargo.toml" --target wasm32-unknown-unknown --lib)
if [[ "${1:-}" == "--release" ]]; then
  profile="release"
  cargo_args+=(--release)
fi

export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$crate_dir/target}"
cargo "${cargo_args[@]}"

target_dir="$CARGO_TARGET_DIR"

rm -rf "$crate_dir/www/dist"
mkdir -p "$crate_dir/www/dist"
wasm-bindgen "$target_dir/wasm32-unknown-unknown/$profile/slint_component.wasm" \
  --out-dir "$crate_dir/www/dist" --target web --no-typescript
cp "$crate_dir/www/index.html" "$crate_dir/www/dist/index.html"
