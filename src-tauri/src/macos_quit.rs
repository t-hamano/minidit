//! Asks about unsaved changes when macOS quits the app from outside its
//! menu, such as from the Dock, or when the user logs out or shuts down.
//!
//! The window's event loop doesn't let the app stop macOS from quitting,
//! so the app delegate gets an `applicationShouldTerminate:` method. With
//! no unsaved changes, it saves the window state and lets macOS quit, so
//! logging out isn't interrupted. Otherwise it cancels the quit, brings the
//! window to the front, and asks the window to quit the same way as Quit
//! Minidit in the menu.

use std::sync::OnceLock;

use objc2::ffi::class_addMethod;
use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{sel, MainThreadMarker};
use objc2_app_kit::NSApplication;
use tauri::{AppHandle, Emitter, Manager};

use crate::{open_files, settings, UnsavedChanges};

pub const QUIT_REQUESTED_EVENT: &str = "quit-requested";

/// `NSTerminateCancel`.
const TERMINATE_CANCEL: usize = 0;
/// `NSTerminateNow`.
const TERMINATE_NOW: usize = 1;

static APP: OnceLock<AppHandle> = OnceLock::new();

extern "C-unwind" fn should_terminate(_: &AnyObject, _: Sel, _: *mut AnyObject) -> usize {
    let Some(app) = APP.get() else {
        return TERMINATE_NOW;
    };
    if !app.state::<UnsavedChanges>().get() {
        if let Some(window) = app.get_webview_window("main") {
            let _ = settings::save_window_state_of(app, &window);
        }
        return TERMINATE_NOW;
    }
    // The confirmation is shown in the window, which may be minimized.
    open_files::focus_window(app);
    let _ = app.emit(QUIT_REQUESTED_EVENT, ());
    TERMINATE_CANCEL
}

/// Installs the handler. Call once, on the main thread, after the app has
/// launched.
pub fn install(app: &AppHandle) {
    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    if APP.set(app.clone()).is_err() {
        return;
    }
    let ns_app = NSApplication::sharedApplication(mtm);
    let Some(delegate) = ns_app.delegate() else {
        return;
    };
    let object: &AnyObject = (*delegate).as_ref();
    let class: *const AnyClass = object.class();
    let imp: Imp = unsafe {
        std::mem::transmute::<extern "C-unwind" fn(&AnyObject, Sel, *mut AnyObject) -> usize, Imp>(
            should_terminate,
        )
    };
    // NSApplicationTerminateReply application:(NSApplication *)sender
    unsafe {
        class_addMethod(
            class as *mut AnyClass,
            sel!(applicationShouldTerminate:),
            imp,
            c"Q@:@".as_ptr(),
        );
    }
    // AppKit looks up which methods a delegate has when it is set.
    ns_app.setDelegate(Some(&delegate));
}
