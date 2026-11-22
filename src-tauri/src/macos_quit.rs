//! Asks about unsaved changes when macOS quits the app from outside its
//! menu, such as from the Dock, or when the user logs out or shuts down.
//!
//! The window's event loop doesn't let the app stop macOS from quitting,
//! so the app delegate gets an `applicationShouldTerminate:` method that
//! cancels the quit and asks the window to quit instead, the same way as
//! Quit Minidit in the menu.

use std::sync::OnceLock;

use objc2::ffi::class_addMethod;
use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{sel, MainThreadMarker};
use objc2_app_kit::NSApplication;
use tauri::{AppHandle, Emitter};

pub const QUIT_REQUESTED_EVENT: &str = "quit-requested";

/// `NSTerminateCancel`.
const TERMINATE_CANCEL: usize = 0;

static APP: OnceLock<AppHandle> = OnceLock::new();

extern "C-unwind" fn should_terminate(_: &AnyObject, _: Sel, _: *mut AnyObject) -> usize {
    if let Some(app) = APP.get() {
        let _ = app.emit(QUIT_REQUESTED_EVENT, ());
    }
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
