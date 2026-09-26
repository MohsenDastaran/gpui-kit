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

    gallery.show()?;
    follow_frame(gallery.as_weak());

    #[cfg(target_arch = "wasm32")]
    {
        web::follow_site_theme(gallery.as_weak());
        web::fill_viewport(gallery.as_weak());
    }

    slint::run_event_loop()
}

/// Rows reflow from `Theme.viewport`, which has to follow the real frame.
/// Slint does not expose a resize callback, so the gallery samples the size.
fn follow_frame(gallery: slint::Weak<Gallery>) {
    let timer = slint::Timer::default();
    timer.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(200), move || {
        let Some(gallery) = gallery.upgrade() else {
            return;
        };
        let window = gallery.window();
        let width = window.size().to_logical(window.scale_factor()).width;
        let theme = gallery.global::<Theme>();
        if (theme.get_viewport() - width).abs() >= 1.0 {
            theme.set_viewport(width);
        }
    });
    Box::leak(Box::new(timer));
}

#[cfg(target_arch = "wasm32")]
mod web {
    use slint::ComponentHandle as _;
    use wasm_bindgen::prelude::*;

    use crate::{Gallery, Theme};

    /// The site stores its theme in `localStorage` under `theme`. The gallery
    /// runs in a same-origin iframe, so a toggle on the page reaches it as a
    /// `storage` event.
    pub(crate) fn site_prefers_dark() -> bool {
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

    pub(crate) fn follow_site_theme(gallery: slint::Weak<Gallery>) {
        let Some(window) = web_sys::window() else {
            return;
        };
        let listener = Closure::<dyn FnMut(web_sys::StorageEvent)>::new(move |event: web_sys::StorageEvent| {
            if event.key().as_deref() != Some("theme") {
                return;
            }
            if let Some(gallery) = gallery.upgrade() {
                gallery.global::<Theme>().set_dark(site_prefers_dark());
            }
        });
        let _ = window.add_event_listener_with_callback("storage", listener.as_ref().unchecked_ref());
        listener.forget();
    }

    /// Slint sizes the canvas to the window's preferred size; the gallery
    /// instead fills its frame and follows it as the frame resizes.
    pub(crate) fn fill_viewport(gallery: slint::Weak<Gallery>) {
        let Some(window) = web_sys::window() else {
            return;
        };
        let fit = move || {
            let Some(browser) = web_sys::window() else {
                return;
            };
            let width = browser.inner_width().ok().and_then(|value| value.as_f64()).unwrap_or(800.0);
            let height = browser.inner_height().ok().and_then(|value| value.as_f64()).unwrap_or(600.0);
            if let Some(gallery) = gallery.upgrade() {
                gallery.window().set_size(slint::LogicalSize::new(width as f32, height as f32));
                gallery.global::<Theme>().set_viewport(width as f32);
            }
        };
        fit();
        // The browser window is created once the event loop starts, and
        // creating it applies the preferred width again.
        slint::Timer::single_shot(std::time::Duration::ZERO, fit.clone());
        let listener = Closure::<dyn FnMut()>::new(fit);
        let _ = window.add_event_listener_with_callback("resize", listener.as_ref().unchecked_ref());
        listener.forget();
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
