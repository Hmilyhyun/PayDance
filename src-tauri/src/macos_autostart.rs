// SPDX-FileCopyrightText: 2026 Mr.Baoboer
// SPDX-License-Identifier: AGPL-3.0-only
//
// Additional terms: see /legal/ADDITIONAL_TERMS.md

use objc2::available;
use objc2_foundation::NSURL;
use objc2_service_management::{SMAppService, SMAppServiceStatus};
use tauri::{Manager, WebviewWindow};
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub(crate) fn macos_autostart_enabled(window: WebviewWindow) -> Result<bool, String> {
    if window.label() != "main" {
        return Err("Autostart is only available from the main window".into());
    }

    let registered = window
        .autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())?;
    if !registered || !available!(macos = 13) {
        return Ok(registered);
    }

    let path = window
        .path()
        .home_dir()
        .map_err(|error| error.to_string())?
        .join("Library/LaunchAgents")
        .join(format!("{}.plist", window.package_info().name));
    let url = NSURL::from_file_path(path).ok_or("Invalid macOS LaunchAgent path")?;
    // The file exists but macOS can independently withhold background authorization.
    let status = unsafe { SMAppService::statusForLegacyURL(&url) };
    Ok(status != SMAppServiceStatus::RequiresApproval)
}
