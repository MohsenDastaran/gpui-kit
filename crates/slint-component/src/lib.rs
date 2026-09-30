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
        let listener = Closure::<dyn FnMut(web_sys::StorageEvent)>::new(
            move |event: web_sys::StorageEvent| {
                if event.key().as_deref() != Some("theme") {
                    return;
                }
                if let Some(gallery) = gallery.upgrade() {
                    gallery.global::<Theme>().set_dark(site_prefers_dark());
                }
            },
        );
        let _ =
            window.add_event_listener_with_callback("storage", listener.as_ref().unchecked_ref());
        listener.forget();
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

    struct Card {
        id: i32,
        index: usize,
        title: String,
        x: f32,
        y: f32,
        width: f32,
        height: f32,
    }

    /// Subscribes to card rectangles and posts the card under a click to the
    /// embedding page. A drag, such as scrolling the gallery, is not a click.
    pub(crate) fn bridge_examples(gallery: &crate::Gallery) {
        use std::cell::{Cell, RefCell};
        use std::rc::Rc;
        use wasm_bindgen::JsCast as _;

        let cards = Rc::new(RefCell::new(Vec::<Card>::new()));
        let reported = Rc::clone(&cards);
        gallery.global::<crate::ExampleBridge>().on_report(
            move |id, title, x, y, width, height| {
                remember(&reported, id, title.as_str(), x, y, width, height);
            },
        );

        let Some(window) = web_sys::window() else {
            return;
        };
        let press = Rc::new(Cell::new(None::<(i32, f32, f32)>));
        let down_press = Rc::clone(&press);
        let down = Closure::<dyn FnMut(web_sys::PointerEvent)>::new(
            move |event: web_sys::PointerEvent| {
                if event.button() != 0 {
                    return;
                }
                let Some((x, y)) = canvas_point(&event) else {
                    return;
                };
                down_press.set(Some((event.pointer_id(), x, y)));
            },
        );
        let up = Closure::<dyn FnMut(web_sys::PointerEvent)>::new(
            move |event: web_sys::PointerEvent| {
                let Some((id, x0, y0)) = press.take() else {
                    return;
                };
                if event.pointer_id() != id {
                    return;
                }
                let Some((x, y)) = canvas_point(&event) else {
                    return;
                };
                let dx = x - x0;
                let dy = y - y0;
                if dx * dx + dy * dy > 64.0 {
                    return;
                }
                let Some((index, title)) = card_at(&cards.borrow(), x, y) else {
                    return;
                };
                post_example(index, &title);
            },
        );
        let _ = window.add_event_listener_with_callback_and_bool(
            "pointerdown",
            down.as_ref().unchecked_ref(),
            true,
        );
        let _ = window.add_event_listener_with_callback_and_bool(
            "pointerup",
            up.as_ref().unchecked_ref(),
            true,
        );
        down.forget();
        up.forget();
    }

    fn remember(
        cards: &std::cell::RefCell<Vec<Card>>,
        id: i32,
        title: &str,
        x: f32,
        y: f32,
        width: f32,
        height: f32,
    ) {
        if id < 0 || title.is_empty() || width < 1.0 || height < 1.0 {
            return;
        }
        let mut cards = cards.borrow_mut();
        if let Some(card) = cards.iter_mut().find(|card| card.id == id) {
            card.title = title.to_owned();
            card.x = x;
            card.y = y;
            card.width = width;
            card.height = height;
            return;
        }
        let index = cards.len();
        cards.push(Card {
            id,
            index,
            title: title.to_owned(),
            x,
            y,
            width,
            height,
        });
    }

    fn card_at(cards: &[Card], x: f32, y: f32) -> Option<(usize, String)> {
        cards
            .iter()
            .filter(|card| {
                x >= card.x && y >= card.y && x < card.x + card.width && y < card.y + card.height
            })
            .max_by(|left, right| {
                (left.width * left.height).total_cmp(&(right.width * right.height))
            })
            .map(|card| (card.index, card.title.clone()))
    }

    fn canvas_point(event: &web_sys::PointerEvent) -> Option<(f32, f32)> {
        let canvas = web_sys::window()?
            .document()?
            .query_selector("canvas")
            .ok()
            .flatten()?;
        let rect = canvas.get_bounding_client_rect();
        Some((
            event.client_x() as f32 - rect.x() as f32,
            event.client_y() as f32 - rect.y() as f32,
        ))
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
