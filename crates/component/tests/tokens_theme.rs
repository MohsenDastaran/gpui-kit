use std::rc::Rc;

use gpui::Hsla;
use gpui_component::theme::{Theme, ThemeColor, ThemeSet};

const GENERATED: &str = include_str!("../../../tokens/gpui/default.json");
const DEFAULT_THEME: &str = include_str!("../src/theme/default-theme.json");

#[test]
fn generated_tokens_theme_deserializes_as_a_theme_set() {
    let set: ThemeSet = serde_json::from_str(GENERATED).expect("generated GPUI theme");
    assert_eq!(set.name.as_ref(), "Default");
    assert_eq!(set.themes.len(), 2);
    assert!(set.themes.iter().any(|theme| theme.mode.is_dark()));
    assert!(set.themes.iter().any(|theme| !theme.mode.is_dark()));
}

#[test]
fn applying_generated_theme_matches_default_semantic_colors() {
    let generated: ThemeSet = serde_json::from_str(GENERATED).unwrap();
    let builtin: ThemeSet = serde_json::from_str(DEFAULT_THEME).unwrap();

    for mode_is_dark in [false, true] {
        let generated_config = generated
            .themes
            .iter()
            .find(|theme| theme.mode.is_dark() == mode_is_dark)
            .expect("mode in generated theme");
        let builtin_config = builtin
            .themes
            .iter()
            .find(|theme| theme.mode.is_dark() == mode_is_dark)
            .expect("mode in default theme");

        let colors = if mode_is_dark {
            ThemeColor::dark()
        } else {
            ThemeColor::light()
        };

        let mut from_tokens = Theme::from(colors.as_ref());
        from_tokens.apply_config(&Rc::new(generated_config.clone()));

        let mut from_builtin = Theme::from(colors.as_ref());
        from_builtin.apply_config(&Rc::new(builtin_config.clone()));

        assert_eq!(generated_config.name, builtin_config.name);
        // Hex in tokens.json and named palette keys in default-theme.json (for
        // example `#0a0a0a` vs `neutral-950`) differ by HSL rounding. They must
        // still land on the same semantic color.
        hsla_close(from_tokens.background, from_builtin.background);
        hsla_close(from_tokens.foreground, from_builtin.foreground);
        hsla_close(from_tokens.popover, from_builtin.popover);
        hsla_close(
            from_tokens.popover_foreground,
            from_builtin.popover_foreground,
        );
        hsla_close(from_tokens.primary, from_builtin.primary);
        hsla_close(
            from_tokens.primary_foreground,
            from_builtin.primary_foreground,
        );
        hsla_close(from_tokens.secondary, from_builtin.secondary);
        hsla_close(
            from_tokens.secondary_foreground,
            from_builtin.secondary_foreground,
        );
        hsla_close(from_tokens.muted, from_builtin.muted);
        hsla_close(from_tokens.muted_foreground, from_builtin.muted_foreground);
        hsla_close(from_tokens.accent, from_builtin.accent);
        hsla_close(
            from_tokens.accent_foreground,
            from_builtin.accent_foreground,
        );
        hsla_close(from_tokens.danger, from_builtin.danger);
        hsla_close(
            from_tokens.danger_foreground,
            from_builtin.danger_foreground,
        );
        hsla_close(from_tokens.border, from_builtin.border);
        hsla_close(from_tokens.input, from_builtin.input);
        hsla_close(from_tokens.ring, from_builtin.ring);
        hsla_close(from_tokens.selection, from_builtin.selection);
        assert_eq!(from_tokens.radius, from_builtin.radius);
        assert_eq!(from_tokens.radius_lg, from_builtin.radius_lg);
        assert_eq!(from_tokens.font_size, from_builtin.font_size);
        assert_eq!(from_tokens.font_family, from_builtin.font_family);
        assert_eq!(from_tokens.shadow, from_builtin.shadow);
        assert_eq!(from_tokens.mode, from_builtin.mode);
    }
}

fn hsla_close(left: Hsla, right: Hsla) {
    let close = |a: f32, b: f32| (a - b).abs() < 0.002;
    assert!(
        close(left.h, right.h)
            && close(left.s, right.s)
            && close(left.l, right.l)
            && close(left.a, right.a),
        "{left:?} ≉ {right:?}"
    );
}
