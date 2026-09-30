//! Hand-written Slint versions of the GPUI Component catalog.
//!
//! The components live in `ui/` as plain `.slint` files that applications copy
//! into their own project, together with `ui/theme.slint`. This crate compiles
//! them into the gallery the website embeds beside each component page.

slint::include_modules!();

/// Opens the gallery on one component's example, named by its page slug.
pub fn run(component: &str, dark: bool) -> Result<(), slint::PlatformError> {
    let gallery = Gallery::new()?;
    gallery.set_component(component.into());
    gallery.global::<Theme>().set_dark(dark);
    #[cfg(target_arch = "wasm32")]
    web::apply_host_palette(&gallery);
    #[cfg(target_arch = "wasm32")]
    web::bridge_examples(&gallery);

    // Size the window before it is shown. Otherwise the first frame keeps the
    // 800px preferred width and the iframe clips the right padding.
    #[cfg(target_arch = "wasm32")]
    web::sync_to_frame(&gallery);

    gallery.show()?;
    follow_frame(gallery.as_weak());

    #[cfg(target_arch = "wasm32")]
    {
        web::follow_site_theme(gallery.as_weak());
        web::fill_viewport(gallery.as_weak());
    }

    slint::run_event_loop()
}

/// Rows reflow from `Theme.viewport`. Slint does not expose a resize callback,
/// so the gallery samples the frame. On the web the canvas CSS fills the
/// iframe, which makes Slint keep its 800px preferred size and clip the right
/// padding until something resizes the window.
fn follow_frame(gallery: slint::Weak<Gallery>) {
    let timer = slint::Timer::default();
    timer.start(
        slint::TimerMode::Repeated,
        std::time::Duration::from_millis(100),
        move || {
            let Some(gallery) = gallery.upgrade() else {
                return;
            };
            sync_frame(&gallery);
        },
    );
    Box::leak(Box::new(timer));
}

fn sync_frame(gallery: &Gallery) {
    #[cfg(target_arch = "wasm32")]
    web::sync_to_frame(gallery);

    #[cfg(not(target_arch = "wasm32"))]
    {
        let window = gallery.window();
        let width = window.size().to_logical(window.scale_factor()).width;
        let theme = gallery.global::<Theme>();
        if (theme.get_viewport() - width).abs() >= 1.0 {
            theme.set_viewport(width);
        }
    }
}

#[cfg(target_arch = "wasm32")]
mod web {
    use slint::ComponentHandle as _;
    use wasm_bindgen::prelude::*;

    use crate::{Gallery, Theme};

    /// Light or dark from the embedding page, else the standalone gallery's
    /// `localStorage` value or the system preference.
    pub(crate) fn site_prefers_dark() -> bool {
        if let Some(dark) = host_is_dark() {
            return dark;
        }
        let Some(window) = web_sys::window() else {
            return false;
        };
        let stored = window
            .local_storage()
            .ok()
            .flatten()
            .and_then(|storage| storage.get_item("theme").ok().flatten());
        match stored.as_deref() {
            Some("dark") => true,
            Some("light") => false,
            _ => window
                .match_media("(prefers-color-scheme: dark)")
                .ok()
                .flatten()
                .is_some_and(|query| query.matches()),
        }
    }

    /// The documentation page, when this gallery is embedded in it.
    fn host_root() -> Option<(web_sys::Window, web_sys::Element)> {
        let window = web_sys::window()?;
        let parent = window.parent().ok().flatten()?;
        let parent_js: &JsValue = parent.as_ref();
        let window_js: &JsValue = window.as_ref();
        if parent_js == window_js {
            return None;
        }
        let root = parent.document()?.document_element()?;
        Some((parent, root))
    }

    fn host_is_dark() -> Option<bool> {
        host_root().map(|(_, root)| root.class_list().contains("dark"))
    }

