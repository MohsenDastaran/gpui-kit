//! Opens an embedded example's source on the documentation page.
//!
//! The web host installs the hook. Each example card has a code button that
//! calls it. Clicks on the example itself stay inside the example.

use std::cell::{Cell, RefCell};

use gpui_kit::assets::IconName;
use gpui_kit::component::ActiveTheme as _;
use gpui_kit::component::Sizable as _;
use gpui_kit::component::button::{Button, ButtonCustomVariant, ButtonVariants as _};
use gpui_kit::{App, SharedString, px};

thread_local! {
    static SHOW: RefCell<Option<Box<dyn Fn(usize, &str)>>> = const { RefCell::new(None) };
    static NEXT: Cell<usize> = const { Cell::new(0) };
    static OPEN: Cell<bool> = const { Cell::new(false) };
}

/// Receives the example a code button opened. Installed by the web gallery only.
pub fn install_source_button(hook: impl Fn(usize, &str) + 'static) {
    SHOW.with(|show| *show.borrow_mut() = Some(Box::new(hook)));
}

pub(crate) fn enabled() -> bool {
    SHOW.with(|show| show.borrow().is_some())
}

/// The next section index for this render. The following paint closes the
/// frame so the next render starts at zero again.
pub(crate) fn note_section() -> usize {
    if !OPEN.with(Cell::get) {
        NEXT.set(0);
        OPEN.set(true);
    }
    let index = NEXT.get();
    NEXT.set(index + 1);
    index
}

pub(crate) fn close_frame() {
    OPEN.set(false);
}

pub(crate) fn show(index: usize, title: &str) {
    SHOW.with(|show| {
        if let Some(hook) = show.borrow().as_ref() {
            hook(index, title);
        }
    });
}

/// The gallery's code button: a primary-tinted chip, not a bare glyph.
pub(crate) fn source_button(id: impl Into<SharedString>, cx: &App) -> Button {
    let primary = cx.theme().primary;
    Button::new(id.into())
        .icon(IconName::CodeXml)
        .outline()
        .custom(
            ButtonCustomVariant::new(cx)
                .color(primary)
                .foreground(primary)
                .hover(primary.opacity(0.22))
                .active(primary.opacity(0.34)),
        )
        .with_size(px(28.))
        .rounded(cx.theme().radius_lg)
        .tooltip("View source")
        .accessibility_label("View source")
}
