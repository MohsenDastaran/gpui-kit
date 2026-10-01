---
title: Card
description: A bordered content surface with header, body, and footer parts.
---

# Card

Card is a presentational container for grouping related content. Compose [`CardHeader`], [`CardTitle`], [`CardDescription`], [`CardContent`], and [`CardFooter`] inside a [`Card`] — the same part structure as shadcn/ui, using GPUI theme tokens for border, radius, and type.

Use [GroupBox](group-box) when the region is a labeled cluster of controls. Use Card when the region is a content surface with a heading and actions.

## Import

```rust
use gpui_kit::component::card::{
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
};
```

## Usage

### Default

```rust
Card::new()
    .child(
        CardHeader::new()
            .child(CardTitle::new().child("Team"))
            .child(CardDescription::new().child("Invite members and set their roles.")),
    )
    .child(CardContent::new().child("Twelve seats remaining on this workspace."))
    .child(
        CardFooter::new()
            .child(Button::new("cancel").label("Cancel"))
            .child(Button::new("invite").primary().label("Invite")),
    )
```

### Stacked

```rust
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
    )
```

## Parts

- **Card** — bordered surface, padding, and vertical gap.
- **CardHeader** — title and description stack.
- **CardTitle** — primary heading.
- **CardDescription** — supporting copy in the muted foreground.
- **CardContent** — main body.
- **CardFooter** — action row.

All parts implement [`ParentElement`] and [`Styled`], so you can add children and refine layout without a sealed API.

## Copy source

This is a GPUI-target registry component. The CLI copies `crates/component/src/card.rs`. There is no `gpui-base` Card primitive; keep `gpui-base` as the dependency for behavior used by other copied components.
