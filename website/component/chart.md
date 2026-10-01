---
title: Chart
description: Beautiful charts and graphs for data visualization including line, bar, area, pie, radar, candlestick, and sankey charts.
---

# Chart

A comprehensive charting library providing Line, Bar, Area, Pie, Radar, Candlestick, and Sankey charts for data visualization. The charts feature smooth animations, customizable styling, tooltips, legends, and automatic theming that adapts to your application's theme.

## Import

```rust
use gpui_kit::component::chart::{
    LineChart, BarChart, AreaChart, PieChart, RadarChart, CandlestickChart, SankeyChart,
};
```

## Usage

Each sample under Chart Types is a chart the gallery is already running. The heading is the chart type and the subtitle on that card. The code is the source of that card, so the sample is the example on screen.

## Chart Types

### LineChart

A line chart displays data points connected by straight line segments, perfect for showing trends over time.

#### Tick Control

`LineChart` also takes `y_domain` and `point_count`; see Pinned Axis and
Unfinished Series under AreaChart.

#### Axes and Guides

`LineChart` and `AreaChart` share these. `y_axis` shows tick labels at the y ticks, in a gutter left of the plot by default, which widens to fit the widest label, or over the plot with `y_axis_label_placement(AxisLabelPlacement::Inside)`. `y_tick_count` sets how many ticks there are, evenly spaced from the baseline to the top edge with both ends included; they place the horizontal grid lines too, and each label reads the value the scale puts at its height. The default of 5 is the grid the charts have always drawn. `y_tick_format` writes the label text from that value.

`x_tick_count` labels only that many x values, spread evenly from the first to the last, instead of every `tick_margin`-th; with `point_count` set they spread over every point the axis is laid out for, so they stay put as the data grows. `grid_columns` adds vertical grid lines, `grid_dashed(false)` draws the grid solid, `reference_line` marks a value with a dashed line across the plot, drawn darker than the grid, and `y_padding` sets the space kept above the highest value and below the lowest, 10px and 0 by default.

### BarChart

A bar chart uses rectangular bars to show comparisons among categories. Bars can be oriented vertically or horizontally via the `alignment` option.

#### Bar Chart Gradient Fills

