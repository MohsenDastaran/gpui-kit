use gpui_kit::{
    App, AppContext, Context, Entity, Focusable, IntoElement, ParentElement, Render, Styled,
    Window,
};

use gpui_kit::component::{
    button::{Button, ButtonVariants as _},
    card::{Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle},
    h_flex, v_flex,
};

use crate::section;

pub struct CardStory {
    focus_handle: gpui_kit::FocusHandle,
}

impl super::Story for CardStory {
    fn title() -> &'static str {
        "Card"
    }

    fn description() -> &'static str {
        "A bordered content surface with header, body, and footer parts."
    }

    fn new_view(window: &mut Window, cx: &mut App) -> Entity<impl Render> {
        Self::view(window, cx)
    }
}

impl CardStory {
    pub fn view(window: &mut Window, cx: &mut App) -> Entity<Self> {
        cx.new(|cx| Self::new(window, cx))
    }

    fn new(_: &mut Window, cx: &mut Context<Self>) -> Self {
        Self {
            focus_handle: cx.focus_handle(),
        }
    }
}

impl Focusable for CardStory {
    fn focus_handle(&self, _: &gpui_kit::App) -> gpui_kit::FocusHandle {
        self.focus_handle.clone()
    }
}

impl Render for CardStory {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        v_flex()
            .size_full()
            .items_center()
            .gap_6()
            .child(
                section("Default").w_128().child(
                    Card::new()
                        .child(
                            CardHeader::new()
                                .child(CardTitle::new().child("Team"))
                                .child(
                                    CardDescription::new()
                                        .child("Invite members and set their roles."),
                                ),
                        )
                        .child(
                            CardContent::new().child("Twelve seats remaining on this workspace."),
                        )
                        .child(
                            CardFooter::new()
                                .justify_end()
                                .child(Button::new("cancel").label("Cancel"))
                                .child(Button::new("invite").primary().label("Invite")),
                        ),
                ),
            )
            .child(
                section("Stacked").w_128().child(
                    h_flex()
                        .gap_4()
                        .items_start()
                        .child(
                            Card::new()
                                .flex_1()
                                .child(CardHeader::new().child(CardTitle::new().child("Usage")))
                                .child(CardContent::new().child("4.2 GB of 10 GB used.")),
                        )
                        .child(
                            Card::new()
                                .flex_1()
                                .child(CardHeader::new().child(CardTitle::new().child("Plan")))
                                .child(CardContent::new().child("Team · billed monthly.")),
                        ),
                ),
            )
    }
}
