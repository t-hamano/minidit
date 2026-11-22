//! The settings file, and the window position and size kept in it.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

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
pub fn save_window_state(
    app: AppHandle,
    lock: tauri::State<SettingsLock>,
    bounds: tauri::State<NormalBounds>,
    window: WebviewWindow,
) -> Result<(), String> {
    let _guard = lock.0.lock().unwrap_or_else(|error| error.into_inner());
    let mut settings = load(&app);
    track_normal_bounds(&window, &bounds);
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
    save(&app, &settings)
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

/// Whether enough of the window's top edge is on a screen to drag it, so a
/// window saved on a disconnected screen isn't restored out of reach.
fn is_reachable(state: &WindowState, screens: &[Rect]) -> bool {
    let grab_x = state.x.saturating_add((state.width / 2).min(100) as i32);
    let grab_y = state.y.saturating_add(10);
    screens.iter().any(|screen| screen.contains(grab_x, grab_y))
}

/// Moves and resizes the window to where it was when the app last quit.
pub fn restore_window_state(app: &AppHandle, window: &WebviewWindow) {
    let Some(state) = load(app)
        .get(WINDOW_KEY)
        .and_then(|value| serde_json::from_value::<WindowState>(value.clone()).ok())
    else {
        return;
    };
    if state.width == 0 || state.height == 0 {
        return;
    }
    let screens: Vec<Rect> = window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|monitor| Rect {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
        })
        .collect();
    let _ = window.set_size(PhysicalSize::new(state.width, state.height));
    if is_reachable(&state, &screens) {
        let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
    }
    let bounds = app.state::<NormalBounds>();
    track_normal_bounds(window, &bounds);
    if state.maximized {
        let _ = window.maximize();
    }
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