For gradient fills aligned to the bar's orientation, use `fill_gradient`. The closure receives the datum, the chart's full data range, and a `chart_to_bar` helper that maps a chart-value coordinate to a bar-local gradient position (`0.0` is the bar's base, `1.0` is its tip). The gradient angle is derived from the bar's `BarAlignment` so stop-0 sits at the base and stop-1 at the tip.

`fill` and `fill_gradient` are mutually exclusive — setting one clears the other.

#### Bar Chart Alignment

`BarAlignment` controls the bar orientation and the side where the baseline sits. Import it from `gpui_kit::component::plot::shape`.

#### Bar Chart Corner Radii

Round the bar rectangles. Pass any value convertible into `Corners<Pixels>` —
use a single `px(..)` for uniform rounding, or construct `Corners` manually to
round only specific corners (e.g. just the tip end of each bar).

#### Bar Chart Negative Values

Bars grow from zero rather than from the edge of the plot, so negative values
extend to the opposite side of the zero line. The band-axis line follows zero,
and each category label moves to whichever side its own bar leaves empty. No
configuration is needed — a data set containing negative values renders this way.

#### Bar Chart Value Axis

Show tick labels for the value scale with `value_axis`, and set how many ticks it
carries with `value_tick_count`. The ticks are evenly spaced from the baseline to
the far edge with both ends included, and drive both the grid lines and the tick
labels, so the two always agree. `tick_margin`, by contrast, is a stride over the
band-axis categories: `tick_margin(2)` keeps every second category label.

`value_axis_label_placement(AxisLabelPlacement::Inside)` draws the labels over the plot beside their grid lines, so the bars keep the room a gutter would take, and `value_tick_format` writes their text. `band_count` lays the band axis out for more bands than there is data, so a short series keeps each bar's width and fills only the leading bands. `band_tick_count` labels only that many bands, spread evenly from the first to the last (over every band when `band_count` is set), and `grid_dashed(false)` draws the grid solid.

#### Bar Chart Labels and Spacing

`label_color` colors each bar's `label` text, so a count can take its bar's color instead of the foreground. `padding_inner` and `padding_outer` set the gap between bars and before the first and after the last, as shares of a band; they default to 0.4 and 0.2. `min_length` draws every bar at least that many pixels long, so an empty bucket still shows a stub on the baseline.

A stub grows the way its bar's value would: away from the zero line, to the negative side for a negative value and to the positive side for zero. Vertical bars with a `label` keep a line of text clear above the tallest bar, so its label stays inside the chart.

### AreaChart

An area chart displays quantitative data visually, similar to a line chart but with the area below the line filled.

#### Pinned Axis and Unfinished Series

By default the y axis fits the data from zero. `y_domain` pins it to a range instead, so a price or a balance that never nears zero is not pressed flat against the top. `point_count` lays the x axis out for more points than the data has, so a series still in progress, such as today's intraday prices, fills only the leading part. `LineChart` takes both as well.

A pinned range keeps the 10px of headroom the default leaves above the highest value, and the series are clipped to the plot, so a value outside the range stops at its edge. Nothing is drawn when `min` equals `max`, so widen a flat series before passing it in. A natural curve can swing past its highest and lowest points; prefer `linear` when the range is fitted tightly to the data.

The i-th item of data sits on the i-th point, so the data has to be contiguous from the first point: a missing item shifts every later one a point to the left.

### PieChart

A pie chart displays data as slices of a circular chart, ideal for showing proportions.

### RadarChart

A radar chart displays multivariate data as closed polygons around a center, ideal for comparing multiple series across several dimensions.

#### Element Labels

`label` accepts either a string or a custom element. Return
`element.into_any_element()` to render anything you like around the outer ring —
an icon, several lines, per-dimension colors.

Each label is measured at its natural size and pushed radially outward from its
dimension, so even a tall one clears the outer ring. Element labels style
themselves, so `.label_color()` does not apply to them, and they supply no
tooltip title (a string label does).

The ring is not shrunk to make room: the default outer radius is 40% of the
chart's height, so a label much taller than a line of text needs a smaller
`.outer_radius()` to keep it inside the chart's bounds.

### CandlestickChart

A candlestick chart displays financial data using OHLC (Open, High, Low, Close) values, perfect for visualizing stock prices and market trends.

#### Candlestick Chart Colors

A candle that closed above its open is drawn in the theme's `chart.bullish` color and one that closed at or below it in `chart.bearish`. Markets that read a rise as red swap them:

### SankeyChart

A sankey diagram visualizes flows between nodes, ideal for financial statements, energy flows, and traffic analysis. The layout algorithm mirrors [d3-sankey](https://github.com/d3/d3-sankey).

#### Basic Sankey Chart

The value label is drawn above the name label. Its closure receives the node's computed throughput (the larger of incoming and outgoing flow).

#### Sankey Chart Styling

Link ribbons are filled with a horizontal gradient from the source node color to the target node color.

#### Custom Labels

For full control over the label lines, use `labels` — one `SankeyLabel` per line, top to bottom, each with its own color and font size. It takes precedence over `node_label`/`value_label` when set. For example, a financial-statement label with a year-over-year change line:

Line color defaults to the theme foreground and font size to 10; the chart keeps handling placement, alignment and margin reservation. A first/last-column label wider than its reserved margin is truncated with a trailing ellipsis rather than drawn outside the plot, so break or shorten long labels yourself if you want the full text on multiple lines.

#### Compressing Large Value Ranges

Node heights are linear in flow value by default, so a large value range (e.g. 200:1) leaves the small flows nearly invisible and the dominant flow oversized. Set `value_scale(SankeyValueScale::Sqrt)` to compress the range — the component sizes nodes by the square root of the value, so small flows stay visible without pre-transforming the data, and labels still receive the raw values:

Every node stays exactly filled by its ribbons under either scale, so children always match their parent's height.

## Hover and Tooltips

Every chart hit-tests the cursor, shows a tooltip for the datum under it, and emphasizes that datum the way the chart's kind calls for. Nothing opts in:

```rust
LineChart::new(data)
    .x(|d| d.date.clone())
    .y(|d| d.value)
    .name("Desktop") // The series name in the tooltip row
```

| Chart | On hover |
| --- | --- |
| `LineChart`, `AreaChart` | A crosshair and a dot per series glide along the line to the hovered point; the dot grows a halo. |
| `BarChart` | A highlight band the width of a bar slides to the hovered bar, and the other bars fade behind it. |
| `PieChart` | The hovered slice lifts out of the ring and the others fade; the tooltip shows the value and its share, via `tooltip_value` if one is set. |
| `RadarChart` | A dot per series glides along the polygon to the hovered spoke. |
| `CandlestickChart` | A highlight band slides to the hovered candle; the tooltip lists open, high, low and close. |
| `SankeyChart` | The links of the hovered node keep their color while the rest fade; the tooltip shows the node's name and throughput, via `tooltip_name` / `tooltip_value` if set. |

The tooltip box follows the cursor, flipping toward the center of the plot near each edge. `AreaChart` and `RadarChart` take one `.name()` per series, called after the matching `.y()` / `.value()`.

A tooltip row reads as a swatch, a name and a value. `PieChart::tooltip_name` and `SankeyChart::tooltip_name` set that name from the datum under the cursor — the slice's name, the node's name — which for a chart showing one number per datum is what the row wants. Unset, a pie falls back to `name`, the single name the whole series carries, and a sankey's row carries no name at all: a swatch and a number with a gap between them.

`name` cannot stand in for it. It says what the numbers measure, the same for every slice, so it can never say which slice the tooltip is about. Titling the tooltip from `label` cannot either, since `label` also draws the leader lines around the ring, and a sankey's `node_label` likewise writes beside the node.

`PieChart::tooltip_value` replaces the text of its row, which the default writes as the raw value and its share. Set it wherever the raw number is not what a reader should see — a value that is already a ratio reads as `0.35 (35.0%)` otherwise, and a chart drawn from adjusted values, such as a floor that keeps a hairline slice visible, would report the adjustment as though it were the datum:

```rust
PieChart::new(holdings)
    .value(|d| d.ratio.max(MIN_VISIBLE))     // Drawn with a floor
    .tooltip_name(|d| d.name.clone())        // Named without leader lines
    .tooltip_value(|d, _, _| pct(d.ratio))   // Read as it truly is
```

### Tooltip Content

`LineChart`, `AreaChart`, `BarChart`, `RadarChart` and `CandlestickChart` title their tooltip with the hovered x, band or dimension value and write each row's value as the raw number. `tooltip_title` and `tooltip_value` replace that text from the datum under the cursor, and `tooltip_value_color` colors each row's value, such as green or red by its sign. Both closures receive the datum and the value the row reads; on `AreaChart`, `RadarChart` and `CandlestickChart`, which show several rows, they also receive the row's index between the two — the series in the order they were added, or open, high, low and close for a candlestick:

```rust
BarChart::new(flows)
    .band(|d| d.month.clone())
    .value(|d| d.net)
    .tooltip_title(|d| format!("{} 2025", d.month).into())
    .tooltip_value(|_, value| format!("${value:.2}").into())
    .tooltip_value_color(move |_, value| if value >= 0. { gain } else { loss })
```

For a layout the title and rows cannot express, such as a table, `tooltip_content` draws the box's content from the datum. The chart's hover marks — crosshair, dots, highlight band — and where the box sits stay the chart's, and the three text options no longer apply:

```rust
AreaChart::new(data)
    .x(|d| d.month.clone())
    .y(|d| d.last_year)
    .y(|d| d.revenue)
    .tooltip_content(|d, _, _| {
        v_flex()
            .child(d.month.clone())
            .child(format!("2025: {}", d.revenue))
            .child(format!("2024: {}", d.last_year))
    })
```

### Identity

All of it is keyed on an `ElementId`, which a chart takes from the source location it was constructed at — unique for a chart written out once, which is nearly every chart. Where one construction site renders several charts as siblings, name them apart, or they share one hover state and one cache:

```rust
shares.iter().enumerate().map(|(i, share)| PieChart::new(share.clone()).id(("share", i)))
```

A `GlobalElementId` is the whole id stack, so siblings that already carry an id of their own — rows drawn by `List` or `uniform_list`, say — separate the charts beneath them without help.

### Turning it off

`interactive(false)` takes the whole layer away, hitbox included, the way Highcharts' `enableMouseTracking` or ECharts' `silent` does. Reach for it in two places: a chart that only decorates, and a chart something else is drawn over:

```rust
AreaChart::new(placeholder).interactive(false) // A skeleton, a thumbnail
AreaChart::new(range).interactive(false)       // A backdrop under drag handles
```

The second matters because a plain hitbox does not block the one behind it: an element painted over an interactive chart is hovered *and so is the chart*, so the crosshair keeps tracking under it. The chart has to stand down.

A chart that is off keeps its id, so it still draws in and keeps its cache.

### Motion

The emphasis is animated with the styled layer's motion tokens (`cx.theme().motion_tokens()`), which the theme projects onto gpui-base as its [`PlotMotion`](../base/plot.md#motion): pointers — crosshair, band, dots — follow the hovered datum on a fast spring, a pie slice lifts on the control spring, and the whole overlay fades in when the cursor lands on a datum and out after it leaves. The motion honors the operating system's reduced-motion preference, under which every value adopts its target at once.

### Appear

The data draws in the first time a chart is painted, over 1000 ms on `easeOutQuart`, Chart.js' default curve: lines, areas, candlesticks and a sankey diagram are revealed from the left the way ECharts, Highcharts and Recharts draw them, bars grow out of the zero line together, a pie sweeps clockwise from its first slice, and a radar grows out of its center. Axes, grid lines and tick labels are there from the first frame, and the tooltip waits until the data is whole.

The appear runs once per id. New data paints in place, so a chart fed live quotes does not draw in again on every tick. To replay it when the chart starts showing something else, such as another symbol or period, hand it a key:

```rust
LineChart::new(candles).appear_key((&symbol, period))
```

A chart that stops being painted forgets its appear, so one in a virtual list draws in again every time it scrolls back into view. Wrap the list in a [`PlotAppearScope`](../base/plot.md#appear-scope) to have each chart draw in once and show whole when it returns; name the scope after what the list shows, such as a conversation or a watchlist, so moving to another one, or closing the view, draws its charts in afresh:

```rust
PlotAppearScope::new(("rows", list_id), list(state, render_row).flex_1())
```

Where a chart should never draw in, turn the appear off:

```rust
LineChart::new(intraday).interactive(false).appear(false)
```

Reduced motion skips the appear.

### Caching

A chart also keeps its heavy geometry across frames, since it repaints on every frame it is on screen: line and area strokes and pie slices stay tessellated while their projected points are unchanged, and a sankey diagram keeps its placement while its data, settings and size are unchanged. This cache hangs off the same id, so charts sharing one share the cache and thrash it — another reason to name siblings apart. A pie or radar being drawn in is a new shape on every frame, so it tessellates afresh until the appear ends.

### Custom Plots

A custom [`Plot`] opts in by hand — `Plot::id` defaults to `None` there. The trait, `PlotElement` and hover tracking come from [gpui-base](../base/plot.md), so a plot written against `gpui_kit::base::plot` works here unchanged. Return an id from `Plot::id`, resolve the datum under the cursor in `Plot::tooltip_state`, and build the overlay in `Plot::tooltip`. To draw in, keep the `PlotAppear` that `Plot::appear` hands over on every frame and paint with its progress. The `Tooltip` returned there animates the hover on its own, the same way the built-in charts do: the whole overlay fades with the hover, the crosshair and dots glide to each hovered datum on the pointer spring, adopting it on the frame the cursor lands, and a dot's `halo` grows as the hover fades in. A crosshair glides along the axis it marks only, so a line that also follows the cursor keeps up with it. Pass the data point itself; the tooltip does the rest:

```rust
fn tooltip(&self, state: &TooltipState, cursor: Point<Pixels>, bounds: Bounds<Pixels>, _: &mut Window, cx: &mut App) -> Option<AnyElement> {
    Some(
        Tooltip::new(cursor, bounds.size)
            .cross_line(CrossLine::new(state.cross_line).band(px(24.)))
            .title("Title")
            .row(cx.theme().chart_1, "Series", "42")
            .into_any_element(),
    )
}
```

A row's value takes a color with `value_color`, which colors the row added last, such as a change by its sign; call it right after that row. `plain_row` adds a row without a swatch, for a figure no series on the plot draws, such as a total or a ratio; beside series rows its label lines up with theirs:

```rust
Tooltip::new(cursor, bounds.size)
    .title("Apr 5")
    .row(desktop, "Desktop", "373")
    .row(mobile, "Mobile", "187")
    .plain_row("Total", "560")
    .plain_row("Change", "+12%")
    .value_color(gain)
```

To emphasize the plot's own graphics as well — fade the bars around the hovered one, lift a slice — implement `Plot::hover`, which runs each frame before `tooltip` and `paint` with the hovered [`PlotHover`]. It carries the `TooltipState` and lingers after the cursor leaves while `hover.progress()` eases back to zero, so sample the motion there and keep the result on `self`. `hover.glide` follows a position on the same spring the tooltip uses; hand the result to the crosshair and turn the tooltip's own glide off with `Tooltip::glide(false)`, so it springs once:

```rust
fn hover(&mut self, hover: Option<&PlotHover>, window: &mut Window, cx: &mut App) {
    self.band_center =
        hover.map(|hover| hover.glide(("my-plot", "band"), hover.state().cross_line.x, window, cx));
}
```

## Data Structures

### Example Data Types

```rust
// Time series data
#[derive(Clone)]
struct DailyDevice {
    pub date: String,
    pub desktop: f64,
    pub mobile: f64,
}

// Category data with styling
#[derive(Clone)]
struct MonthlyDevice {
    pub month: String,
    pub desktop: f64,
    pub color_alpha: f32,
}

impl MonthlyDevice {
    pub fn color(&self, base_color: Hsla) -> Hsla {
        base_color.alpha(self.color_alpha)
    }
}

// Financial data
#[derive(Clone)]
struct StockPrice {
    pub date: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: u64,
}

// Sankey flow: nodes are referenced by index (from gpui_kit::component::plot::shape)
pub struct SankeyLink {
    pub source: usize,
    pub target: usize,
    pub value: f64,
}
```

## Chart Configuration

### Container Setup

```rust
fn chart_container(
    title: &str,
    chart: impl IntoElement,
    center: bool,
    cx: &mut Context<ChartStory>,
) -> impl IntoElement {
    v_flex()
        .flex_1()
        .h_full()
        .border_1()
        .border_color(cx.theme().border)
        .rounded(cx.theme().radius_lg)
        .p_4()
        .child(
            div()
                .when(center, |this| this.text_center())
                .font_semibold()
                .child(title.to_string()),
        )
        .child(
            div()
                .when(center, |this| this.text_center())
                .text_color(cx.theme().muted_foreground)
                .text_sm()
                .child("Data period label"),
        )
        .child(div().flex_1().py_4().child(chart))
        .child(
            div()
                .when(center, |this| this.text_center())
                .font_semibold()
                .text_sm()
                .child("Summary statistic"),
        )
        .child(
            div()
                .when(center, |this| this.text_center())
                .text_color(cx.theme().muted_foreground)
                .text_sm()
                .child("Additional context"),
        )
}
```

### Theme Integration

```rust
// Charts automatically use theme colors
let chart = LineChart::new(data)
    .x(|d| d.date.clone())
    .y(|d| d.value)
    .stroke(cx.theme().chart_1); // Uses theme chart colors

// Available theme chart colors (`chart.1` … `chart.5` in the theme file):
// cx.theme().chart_1 … cx.theme().chart_5
```

## Customization Options

### Color Schemes

```rust
// Theme-based colors (recommended)
LineChart::new(data)
    .x(|d| d.x.clone())
    .y(|d| d.y)
    .stroke(cx.theme().chart_1)

// Custom color palette
let colors = [
    cx.theme().success,
    cx.theme().warning,
    cx.theme().destructive,
    cx.theme().info,
    cx.theme().chart_1,
];

BarChart::new(data)
    .band(|d| d.category.clone())
    .value(|d| d.value)
    .fill(|d, _, _, _| colors[d.category_index % colors.len()])
```

### Responsive Design

```rust
// Container with responsive sizing
div()
    .flex_1()
    .min_h(px(300.))
    .max_h(px(600.))
    .w_full()
    .child(
        LineChart::new(data)
            .x(|d| d.x.clone())
            .y(|d| d.y)
    )
```

### Grid and Axis Styling

Charts automatically include:

- Grid lines with dashed appearance, in the theme's `chart.grid` color (a translucent `border` when a theme leaves it unset)
- X-axis labels with smart positioning
- Y-axis scaling starting from zero
- Responsive tick spacing based on `tick_margin`

## Performance Considerations

### Large Datasets

```rust
// For large datasets, consider data sampling
let sampled_data: Vec<_> = data
    .iter()
    .step_by(5) // Show every 5th point
    .cloned()
    .collect();

LineChart::new(sampled_data)
    .x(|d| d.date.clone())
    .y(|d| d.value)
    .tick_margin(3) // Reduce tick density
```

### Memory Optimization

```rust
// Use efficient data accessors
LineChart::new(data)
    .x(|d| d.date.clone()) // Clone only when necessary
    .y(|d| d.value)        // Direct field access
```

## Integration Examples

### With State Management

```rust
struct ChartComponent {
    data: Vec<DataPoint>,
    chart_type: ChartType,
    time_range: TimeRange,
}

impl ChartComponent {
    fn render_chart(&self, cx: &mut Context<Self>) -> impl IntoElement {
        match self.chart_type {
            ChartType::Line => LineChart::new(self.filtered_data())
                .x(|d| d.date.clone())
                .y(|d| d.value)
                .into_any_element(),
            ChartType::Bar => BarChart::new(self.filtered_data())
                .band(|d| d.date.clone())
                .value(|d| d.value)
                .into_any_element(),
            ChartType::Area => AreaChart::new(self.filtered_data())
                .x(|d| d.date.clone())
                .y(|d| d.value)
                .into_any_element(),
        }
    }

    fn filtered_data(&self) -> Vec<DataPoint> {
        self.data
            .iter()
            .filter(|d| self.time_range.contains(&d.date))
            .cloned()
            .collect()
    }
}
```

### Real-time Updates

```rust
struct LiveChart {
    data: Vec<DataPoint>,
    max_points: usize,
}

impl LiveChart {
    fn add_data_point(&mut self, point: DataPoint) {
        self.data.push(point);
        if self.data.len() > self.max_points {
            self.data.remove(0); // Remove oldest point
        }
    }

    fn render(&self, cx: &mut Context<Self>) -> impl IntoElement {
        LineChart::new(self.data.clone())
            .x(|d| d.timestamp.clone())
            .y(|d| d.value)
            .linear()
            .dot()
    }
}
```

[LineChart]: https://docs.rs/gpui-component/latest/gpui_component/chart/struct.LineChart.html
[BarChart]: https://docs.rs/gpui-component/latest/gpui_component/chart/struct.BarChart.html
[AreaChart]: https://docs.rs/gpui-component/latest/gpui_component/chart/struct.AreaChart.html
[PieChart]: https://docs.rs/gpui-component/latest/gpui_component/chart/struct.PieChart.html
[RadarChart]: https://docs.rs/gpui-component/latest/gpui_component/chart/struct.RadarChart.html
[CandlestickChart]: https://docs.rs/gpui-component/latest/gpui_component/chart/struct.CandlestickChart.html

## API Reference

- [LineChart]
- [BarChart]
- [AreaChart]
- [PieChart]
- [RadarChart]
- [CandlestickChart]
- [SankeyChart]
