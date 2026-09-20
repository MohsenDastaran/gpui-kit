---
title: Card
description: 带页眉、正文和页脚分区的边框内容容器。
---

# Card

Card 是用于组织相关内容的展示型容器。在 [`Card`] 内组合 [`CardHeader`]、[`CardTitle`]、[`CardDescription`]、[`CardContent`] 和 [`CardFooter`] — 与 shadcn/ui 的分区结构相同，边框、圆角和字体使用 GPUI 主题 token。

控件分组请用 [GroupBox](group-box)；需要标题加操作的内容表面时用 Card。

## 导入

```rust
use gpui_kit::component::card::{
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
};
```

## 用法

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

## 分区

- **Card** — 带边框的表面、内边距与纵向间距。
- **CardHeader** — 标题与描述的垂直堆叠。
- **CardTitle** — 主标题。
- **CardDescription** — 使用 muted foreground 的补充说明。
- **CardContent** — 正文。
- **CardFooter** — 操作行。

所有分区都实现 [`ParentElement`] 和 [`Styled`]，可以用 builder 追加子元素并调整布局。

## 拷贝源

这是 GPUI 目标的 registry 组件。CLI 会拷贝 `crates/component/src/card.rs`。没有 `gpui-base` 的 Card 原语；其他被拷贝组件仍把 `gpui-base` 当作行为依赖。
