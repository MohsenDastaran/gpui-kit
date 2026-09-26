//! Native gallery: `cargo run -- button --dark`.

fn main() -> Result<(), slint::PlatformError> {
    let mut args = std::env::args().skip(1);
    let mut component = String::from("button");
    let mut dark = false;
    for arg in args.by_ref() {
        if arg == "--dark" {
            dark = true;
        } else {
            component = arg;
        }
    }
    slint_component::run(&component, dark)
}