    /// Copy the page's computed theme tokens into `Theme`. Every component
    /// reads those tokens, so the gallery follows the navbar palette.
    pub(crate) fn apply_host_palette(gallery: &Gallery) {
        let Some((parent, root)) = host_root() else {
            return;
        };
        let theme = gallery.global::<Theme>();
        let dark = root.class_list().contains("dark");
        theme.set_dark(dark);
        let Some(style) = parent.get_computed_style(&root).ok().flatten() else {
            theme.set_palette(false);
            return;
        };
        let color = |name: &str| {
            style
                .get_property_value(name)
                .ok()
                .and_then(|value| parse_css_color(&value))
        };
        let Some(background) = color("--background") else {
            theme.set_palette(false);
            return;
        };
        let Some(foreground) = color("--foreground") else {
            theme.set_palette(false);
            return;
        };
        let assign = |value: Option<slint::Color>, fallback: slint::Color| value.unwrap_or(fallback);
        theme.set_palette_background(background);
        theme.set_palette_foreground(foreground);
        theme.set_palette_surface(assign(color("--card"), background));
        theme.set_palette_primary(assign(color("--primary"), foreground));
        theme.set_palette_primary_foreground(assign(color("--primary-foreground"), background));
        theme.set_palette_secondary(assign(color("--secondary"), background));
        theme.set_palette_secondary_foreground(assign(color("--secondary-foreground"), foreground));
        theme.set_palette_muted(assign(color("--muted"), background));
        theme.set_palette_muted_foreground(assign(color("--muted-foreground"), foreground));
        theme.set_palette_accent(assign(color("--accent"), background));
        theme.set_palette_accent_foreground(assign(color("--accent-foreground"), foreground));
        theme.set_palette_destructive(assign(color("--destructive"), theme.get_destructive()));
        theme.set_palette_border(assign(color("--border"), foreground));
        theme.set_palette_input(assign(color("--input"), foreground));
        theme.set_palette_ring(assign(color("--ring"), foreground));
        theme.set_palette_selection(assign(color("--selection"), theme.get_selection()));
        theme.set_palette_info(assign(color("--data-1"), theme.get_info()));
        theme.set_palette_success(assign(color("--success"), theme.get_success()));
        theme.set_palette_warning(assign(color("--warning"), theme.get_warning()));
        theme.set_palette_chart_1(assign(color("--data-1"), theme.get_chart_1()));
        theme.set_palette_chart_2(assign(color("--data-2"), theme.get_chart_2()));
        theme.set_palette_chart_3(assign(color("--data-3"), theme.get_chart_3()));
        theme.set_palette_chart_4(assign(color("--data-4"), theme.get_chart_4()));
        theme.set_palette_chart_5(assign(color("--data-5"), theme.get_chart_5()));
        theme.set_palette_popover(assign(color("--popover"), background));
        theme.set_palette_sidebar(assign(color("--sidebar"), background));
        theme.set_palette(true);
        paint_page(background, foreground);
    }

    /// Follow the embedding page when the reader picks another theme.
    pub(crate) fn follow_site_theme(gallery: slint::Weak<Gallery>) {
        let Some((_, root)) = host_root() else {
            return;
        };
        let listener = Closure::<dyn FnMut(js_sys::Array, web_sys::MutationObserver)>::new(
            move |_: js_sys::Array, _: web_sys::MutationObserver| {
                if let Some(gallery) = gallery.upgrade() {
                    apply_host_palette(&gallery);
                }
            },
        );
        let observer = web_sys::MutationObserver::new(listener.as_ref().unchecked_ref())
            .expect("theme observer");
        let _ = observer.observe_with_options(
            &root,
            web_sys::MutationObserverInit::new().attributes(true),
        );
        std::mem::forget(observer);
        listener.forget();
    }

    fn paint_page(background: slint::Color, foreground: slint::Color) {
        let Some(document) = web_sys::window().and_then(|window| window.document()) else {
            return;
        };
        let Some(html) = document
            .document_element()
            .and_then(|element| element.dyn_into::<web_sys::HtmlElement>().ok())
        else {
            return;
        };
        let style = html.style();
        let _ = style.set_property("background-color", &css_color(background));
        let _ = style.set_property("color", &css_color(foreground));
    }

    fn css_color(color: slint::Color) -> String {
        format!(
            "rgb({}, {}, {})",
            color.red(),
            color.green(),
            color.blue()
        )
    }

    fn parse_css_color(value: &str) -> Option<slint::Color> {
        let value = value.trim();
        if let Some(hex) = value.strip_prefix('#') {
            return parse_hex(hex);
        }
        let inner = value
            .strip_prefix("rgba(")
            .or_else(|| value.strip_prefix("rgb("))?
            .trim_end_matches(')')
            .trim();
        let parts: Vec<&str> = if inner.contains(',') {
            inner.split(',').map(str::trim).collect()
        } else {
            inner.split_whitespace().collect()
        };
        if parts.len() < 3 {
            return None;
        }
        let channel = |text: &str| text.parse::<u8>().ok();
        Some(slint::Color::from_argb_u8(
            255,
            channel(parts[0])?,
            channel(parts[1])?,
            channel(parts[2])?,
        ))
    }

