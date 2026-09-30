//! Which example card is under a pointer in the embedded gallery.
//!
//! The website frame cannot see into the canvas. Each section records its
//! window rectangle while it paints, and the web host asks which one contains
//! a click.

use std::cell::{Cell, RefCell};

use gpui_kit::{Bounds, Pixels, SharedString, point, px};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Phase {
    Paint,
    Render,
}

struct Hit {
    index: usize,
    title: SharedString,
    bounds: Bounds<Pixels>,
}

thread_local! {
    static PHASE: Cell<Phase> = const { Cell::new(Phase::Paint) };
    static NEXT: Cell<usize> = const { Cell::new(0) };
    static RESET: Cell<bool> = const { Cell::new(false) };
    static HITS: RefCell<Vec<Hit>> = const { RefCell::new(Vec::new()) };
}

/// The next section index for this frame, starting again at zero when a new
/// render begins after paint.
pub(crate) fn note_section() -> usize {
    if PHASE.get() != Phase::Render {
        NEXT.set(0);
        RESET.set(true);
        PHASE.set(Phase::Render);
    }
    let index = NEXT.get();
    NEXT.set(index + 1);
    index
}

/// Stores the painted bounds of a section. Nested cards stay in the list; the
/// lookup keeps the largest one that contains the pointer.
pub(crate) fn place(index: usize, title: SharedString, bounds: Bounds<Pixels>) {
    PHASE.set(Phase::Paint);
    HITS.with(|hits| {
        let mut hits = hits.borrow_mut();
        if RESET.with(Cell::get) {
            hits.clear();
            RESET.set(false);
        }
        if let Some(hit) = hits.iter_mut().find(|hit| hit.index == index) {
            hit.title = title;
            hit.bounds = bounds;
            return;
        }
        hits.push(Hit {
            index,
            title,
            bounds,
        });
    });
}

/// The example under a window point, in CSS pixels. `None` when the point is
/// in the gap between cards.
pub fn example_under_point(x: f32, y: f32) -> Option<(usize, String)> {
    let point = point(px(x), px(y));
    HITS.with(|hits| {
        let hits = hits.borrow();
        hits.iter()
            .filter(|hit| hit.bounds.contains(&point) && !hit.title.is_empty())
            .max_by(|left, right| area(&left.bounds).total_cmp(&area(&right.bounds)))
            .map(|hit| (hit.index, hit.title.to_string()))
    })
}

fn area(bounds: &Bounds<Pixels>) -> f32 {
    f32::from(bounds.size.width) * f32::from(bounds.size.height)
}
