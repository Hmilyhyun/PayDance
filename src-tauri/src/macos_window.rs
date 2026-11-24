// SPDX-FileCopyrightText: 2026 Mr.Baoboer
// SPDX-License-Identifier: AGPL-3.0-only
//
// Additional terms: see /legal/ADDITIONAL_TERMS.md

use objc2::available;
use objc2_app_kit::{
    NSNormalWindowLevel, NSStatusWindowLevel, NSWindow, NSWindowCollectionBehavior as Behavior,
    NSWindowStyleMask,
};
use tauri::{Manager, WebviewWindow};

#[tauri::command]
pub(crate) fn set_macos_mini_window(
    window: WebviewWindow,
    mini_mode: bool,
    topmost: bool,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Mini mode can only be changed from the main window".into());
    }

    let opacity_panel = window.get_webview_window("mini-opacity");
    let topmost = mini_mode && topmost;
    window
        .with_webview(move |webview| {
            // Tauri calls this closure on the main thread and owns the NSWindow.
            let main = unsafe { &*webview.ns_window().cast::<NSWindow>() };
            set_space_behavior(main, mini_mode, topmost);
            main.setLevel(if topmost {
                NSStatusWindowLevel
            } else {
                NSNormalWindowLevel
            });

            if let Some(panel) = opacity_panel
                && let Ok(native_window) = panel.ns_window()
            {
                // The panel is opened on demand, on the same Space as the mini window.
                let panel = unsafe { &*native_window.cast::<NSWindow>() };
                set_space_behavior(panel, mini_mode, topmost);
            }
        })
        .map_err(|error| error.to_string())
}

fn set_space_behavior(window: &NSWindow, mini_mode: bool, topmost: bool) {
    // A floating level alone leaves a regular window outside other apps' full-screen Spaces.
    let original_style = window.styleMask();
    let mut style = original_style;
    style.set(NSWindowStyleMask::NonactivatingPanel, topmost);
    if style != original_style {
        window.setStyleMask(style);
    }
    let mut behavior = window.collectionBehavior();
    behavior.set(Behavior::CanJoinAllSpaces, mini_mode);
    behavior.set(Behavior::FullScreenAuxiliary, topmost);
    if available!(macos = 13) {
        behavior.set(Behavior::CanJoinAllApplications, topmost);
    }
    window.setCollectionBehavior(behavior);
    window.setHidesOnDeactivate(false);
}
