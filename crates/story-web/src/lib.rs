use std::borrow::Cow;
use std::cell::RefCell;

#[cfg(target_family = "wasm")]
mod example_bridge;

use gpui_component_story::{Gallery, StoryRoot};
use gpui_kit::assets::Assets;
use gpui_kit::component::{
    Root,
    theme::{Theme, ThemeMode, ThemeRegistry},
};
use gpui_kit::{prelude::*, *};
use wasm_bindgen::prelude::*;

thread_local! {
    static APPLICATION: RefCell<Option<ApplicationHandle>> = const { RefCell::new(None) };
    // The page theme to apply. Written as soon as the page changes, and read
    // when the gallery actually starts, which can be after `run` returns.
    static SITE_THEME: RefCell<Option<(Option<String>, bool)>> = const { RefCell::new(None) };
}

/// Applies a theme mode and restores the bundled web fonts.
///
/// `Theme::change` reapplies the theme config, which can carry its own font
/// family; the host system fonts are unavailable in wasm, so the bundled ones
/// are put back afterwards.
fn apply_theme(mode: ThemeMode, cx: &mut App) {
    Theme::change(mode, None, cx);
    Theme::update(cx, |theme| {
        theme.font_family = "Inter Variable".into();
        theme.mono_font_family = "JetBrains Mono".into();
    });
}

/// Applies the documentation page's selected theme.
///
/// A named theme is one of the files the gallery already loaded, so this
/// resolves without a request. Light, dark, and system have no name and use
/// that mode's default theme. The bundled fonts go back on afterwards: a
/// theme file may name a family the browser does not have.
fn remember_site_theme(name: Option<String>, dark: bool) {
    SITE_THEME.with(|slot| *slot.borrow_mut() = Some((name, dark)));
}

fn apply_site_theme(name: Option<&str>, dark: bool, cx: &mut App) {
    let config = name.and_then(|name| {
        let key = SharedString::from(name);
        ThemeRegistry::global(cx).themes().get(&key).cloned()
    });
    if let Some(config) = config {
        Theme::update(cx, |theme| {
            theme.apply_config(&config);
            theme.font_family = "Inter Variable".into();
            theme.mono_font_family = "JetBrains Mono".into();
        });
        return;
    }
    apply_theme(
        if dark {
            ThemeMode::Dark
        } else {
            ThemeMode::Light
        },
        cx,
    );
}

/// Follows the documentation page's theme after the gallery is running.
///
/// `name` is the page's `data-theme-name`. An empty name means the page is on
/// its light, dark, or system theme, and `dark` selects which of those.
#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn set_theme(name: Option<String>, dark: bool) {
    let name = name.filter(|value| !value.is_empty());
    remember_site_theme(name.clone(), dark);
    APPLICATION.with(|application| {
        if let Some(handle) = application.borrow().as_ref() {
            handle.update(|cx| {
                // Graphics startup calls back into the page before the theme
                // registry exists. The remembered theme is applied once it does.
                if cx.has_global::<ThemeRegistry>() {
                    apply_site_theme(name.as_deref(), dark, cx);
                }
            });
        }
    });
}

/// Opens a single-threaded web platform that lets the browser draw the text
/// the bundled fonts cannot.
///
/// The gallery bundles only the glyphs its own source uses, so emoji and
/// anything a visitor types into an input would otherwise render as tofu.
/// `gpui_web` measures and rasterizes such graphemes with Canvas 2D using the
/// visitor's local fonts. Its default policy covers emoji alone; CJK text is
/// opted in here as well, since the bundled Noto Sans SC subset only holds
/// the characters the stories mention. Bundled fonts stay preferred wherever
/// they have the glyph.
#[cfg(target_family = "wasm")]
fn web_application() -> Application {
    use gpui_kit::web::{CanvasFontFallback, WebBackendPreference, WebPlatform};
    use std::rc::Rc;
    use std::sync::Arc;

    let platform = Rc::new(WebPlatform::new_with_backend_and_font_fallback(
        false,
        WebBackendPreference::Auto,
        CanvasFontFallback::EmojiAndCjk,
    ));
    let http_client = Arc::new(platform.fetch_http_client());
    Application::with_platform(platform).with_http_client(http_client)
}

#[wasm_bindgen]
pub fn run(
    story: Option<String>,
    dark: Option<bool>,
    theme: Option<String>,
) -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    #[cfg(target_family = "wasm")]
    if story.is_some() {
        example_bridge::install();
    }

    // Initialize logging to browser console
    console_log::init_with_level(log::Level::Info).expect("Failed to initialize logger");

    // Also initialize tracing for WASM
    tracing_wasm::set_as_global_default();

    #[cfg(target_family = "wasm")]
    gpui_kit::platform::web_init();
    #[cfg(not(target_family = "wasm"))]
    let app = gpui_kit::application();
    #[cfg(target_family = "wasm")]
    let app = web_application();

    let app = app.with_assets(Assets::new("https://gpui-kit.com/gallery/"));
    remember_site_theme(theme.filter(|name| !name.is_empty()), dark == Some(true));
    let launch = move |cx: &mut App| {
        gpui_component_story::init(cx);

        // Load a compact, offline font stack for WASM, where host system fonts
        // are unavailable. Inter gives the UI a neutral system-font feel, while
        // the other fonts contain only glyphs used by the story application.
        // Emoji, and any text outside that set, come from the browser through
        // the Canvas fallback configured in `web_application`.
        let ui_font = Cow::Borrowed(include_bytes!("../fonts/Inter-Regular.ttf").as_slice());
        let cjk_font =
            Cow::Borrowed(include_bytes!("../fonts/NotoSansSC-Regular-subset.ttf").as_slice());
        let jetbrains_mono =
            Cow::Borrowed(include_bytes!("../fonts/JetBrainsMono-Regular.ttf").as_slice());
        // The web platform resolves GPUI's `.SystemUIFont` alias to IBM Plex
        // Sans and ships no fonts of its own. Text measured before the first
        // frame, such as the search input's initial value, still carries the
        // window's default text style, so that family has to exist or the
        // text system panics.
        let system_font =
            Cow::Borrowed(include_bytes!("../fonts/IBMPlexSans-Regular.ttf").as_slice());
        cx.text_system()
            .add_fonts(vec![ui_font, cjk_font, jetbrains_mono, system_font])
            .expect("Failed to load fonts");

        // Apply whatever the page is showing now, including a change that
        // arrived while graphics were still starting. The theme is already in
        // the registry `init` just loaded, so this does not wait on a request.
        let (theme_name, prefers_dark) =
            SITE_THEME.with(|slot| slot.borrow().clone().unwrap_or((None, false)));
        apply_site_theme(theme_name.as_deref(), prefers_dark, cx);

        cx.open_window(WindowOptions::default(), move |window, cx| {
            let embedded = story.is_some();
            let view = match story.as_deref() {
                Some(story) => Gallery::embedded_view(story, window, cx),
                None => Gallery::view(None, window, cx),
            };
            let story_root = cx.new(|cx| {
                if embedded {
                    StoryRoot::embedded(view, window, cx)
                } else {
                    StoryRoot::new("GPUI Component", view, window, cx)
                }
            });
            cx.new(|cx| Root::new(story_root, window, cx))
        })
        .expect("Failed to open window");
        cx.activate(true);
    };

    #[cfg(target_family = "wasm")]
    APPLICATION.with(|application| {
        *application.borrow_mut() = Some(app.run_embedded(launch));
    });
    #[cfg(not(target_family = "wasm"))]
    app.run(launch);

    Ok(())
}
