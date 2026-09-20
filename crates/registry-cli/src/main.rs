mod tokens;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match (
        args.first().map(String::as_str),
        args.get(1).map(String::as_str),
    ) {
        (Some("tokens"), Some("generate")) => tokens::run_generate(&args[2..]),
        (Some("tokens"), Some("help" | "--help" | "-h"))
        | (Some("help" | "--help" | "-h"), _)
        | (Some("tokens"), None)
        | (None, _) => {
            print_usage();
            Ok(())
        }
        _ => {
            print_usage();
            Ok(())
        }
    };

    if let Err(err) = result {
        eprintln!("{err:#}");
        std::process::exit(1);
    }
}

fn print_usage() {
    eprintln!(
        "dui tokens generate [--tokens <path>] [--out <path>]\n\
         Other commands land in phase 4."
    );
}
