use gpui_kit::component::{ActiveTheme as _, StyledExt as _, h_flex, v_flex};
use gpui_kit::*;

struct RootBorderlessExample;

impl Render for RootBorderlessExample {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        v_flex()
            .size_full()
            .gap_4()
            .p_8()
            .bg(cx.theme().background)
            .text_color(cx.theme().foreground)
            .child(
                div()
                    .text_2xl()
                    .font_semibold()
                    .child("Client-side decorations"),
            )
            .child(
                div()
                    .max_w(px(560.))
                    .text_color(cx.theme().muted_foreground)
                    .child(
                        "This window requests client-side decorations. gpui_kit::open_window wraps the content in Root, which hosts overlays and applies the standard window border.",
                    ),
            )
            .child(
                h_flex()
                    .gap_3()
                    .child(
                        div()
                            .rounded(cx.theme().radius)
                            .border_1()
                            .border_color(cx.theme().border)
                            .px_3()
                            .py_2()
                            .child("gpui_kit::open_window"),
                    )
                    .child(
                        div()
                            .rounded(cx.theme().radius)
                            .border_1()
                            .border_color(cx.theme().border)
                            .px_3()
                            .py_2()
                            .child("window_decorations = Client"),
                    ),
            )
    }
}

fn main() {
    gpui_kit::application().run(move |cx| {
        gpui_kit::init(cx);

        let window_options = WindowOptions {
            titlebar: None,
            window_bounds: Some(WindowBounds::centered(size(px(640.), px(320.)), cx)),
            window_decorations: Some(WindowDecorations::Client),
            ..Default::default()
        };

        gpui_kit::open_window(window_options, cx, |_, cx| {
            cx.new(|_| RootBorderlessExample)
        })
        .expect("Failed to open window");
    });
}
