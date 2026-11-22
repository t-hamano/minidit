use tauri::{Runtime, WebviewWindow};

/// Turns off the WebView's own browser shortcuts on Windows, such as Ctrl+F
/// for its find bar, F3, Ctrl+P for printing, and Ctrl+R / F5 for reloading
/// the page, which would lose unsaved text. The keys then reach the menu
/// bar, so Ctrl+F opens the app's search bar. Editing keys such as Ctrl+C
/// and Ctrl+Z are not affected.
///
/// In development builds, Ctrl+Shift+I still opens the DevTools.
pub fn disable<R: Runtime>(window: &WebviewWindow<R>) {
    #[cfg(windows)]
    {
        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
        use windows_core::Interface;

        let _ = window.with_webview(|webview| unsafe {
            if let Ok(settings) = webview
                .controller()
                .CoreWebView2()
                .and_then(|core| core.Settings())
                .and_then(|settings| settings.cast::<ICoreWebView2Settings3>())
            {
                let _ = settings.SetAreBrowserAcceleratorKeysEnabled(false);
            }
        });
    }
    #[cfg(not(windows))]
    let _ = window;
}
