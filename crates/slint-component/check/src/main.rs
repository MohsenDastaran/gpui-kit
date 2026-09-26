//! `slint-component-check <file.slint>...` compiles each file to Rust exactly
//! as the gallery's build script does, and exits non-zero when any file has an
//! error. Warnings are printed; `scripts/check.sh` treats them as failures.

fn main() {
    let output = std::env::temp_dir().join("slint-component-check.rs");
    let mut failed = false;
    for path in std::env::args().skip(1) {
        let config = slint_build::CompilerConfiguration::new();
        if let Err(error) = slint_build::compile_with_output_path(&path, &output, config) {
            eprintln!("{error}");
            failed = true;
        }
    }
    std::process::exit(i32::from(failed));
}
