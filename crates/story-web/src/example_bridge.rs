//! Forwards the embedded gallery's code button to the documentation page.

use wasm_bindgen::prelude::*;

pub fn install() {
    gpui_component_story::install_source_button(|index, title| {
        let _ = post_example(index, title);
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
