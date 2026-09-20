//! Framework-independent design tokens → GPUI `ThemeSet` JSON.

use anyhow::{Context as _, Result, bail};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const GENERATE_USAGE: &str = "Usage: dui tokens generate [--tokens <path>] [--out <path>]";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct DesignTokens {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    pub modes: TokenModes,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct TokenModes {
    pub light: TokenMode,
    pub dark: TokenMode,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct TokenMode {
    pub name: String,
    pub color: ColorTokens,
    pub spacing: SpacingTokens,
    pub radius: RadiusTokens,
    pub typography: TypographyTokens,
    pub shadow: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct ColorTokens {
    pub background: String,
    pub foreground: String,
    pub surface: String,
    pub surface_foreground: String,
    pub primary: String,
    pub primary_foreground: String,
    pub secondary: String,
    pub secondary_foreground: String,
    pub muted: String,
    pub muted_foreground: String,
    pub accent: String,
    pub accent_foreground: String,
    pub destructive: String,
    pub destructive_foreground: String,
    pub border: String,
    pub input: String,
    pub ring: String,
    pub selection: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct SpacingTokens {
    pub xxs: f32,
    pub xs: f32,
    pub sm: f32,
    pub md: f32,
    pub lg: f32,
    pub xl: f32,
    pub xxl: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RadiusTokens {
    pub none: f32,
    pub sm: f32,
    pub md: f32,
    pub lg: f32,
    pub xl: f32,
    pub full: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct TypographyTokens {
    pub sans: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mono: Option<String>,
    pub font_size: f32,
    pub mono_font_size: f32,
    pub xs: TextStyle,
    pub sm: TextStyle,
    pub md: TextStyle,
    pub lg: TextStyle,
    pub xl: TextStyle,
    pub mono_md: TextStyle,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct TextStyle {
    pub size: f32,
    pub line_height: f32,
    pub weight: u16,
}

#[derive(Debug, Serialize)]
struct GpuiThemeSet<'a> {
    name: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    author: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<&'a str>,
    #[serde(rename = "$schema")]
    schema: &'static str,
    themes: Vec<GpuiThemeConfig<'a>>,
}

#[derive(Debug, Serialize)]
struct GpuiThemeConfig<'a> {
    is_default: bool,
    name: &'a str,
    mode: &'static str,
    #[serde(rename = "font.size")]
    font_size: f32,
    #[serde(rename = "font.family")]
    font_family: &'a str,
    #[serde(rename = "mono_font.family", skip_serializing_if = "Option::is_none")]
    mono_font_family: Option<&'a str>,
    #[serde(rename = "mono_font.size")]
    mono_font_size: f32,
    radius: u32,
    #[serde(rename = "radius.lg")]
    radius_lg: u32,
    shadow: bool,
    colors: GpuiThemeColors<'a>,
}

#[derive(Debug, Serialize)]
struct GpuiThemeColors<'a> {
    #[serde(rename = "accent.background")]
    accent: &'a str,
    #[serde(rename = "accent.foreground")]
    accent_foreground: &'a str,
    background: &'a str,
    border: &'a str,
    #[serde(rename = "danger.background")]
    danger: &'a str,
    #[serde(rename = "danger.foreground")]
    danger_foreground: &'a str,
    foreground: &'a str,
    #[serde(rename = "input.border")]
    input: &'a str,
    #[serde(rename = "muted.background")]
    muted: &'a str,
    #[serde(rename = "muted.foreground")]
    muted_foreground: &'a str,
    #[serde(rename = "popover.background")]
    popover: &'a str,
    #[serde(rename = "popover.foreground")]
    popover_foreground: &'a str,
    #[serde(rename = "primary.background")]
    primary: &'a str,
    #[serde(rename = "primary.foreground")]
    primary_foreground: &'a str,
    ring: &'a str,
    #[serde(rename = "secondary.background")]
    secondary: &'a str,
    #[serde(rename = "secondary.foreground")]
    secondary_foreground: &'a str,
    #[serde(rename = "selection.background")]
    selection: &'a str,
}

impl DesignTokens {
    pub fn parse(json: &str) -> Result<Self> {
        serde_json::from_str(json).context("failed to parse tokens.json")
    }

    /// Map independent tokens onto a GPUI `ThemeSet` (same shape as `themes/*.json`).
    pub fn to_gpui_theme_set(&self) -> Result<String> {
        let set = GpuiThemeSet {
            name: &self.name,
            author: self.author.as_deref(),
            url: self.url.as_deref(),
            schema: "https://github.com/longbridge/gpui-kit/raw/refs/heads/main/.theme-schema.json",
            themes: vec![
                gpui_theme(&self.modes.light, "light")?,
                gpui_theme(&self.modes.dark, "dark")?,
            ],
        };
        let mut json = serde_json::to_string_pretty(&set)?;
        json.push('\n');
        Ok(json)
    }
}

fn gpui_theme<'a>(mode: &'a TokenMode, appearance: &'static str) -> Result<GpuiThemeConfig<'a>> {
    Ok(GpuiThemeConfig {
        is_default: true,
        name: &mode.name,
        mode: appearance,
        font_size: mode.typography.font_size,
        font_family: &mode.typography.sans,
        mono_font_family: mode.typography.mono.as_deref(),
        mono_font_size: mode.typography.mono_font_size,
        radius: as_px_u32(mode.radius.md, "radius.md")?,
        radius_lg: as_px_u32(mode.radius.lg, "radius.lg")?,
        shadow: mode.shadow,
        colors: GpuiThemeColors {
            accent: &mode.color.accent,
            accent_foreground: &mode.color.accent_foreground,
            background: &mode.color.background,
            border: &mode.color.border,
            danger: &mode.color.destructive,
            danger_foreground: &mode.color.destructive_foreground,
            foreground: &mode.color.foreground,
            input: &mode.color.input,
            muted: &mode.color.muted,
            muted_foreground: &mode.color.muted_foreground,
            popover: &mode.color.surface,
            popover_foreground: &mode.color.surface_foreground,
            primary: &mode.color.primary,
            primary_foreground: &mode.color.primary_foreground,
            ring: &mode.color.ring,
            secondary: &mode.color.secondary,
            secondary_foreground: &mode.color.secondary_foreground,
            selection: &mode.color.selection,
        },
    })
}

fn as_px_u32(value: f32, field: &str) -> Result<u32> {
    if !(value.is_finite() && value >= 0. && value.fract() == 0.) {
        bail!("{field} must be a non-negative whole pixel value, got {value}");
    }
    Ok(value as u32)
}

pub fn run_generate(args: &[String]) -> Result<()> {
    let mut tokens_path: Option<PathBuf> = None;
    let mut out_path: Option<PathBuf> = None;
    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        match arg.as_str() {
            "--tokens" => {
                let value = rest.next().context("missing path after --tokens")?;
                tokens_path = Some(PathBuf::from(value));
            }
            "--out" => {
                let value = rest.next().context("missing path after --out")?;
                out_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                println!("{GENERATE_USAGE}");
                return Ok(());
            }
            other => bail!("unknown argument {other}\n{GENERATE_USAGE}"),
        }
    }

    let root = find_repo_root()
        .context("could not find workspace root (looked for tokens/tokens.json)")?;
    let tokens_path = tokens_path.unwrap_or_else(|| root.join("tokens/tokens.json"));
    let out_path = out_path.unwrap_or_else(|| root.join("tokens/gpui/default.json"));
    generate_file(&tokens_path, &out_path)?;
    eprintln!("wrote {}", out_path.display());
    Ok(())
}

pub fn generate_file(tokens_path: &Path, out_path: &Path) -> Result<()> {
    let json = std::fs::read_to_string(tokens_path)
        .with_context(|| format!("reading {}", tokens_path.display()))?;
    let tokens = DesignTokens::parse(&json)?;
    let gpui = tokens.to_gpui_theme_set()?;
    if let Some(parent) = out_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating {}", parent.display()))?;
    }
    std::fs::write(out_path, gpui).with_context(|| format!("writing {}", out_path.display()))?;
    Ok(())
}

fn find_repo_root() -> Option<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        dirs.push(cwd);
    }
    if let Ok(manifest) = std::env::var("CARGO_MANIFEST_DIR") {
        let path = PathBuf::from(manifest);
        if let Some(parent) = path.parent() {
            dirs.push(parent.to_path_buf());
        }
        if let Some(parent) = path.parent().and_then(Path::parent) {
            dirs.push(parent.to_path_buf());
        }
    }
    for start in dirs {
        let mut dir = start;
        loop {
            if dir.join("tokens/tokens.json").is_file() && dir.join("Cargo.toml").is_file() {
                return Some(dir);
            }
            if !dir.pop() {
                break;
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOKENS_JSON: &str = include_str!("../../../tokens/tokens.json");

    #[test]
    fn tokens_json_parses() {
        let tokens = DesignTokens::parse(TOKENS_JSON).unwrap();
        assert_eq!(tokens.name, "Default");
        assert_eq!(tokens.modes.light.color.background, "#ffffff");
        assert_eq!(tokens.modes.dark.color.background, "#0a0a0a");
        assert_eq!(tokens.modes.light.radius.md, 6.);
        assert_eq!(tokens.modes.light.typography.font_size, 16.);
    }

    #[test]
    fn generated_gpui_theme_is_a_theme_set() {
        let tokens = DesignTokens::parse(TOKENS_JSON).unwrap();
        let json = tokens.to_gpui_theme_set().unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["name"], "Default");
        let themes = value["themes"].as_array().unwrap();
        assert_eq!(themes.len(), 2);
        assert_eq!(themes[0]["mode"], "light");
        assert_eq!(themes[0]["colors"]["background"], "#ffffff");
        assert_eq!(themes[0]["colors"]["primary.background"], "#171717");
        assert_eq!(themes[0]["colors"]["popover.background"], "#ffffff");
        assert_eq!(themes[0]["colors"]["danger.background"], "#ef4444");
        assert_eq!(themes[0]["radius"], 6);
        assert_eq!(themes[0]["radius.lg"], 8);
        assert_eq!(themes[1]["mode"], "dark");
        assert_eq!(themes[1]["colors"]["background"], "#0a0a0a");
        assert_eq!(themes[1]["colors"]["primary.background"], "#fafafa");
    }

    #[test]
    fn committed_gpui_theme_matches_generation() {
        let tokens = DesignTokens::parse(TOKENS_JSON).unwrap();
        let generated = tokens.to_gpui_theme_set().unwrap();
        let committed = include_str!("../../../tokens/gpui/default.json");
        assert_eq!(
            generated, committed,
            "tokens/gpui/default.json is stale; run `cargo run -p registry-cli -- tokens generate`"
        );
    }
}