    fn parse_hex(hex: &str) -> Option<slint::Color> {
        let hex = hex.trim();
        let byte = |index: usize| u8::from_str_radix(&hex[index..index + 2], 16).ok();
        match hex.len() {
            6 => Some(slint::Color::from_argb_u8(255, byte(0)?, byte(2)?, byte(4)?)),
            8 => Some(slint::Color::from_argb_u8(byte(6)?, byte(0)?, byte(2)?, byte(4)?)),
            _ => None,
        }
    }

    /// The iframe's size. `None` before the document has a real frame.
    fn frame_size() -> Option<(f32, f32)> {
        let browser = web_sys::window()?;
        let width = browser
            .inner_width()
            .ok()
            .and_then(|value| value.as_f64())? as f32;
        let height = browser
            .inner_height()
            .ok()
            .and_then(|value| value.as_f64())? as f32;
        if width < 1.0 || height < 1.0 {
            return None;
        }
        Some((width, height))
    }

    /// Size the Slint window to the iframe. Creating the browser window applies
    /// the preferred 800px size again, so this has to win after that.
    pub(crate) fn sync_to_frame(gallery: &Gallery) {
        let Some((width, height)) = frame_size() else {
            return;
        };
        let window = gallery.window();
        let current = window.size().to_logical(window.scale_factor());
        if (current.width - width).abs() >= 1.0 || (current.height - height).abs() >= 1.0 {
            window.set_size(slint::LogicalSize::new(width, height));
        }
        let theme = gallery.global::<Theme>();
        if (theme.get_viewport() - width).abs() >= 1.0 {
            theme.set_viewport(width);
        }
    }

    /// Slint sizes the canvas to the window's preferred size; the gallery
    /// instead fills its frame and follows it as the frame resizes.
    pub(crate) fn fill_viewport(gallery: slint::Weak<Gallery>) {
        let Some(window) = web_sys::window() else {
            return;
        };
        let fit = move || {
            if let Some(gallery) = gallery.upgrade() {
                sync_to_frame(&gallery);
            }
        };
        fit();
        // The browser window is created once the event loop starts, and
        // creating it applies the preferred width again. Retry past that.
        for delay in [
            std::time::Duration::ZERO,
            std::time::Duration::from_millis(32),
            std::time::Duration::from_millis(120),
        ] {
            slint::Timer::single_shot(delay, fit.clone());
        }
        let listener = Closure::<dyn FnMut()>::new(fit);
        let _ =
            window.add_event_listener_with_callback("resize", listener.as_ref().unchecked_ref());
        listener.forget();
    }

    /// Posts the example whose code button was pressed.
    pub(crate) fn bridge_examples(gallery: &crate::Gallery) {
        gallery
            .global::<crate::ExampleBridge>()
            .on_show(move |index, title| {
                if index < 0 {
                    return;
                }
                let _ = post_example(index as usize, title.as_str());
            });
    }

    fn post_example(index: usize, title: &str) -> Option<()> {
        let window = web_sys::window()?;
        let parent = window.parent().ok().flatten()?;
        let parent_js: &JsValue = parent.as_ref();
        let window_js: &JsValue = window.as_ref();
        if parent_js == window_js {
            return None;
        }
        let origin = window.location().origin().ok()?;
        let payload = format!(
            r#"{{"source":"gpui-kit","index":{index},"title":{}}}"#,
            json_string(title)
        );
        let _ = parent.post_message(&JsValue::from_str(&payload), &origin);
        Some(())
    }

    fn json_string(value: &str) -> String {
        let mut out = String::from("\"");
        for ch in value.chars() {
            match ch {
                '"' => out.push_str("\\\""),
                '\\' => out.push_str("\\\\"),
                '\n' => out.push_str("\\n"),
                '\r' => out.push_str("\\r"),
                ch => out.push(ch),
            }
        }
        out.push('"');
        out
    }

    pub(crate) fn component_from_url() -> String {
        web_sys::window()
            .and_then(|window| window.location().search().ok())
            .and_then(|search| {
                search
                    .trim_start_matches('?')
                    .split('&')
                    .find_map(|pair| pair.strip_prefix("component=").map(str::to_owned))
            })
            .unwrap_or_else(|| "button".to_owned())
    }

    #[wasm_bindgen(start)]
    pub fn start() {
        console_error_panic_hook::set_once();
        if let Err(error) = crate::run(&component_from_url(), site_prefers_dark()) {
            web_sys::console::error_1(&error.to_string().into());
        }
    }
}
