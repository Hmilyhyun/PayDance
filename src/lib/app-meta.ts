// SPDX-FileCopyrightText: 2026 Mr.Baoboer
// SPDX-License-Identifier: AGPL-3.0-only
//
// Additional terms: see /legal/ADDITIONAL_TERMS.md

export const appName = __PAYDANCE_MACOS__ ? "工资时钟" : "薪跳";
export const appEnglishName = __PAYDANCE_MACOS__ ? "Salary Clock for Mac" : "PayDance";
export const appTagline = "桌面实时工资看板";
export const appVersion = __PAYDANCE_VERSION__;
export const appAuthor = "Mr.Baoboer";
export const appCopyright = __PAYDANCE_MACOS__
  ? "Based on PayDance © 2026 Mr.Baoboer · AGPL-3.0-only"
  : "© 2026 Mr.Baoboer";
export const repositoryUrl = "https://github.com/MrBaoboer/PayDance";
// Set by vite.config.ts: on Vercel it is the /download/windows endpoint (api/download-windows.js),
// which redirects to the newest versioned EXE; other builds link to the Release page.
export const windowsDownloadUrl = __PAYDANCE_WINDOWS_DOWNLOAD_URL__;
