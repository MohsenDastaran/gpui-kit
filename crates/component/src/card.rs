//! GPUI-target copy source for Card.
//!
//! Presentational container. There is no `gpui-base` Card primitive; layout is
//! the whole behavior. The registry CLI copies this file; it does not copy
//! `gpui-base`.

use gpui::{
    AnyElement, App, IntoElement, ParentElement, RenderOnce, StyleRefinement, Styled, Window,
    relative,
};
use smallvec::SmallVec;

use crate::{ActiveTheme, StyledExt as _, h_flex, v_flex};

/// A bordered content surface with optional header, body, and footer parts.
#[derive(IntoElement)]
pub struct Card {
    style: StyleRefinement,
    children: SmallVec<[AnyElement; 1]>,
}

impl Card {
    /// Create an empty card.
    pub fn new() -> Self {
        Self {
            style: StyleRefinement::default(),
            children: SmallVec::new(),
        }
    }
}

impl Default for Card {
    fn default() -> Self {
        Self::new()
    }
}

impl ParentElement for Card {
    fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
        self.children.extend(elements);
    }
}

impl Styled for Card {
    fn style(&mut self) -> &mut StyleRefinement {
        &mut self.style
    }
}

impl RenderOnce for Card {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        v_flex()
            .w_full()
            .gap_4()
            .p_4()
            .bg(cx.theme().background)
            .text_color(cx.theme().foreground)
            .border_1()
            .border_color(cx.theme().border)
            .rounded(cx.theme().radius)
            .refine_style(&self.style)
            .children(self.children)
    }
}

/// Title and description region of a [`Card`].
#[derive(IntoElement)]
pub struct CardHeader {
    style: StyleRefinement,
    children: Vec<AnyElement>,
}

impl CardHeader {
    /// Create an empty card header.
    pub fn new() -> Self {
        Self {
            style: StyleRefinement::default(),
            children: Vec::new(),
        }
    }
}

impl Default for CardHeader {
    fn default() -> Self {
        Self::new()
    }
}

impl ParentElement for CardHeader {
    fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
        self.children.extend(elements);
    }
}

impl Styled for CardHeader {
    fn style(&mut self) -> &mut StyleRefinement {
        &mut self.style
    }
}

impl RenderOnce for CardHeader {
    fn render(self, _: &mut Window, _: &mut App) -> impl IntoElement {
        v_flex()
            .gap_1()
            .line_height(relative(1.25))
            .refine_style(&self.style)
            .children(self.children)
    }
}

/// Primary heading inside a [`CardHeader`].
#[derive(IntoElement)]
pub struct CardTitle {
    style: StyleRefinement,
    children: Vec<AnyElement>,
}

impl CardTitle {
    /// Create an empty card title.
    pub fn new() -> Self {
        Self {
            style: StyleRefinement::default(),
            children: Vec::new(),
        }
    }
}

impl Default for CardTitle {
    fn default() -> Self {
        Self::new()
    }
}

impl ParentElement for CardTitle {
    fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
        self.children.extend(elements);
    }
}

impl Styled for CardTitle {
    fn style(&mut self) -> &mut StyleRefinement {
        &mut self.style
    }
}

impl RenderOnce for CardTitle {
    fn render(self, _: &mut Window, _: &mut App) -> impl IntoElement {
        v_flex()
            .text_base()
            .font_semibold()
            .line_height(relative(1.25))
            .refine_style(&self.style)
            .children(self.children)
    }
}

/// Supporting copy inside a [`CardHeader`].
#[derive(IntoElement)]
pub struct CardDescription {
    style: StyleRefinement,
    children: Vec<AnyElement>,
}

impl CardDescription {
    /// Create an empty card description.
    pub fn new() -> Self {
        Self {
            style: StyleRefinement::default(),
            children: Vec::new(),
        }
    }
}

impl Default for CardDescription {
    fn default() -> Self {
        Self::new()
    }
}

impl ParentElement for CardDescription {
    fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
        self.children.extend(elements);
    }
}

impl Styled for CardDescription {
    fn style(&mut self) -> &mut StyleRefinement {
        &mut self.style
    }
}

impl RenderOnce for CardDescription {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        v_flex()
            .text_sm()
            .text_color(cx.theme().muted_foreground)
            .refine_style(&self.style)
            .children(self.children)
    }
}

/// Main body of a [`Card`].
#[derive(IntoElement)]
pub struct CardContent {
    style: StyleRefinement,
    children: Vec<AnyElement>,
}

impl CardContent {
    /// Create an empty card body.
    pub fn new() -> Self {
        Self {
            style: StyleRefinement::default(),
            children: Vec::new(),
        }
    }
}

impl Default for CardContent {
    fn default() -> Self {
        Self::new()
    }
}

impl ParentElement for CardContent {
    fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
        self.children.extend(elements);
    }
}

impl Styled for CardContent {
    fn style(&mut self) -> &mut StyleRefinement {
        &mut self.style
    }
}

impl RenderOnce for CardContent {
    fn render(self, _: &mut Window, _: &mut App) -> impl IntoElement {
        v_flex()
            .gap_3()
            .refine_style(&self.style)
            .children(self.children)
    }
}

/// Action row at the bottom of a [`Card`].
#[derive(IntoElement)]
pub struct CardFooter {
    style: StyleRefinement,
    children: Vec<AnyElement>,
}

impl CardFooter {
    /// Create an empty card footer.
    pub fn new() -> Self {
        Self {
            style: StyleRefinement::default(),
            children: Vec::new(),
        }
    }
}

impl Default for CardFooter {
    fn default() -> Self {
        Self::new()
    }
}

impl ParentElement for CardFooter {
    fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
        self.children.extend(elements);
    }
}

impl Styled for CardFooter {
    fn style(&mut self) -> &mut StyleRefinement {
        &mut self.style
    }
}

impl RenderOnce for CardFooter {
    fn render(self, _: &mut Window, _: &mut App) -> impl IntoElement {
        h_flex()
            .gap_2()
            .items_center()
            .refine_style(&self.style)
            .children(self.children)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_card_builder() {
        let _card = Card::new()
            .child(
                CardHeader::new()
                    .child(CardTitle::new().child("Team"))
                    .child(CardDescription::new().child("Manage members of this workspace.")),
            )
            .child(CardContent::new().child("Body"))
            .child(CardFooter::new().child("Actions"));
    }
}
