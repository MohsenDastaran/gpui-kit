//! Forwards a click inside an embedded story to the documentation page.
//!
//! The canvas is one element, so the page cannot see which card was hit. The
//! story records each section's rectangle, and this listener posts the section
//! under the pointer. A drag is left alone so scrolling the gallery does not
//! move the page.

use std::cell::Cell;
use std::rc::Rc;

use wasm_bindgen::JsCast as _;
use wasm_bindgen::prelude::*;

pub fn install() {
    thread_local! {
        static INSTALLED: Cell<bool> = const { Cell::new(false) };
    }
    if INSTALLED.with(|installed| installed.replace(true)) {
        return;
    }
    let Some(window) = web_sys::window() else {
        return;
    };

    let press = Rc::new(Cell::new(None::<(i32, f32, f32)>));
    let down_press = Rc::clone(&press);
    let down =
        Closure::<dyn FnMut(web_sys::PointerEvent)>::new(move |event: web_sys::PointerEvent| {
            if event.button() != 0 {
                return;
            }
            let Some((x, y)) = canvas_point(&event) else {
                return;
            };
            down_press.set(Some((event.pointer_id(), x, y)));
        });
    let up =
        Closure::<dyn FnMut(web_sys::PointerEvent)>::new(move |event: web_sys::PointerEvent| {
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
            let Some((index, title)) = gpui_component_story::example_under_point(x, y) else {
                return;
            };
            post_example(index, &title);
        });
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
