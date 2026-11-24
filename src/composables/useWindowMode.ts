// SPDX-FileCopyrightText: 2026 Mr.Baoboer
// SPDX-License-Identifier: AGPL-3.0-only
//
// Additional terms: see /legal/ADDITIONAL_TERMS.md

import { setDockVisibility } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import type { Ref } from "vue";
import {
  fullWindowMinSize,
  miniMinSize,
  normalizeFullSize,
  normalizeMiniSize,
  type WindowSize,
} from "../lib/window-mode";

type ManagedWindow = {
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>;
  setDecorations?: (decorations: boolean) => Promise<void>;
  setMaximizable?: (maximizable: boolean) => Promise<void>;
  setMinSize: (size: LogicalSize) => Promise<void>;
  setResizable: (resizable: boolean) => Promise<void>;
  setSize: (size: LogicalSize) => Promise<void>;
  setSkipTaskbar?: (skip: boolean) => Promise<void>;
};

// Tao ignores Dock hide requests for one second after showing the icon.
const dockHideDelayAfterShowMs = 1_100;

export function useWindowMode(
  appWindow: ManagedWindow,
  isMiniMode: Ref<boolean>,
  miniSize: Ref<WindowSize>,
  fullSize: Ref<WindowSize>,
  alwaysOnTop: Ref<boolean>,
  isMacDesktop = false,
) {
  let dockVisible = true;
  let dockShownAt = -Infinity;
  let dockVisibilityUpdate = Promise.resolve();

  const applyDockVisibility = () => {
    dockVisibilityUpdate = dockVisibilityUpdate
      .then(async () => {
        const visible = !isMiniMode.value;
        if (dockVisible === visible) return;

        if (!visible) {
          const delay = dockShownAt + dockHideDelayAfterShowMs - performance.now();
          if (delay > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, Math.ceil(delay)));
            if (!isMiniMode.value) return;
          }
        }

        await setDockVisibility(visible);
        dockVisible = visible;
        if (visible) dockShownAt = performance.now();
      })
      .catch(() => undefined);
    return dockVisibilityUpdate;
  };

  const applyTaskbarVisibility = async (miniMode: boolean) => {
    try {
      await appWindow.setSkipTaskbar?.(miniMode);
    } catch {
      // An older capability file may reject the taskbar command.
    }
  };

  const applyTopmost = (miniMode = isMiniMode.value) => {
    if (isMacDesktop) {
      return invoke<void>("set_macos_mini_window", {
        miniMode,
        topmost: miniMode && alwaysOnTop.value,
      });
    }
    return appWindow.setAlwaysOnTop(miniMode || alwaysOnTop.value);
  };

  const applyWindowMode = async () => {
    await appWindow.setResizable(true);
    if (isMacDesktop) {
      await appWindow.setDecorations?.(!isMiniMode.value);
    }

    if (isMiniMode.value) {
      const size = normalizeMiniSize(miniSize.value);
      miniSize.value = size;
      await appWindow.setMinSize(new LogicalSize(miniMinSize.width, miniMinSize.height));
      await appWindow.setSize(new LogicalSize(size.width, size.height));
      if (isMacDesktop) await applyDockVisibility();
      await applyTopmost(true);
      if (!isMacDesktop) await applyTaskbarVisibility(true);
      return;
    }

    const size = normalizeFullSize(fullSize.value);
    fullSize.value = size;
    await appWindow.setMinSize(
      new LogicalSize(fullWindowMinSize.width, fullWindowMinSize.height),
    );
    await appWindow.setSize(new LogicalSize(size.width, size.height));
    await applyTopmost(false);
    if (isMacDesktop) {
      // Recreating the title bar also re-enables the system zoom button.
      await appWindow.setMaximizable?.(false);
      await applyDockVisibility();
    } else {
      await applyTaskbarVisibility(false);
    }
  };

  const setAlwaysOnTop = async (value: boolean) => {
    alwaysOnTop.value = value;
    await applyTopmost();
  };

  // Windows re-creates the taskbar button whenever a window is shown again, so hiding to the
  // tray and coming back from it would restore the button even though nothing left mini mode.
  const reapplyTaskbarVisibility = async () => {
    if (!isMacDesktop) {
      await applyTaskbarVisibility(isMiniMode.value);
    }
  };

  return {
    applyWindowMode,
    reapplyTaskbarVisibility,
    setAlwaysOnTop,
  };
}
