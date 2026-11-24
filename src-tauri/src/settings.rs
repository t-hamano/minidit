//! The settings file, and the window position and size kept in it.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::window::Color;
use tauri::{
    AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Theme, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::files;

/// The key of the window position and size. The app's own settings use
/// every other key.
const WINDOW_KEY: &str = "window";

/// Serializes reads and writes of the settings file.
#[derive(Default)]
pub struct SettingsLock(Mutex<()>);

/// The window's latest position and size while it was neither maximized
/// nor minimized, to save when the app quits while it is maximized.
#[derive(Default)]
pub struct NormalBounds(Mutex<Option<WindowState>>);

/// Window position and size in physical pixels.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    #[serde(default)]
    maximized: bool,
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("settings.json"))
        .map_err(|error| error.to_string())
}

/// Parses the settings file. A missing or corrupted file gives no settings,
/// so the defaults are used.
fn parse(contents: &str) -> Map<String, Value> {
    match serde_json::from_str(contents) {
        Ok(Value::Object(map)) => map,
        _ => Map::new(),
    }
}

fn load(app: &AppHandle) -> Map<String, Value> {
    settings_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .map(|contents| parse(&contents))
        .unwrap_or_default()
}

fn save(app: &AppHandle, settings: &Map<String, Value>) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }
    let json = serde_json::to_vec_pretty(settings).map_err(|error| error.to_string())?;
    files::write_atomic(&path, &json)
}

/// Replaces the app's settings, keeping the window state.
fn merge_settings(
    existing: &Map<String, Value>,
    settings: Map<String, Value>,
) -> Map<String, Value> {
    let mut merged = settings;
    merged.remove(WINDOW_KEY);
    if let Some(window) = existing.get(WINDOW_KEY) {
        merged.insert(WINDOW_KEY.into(), window.clone());
    }
    merged
}

/// Reads the app's settings. Values are checked by the frontend.
#[tauri::command]
pub fn read_settings(app: AppHandle, lock: tauri::State<SettingsLock>) -> Map<String, Value> {
    let _guard = lock.0.lock().unwrap_or_else(|error| error.into_inner());
    let mut settings = load(&app);
    settings.remove(WINDOW_KEY);
    settings
}

/// Saves the app's settings.
#[tauri::command]
pub fn write_settings(
    app: AppHandle,
    lock: tauri::State<SettingsLock>,
    settings: Map<String, Value>,
) -> Result<(), String> {
    let _guard = lock.0.lock().unwrap_or_else(|error| error.into_inner());
    let merged = merge_settings(&load(&app), settings);
    save(&app, &merged)
}

/// Saves the window's position and size, to restore on the next launch.
#[tauri::command]
pub fn save_window_state(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    save_window_state_of(&app, &window)
}

/// Saves a window's position and size, to restore on the next launch.
pub fn save_window_state_of(app: &AppHandle, window: &WebviewWindow) -> Result<(), String> {
    let lock = app.state::<SettingsLock>();
    let bounds = app.state::<NormalBounds>();
    let _guard = lock.0.lock().unwrap_or_else(|error| error.into_inner());
    let mut settings = load(app);
    track_normal_bounds(window, &bounds);
    let maximized = window.is_maximized().unwrap_or(false);
    // A maximized window's size is the screen's, so save the size to
    // return to when it is restored.
    let Some(normal) = *bounds.0.lock().unwrap_or_else(|error| error.into_inner()) else {
        return Ok(());
    };
    let state = WindowState {
        maximized,
        ..normal
    };
    settings.insert(
        WINDOW_KEY.into(),
        serde_json::to_value(state).map_err(|error| error.to_string())?,
    );
    save(app, &settings)
}

/// Records the window's position and size unless it is maximized or
/// minimized. Called whenever the window moves or is resized.
pub fn track_normal_bounds(window: &WebviewWindow, bounds: &NormalBounds) {
    if window.is_maximized().unwrap_or(false) || window.is_minimized().unwrap_or(false) {
        return;
    }
    let (Ok(position), Ok(size)) = (window.outer_position(), window.inner_size()) else {
        return;
    };
    *bounds.0.lock().unwrap_or_else(|error| error.into_inner()) = Some(WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized: false,
    });
}

/// A rectangle in physical pixels.
#[derive(Clone, Copy, Debug)]
struct Rect {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

impl Rect {
    fn contains(&self, x: i32, y: i32) -> bool {
        x >= self.x
            && y >= self.y
            && i64::from(x) < i64::from(self.x) + i64::from(self.width)
            && i64::from(y) < i64::from(self.y) + i64::from(self.height)
    }
}

impl From<&Monitor> for Rect {
    fn from(monitor: &Monitor) -> Self {
        Rect {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
        }
    }
}

/// A point near the left of the window's top edge, where it can be dragged.
fn grab_point(state: &WindowState) -> (i32, i32) {
    (
        state.x.saturating_add((state.width / 2).min(100) as i32),
        state.y.saturating_add(10),
    )
}

/// Whether enough of the window's top edge is on a screen to drag it, so a
/// window saved on a disconnected screen isn't restored out of reach.
fn is_reachable(state: &WindowState, screens: &[Rect]) -> bool {
    let (x, y) = grab_point(state);
    screens.iter().any(|screen| screen.contains(x, y))
}

/// The background colors of the page, from `app-theme-provider.tsx`.
const LIGHT_BACKGROUND: Color = Color(0xfc, 0xfc, 0xfc, 0xff);
const DARK_BACKGROUND: Color = Color(0x1e, 0x1e, 0x1e, 0xff);

/// The theme setting, or `None` to follow the OS.
fn theme_setting(settings: &Map<String, Value>) -> Option<Theme> {
    match settings.get("theme").and_then(Value::as_str) {
        Some("light") => Some(Theme::Light),
        Some("dark") => Some(Theme::Dark),
        _ => None,
    }
}

/// Whether Windows is set to dark mode for apps, which the WebView follows.
#[cfg(windows)]
fn system_theme() -> Option<Theme> {
    use windows::core::w;
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};

