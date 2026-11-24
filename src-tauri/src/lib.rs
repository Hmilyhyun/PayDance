// SPDX-FileCopyrightText: 2026 Mr.Baoboer
// SPDX-License-Identifier: AGPL-3.0-only
//
// Additional terms: see /legal/ADDITIONAL_TERMS.md

use tauri::Manager;

#[cfg(target_os = "macos")]
mod macos_window;
mod portable_update;
mod settings_backup;
mod tray;

use portable_update::install_portable_update;
use settings_backup::backup_unreadable_settings;
use tray::{exit_when_main_window_destroyed, show_window};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_autostart::Builder::new().build());

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_process::init());

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            show_window(&window);
        }
    }));

    #[cfg(target_os = "macos")]
    let builder = builder.on_window_event(|window, event| {
        if window.label() == "main"
            && let tauri::WindowEvent::CloseRequested { api, .. } = event
        {
            api.prevent_close();
            let _ = window.hide();
        }
    });

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            install_portable_update,
            backup_unreadable_settings,
            #[cfg(target_os = "macos")]
            macos_window::set_macos_mini_window,
        ])
        .on_window_event(exit_when_main_window_destroyed)
        .setup(|app| {
            tray::setup(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } = _event
                && let Some(window) = _app.get_webview_window("main")
            {
                show_window(&window);
            }
        });
}