    let mut value: u32 = 1;
    let mut size = std::mem::size_of::<u32>() as u32;
    let result = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"),
            w!("AppsUseLightTheme"),
            RRF_RT_REG_DWORD,
            None,
            Some(&mut value as *mut u32 as *mut _),
            Some(&mut size),
        )
    };
    result.is_ok().then_some(if value == 0 {
        Theme::Dark
    } else {
        Theme::Light
    })
}

/// macOS fills the window with its own color for the theme.
#[cfg(not(windows))]
fn system_theme() -> Option<Theme> {
    None
}

/// Creates the main window where it was when the app last quit, and shows
/// it right away.
///
/// The window shows before its WebView has started, which takes a few
/// hundred milliseconds on Windows, so it is filled with the page's
/// background color meanwhile. The page gets the settings with the window
/// instead of asking for them, so that it can render as soon as it loads.
pub fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|config| config.label == "main")
        .expect("the main window is configured")
        .clone();
    let mut settings = load(app);
    let state = settings
        .remove(WINDOW_KEY)
        .and_then(|value| serde_json::from_value::<WindowState>(value).ok())
        .filter(|state| state.width > 0 && state.height > 0);
    let theme = theme_setting(&settings);

    let mut builder = WebviewWindowBuilder::from_config(app, &config)?
        .initialization_script(format!(
            "window.__MINIDIT_SETTINGS__ = {};",
            Value::Object(settings)
        ))
        .theme(theme);
    if let Some(theme) = theme.or_else(system_theme) {
        builder = builder.background_color(match theme {
            Theme::Dark => DARK_BACKGROUND,
            _ => LIGHT_BACKGROUND,
        });
    }

    let monitors = app.available_monitors().unwrap_or_default();
    let screens: Vec<Rect> = monitors.iter().map(Rect::from).collect();
    let reachable = state.filter(|state| is_reachable(state, &screens));
    // The builder takes logical pixels, so they are converted with the
    // scale factor of the screen the window opens on, and corrected below.
    if let Some(state) = state {
        let screen = reachable.and_then(|state| {
            let (x, y) = grab_point(&state);
            monitors
                .iter()
                .find(|monitor| Rect::from(*monitor).contains(x, y))
                .cloned()
        });
        let scale = screen
            .or_else(|| app.primary_monitor().ok().flatten())
            .map_or(1.0, |monitor| monitor.scale_factor());
        builder = builder
            .inner_size(
                f64::from(state.width) / scale,
                f64::from(state.height) / scale,
            )
            .maximized(state.maximized);
        if let Some(state) = reachable {
            builder = builder.position(f64::from(state.x) / scale, f64::from(state.y) / scale);
        }
    }

    let window = builder.build()?;
    let bounds = app.state::<NormalBounds>();
    match state {
        // Resizing a maximized window would restore it, so its restored
        // size stays as created.
        Some(state) if state.maximized => {
            *bounds.0.lock().unwrap_or_else(|error| error.into_inner()) = Some(WindowState {
                maximized: false,
                ..state
            });
        }
        _ => {
            if let Some(state) = state {
                let _ = window.set_size(PhysicalSize::new(state.width, state.height));
            }
            if let Some(state) = reachable {
                let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
            }
            track_normal_bounds(&window, &bounds);
        }
    }
    Ok(window)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn corrupted_file_gives_no_settings() {
        assert!(parse("{ not json").is_empty());
        assert!(parse("[1, 2]").is_empty());
        assert!(parse("").is_empty());
        assert_eq!(parse(r#"{"theme":"dark"}"#)["theme"], "dark");
    }

    #[test]
    fn merging_keeps_the_window_state() {
        let existing = parse(r#"{"theme":"dark","window":{"x":1}}"#);
        let settings = parse(r#"{"theme":"light","window":{"x":2}}"#);
        let merged = merge_settings(&existing, settings);
        assert_eq!(
            Value::Object(merged),
            json!({ "theme": "light", "window": { "x": 1 } })
        );
    }

    #[test]
    fn window_must_be_on_a_screen() {
        let screen = Rect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        };
        let state = |x, y| WindowState {
            x,
            y,
            width: 800,
            height: 600,
            maximized: false,
        };
        assert!(is_reachable(&state(100, 100), &[screen]));
        assert!(is_reachable(&state(-50, 0), &[screen]));
        assert!(!is_reachable(&state(2500, 100), &[screen]));
        assert!(!is_reachable(&state(100, -500), &[screen]));
        assert!(!is_reachable(&state(100, 100), &[]));
    }
}
