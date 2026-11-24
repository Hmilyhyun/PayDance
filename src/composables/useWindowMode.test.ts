// SPDX-FileCopyrightText: 2026 Mr.Baoboer
// SPDX-License-Identifier: AGPL-3.0-only
//
// Additional terms: see /legal/ADDITIONAL_TERMS.md

import { setDockVisibility } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fullWindowSize, miniDefaultSize } from "../lib/window-mode";
import { useWindowMode } from "./useWindowMode";

vi.mock("@tauri-apps/api/app", () => ({
  setDockVisibility: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/core", { spy: true });

const createManagedWindow = ({
  failSkipTaskbar = false,
}: { failSkipTaskbar?: boolean } = {}) => {
  const alwaysOnTopCalls: boolean[] = [];
  const decorationCalls: boolean[] = [];
  const maximizableCalls: boolean[] = [];
  const sizeCalls: Array<{ width: number; height: number }> = [];
  const skipTaskbarCalls: boolean[] = [];

  return {
    alwaysOnTopCalls,
    decorationCalls,
    maximizableCalls,
    sizeCalls,
    skipTaskbarCalls,
    window: {
      setAlwaysOnTop: async (value: boolean) => {
        alwaysOnTopCalls.push(value);
      },
      setDecorations: async (value: boolean) => {
        decorationCalls.push(value);
      },
      setMaximizable: async (value: boolean) => {
        maximizableCalls.push(value);
      },
      setMinSize: async () => {},
      setResizable: async () => {},
      setSize: async (size: { width: number; height: number }) => {
        sizeCalls.push({ width: size.width, height: size.height });
      },
      setSkipTaskbar: async (skip: boolean) => {
        skipTaskbarCalls.push(skip);
        if (failSkipTaskbar) throw new Error("permission denied");
      },
    },
  };
};

const lastCall = <Value>(calls: Value[]) => calls[calls.length - 1];

describe("useWindowMode", () => {
  beforeEach(() => {
    vi.mocked(setDockVisibility).mockClear();
    vi.mocked(invoke).mockReset().mockResolvedValue(undefined);
  });

  it("keeps the full-window topmost preference when mini mode applies topmost", async () => {
    const managedWindow = createManagedWindow();
    const isMiniMode = ref(false);
    const miniSize = ref({ ...miniDefaultSize });
    const fullSize = ref({ ...fullWindowSize });
    const alwaysOnTop = ref(false);
    const { applyWindowMode } = useWindowMode(
      managedWindow.window,
      isMiniMode,
      miniSize,
      fullSize,
      alwaysOnTop,
    );

    isMiniMode.value = true;
    await applyWindowMode();

    expect(lastCall(managedWindow.alwaysOnTopCalls)).toBe(true);
    expect(alwaysOnTop.value).toBe(false);

    isMiniMode.value = false;
    await applyWindowMode();

    expect(lastCall(managedWindow.alwaysOnTopCalls)).toBe(false);
    expect(managedWindow.decorationCalls).toEqual([]);
    expect(managedWindow.maximizableCalls).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("removes native decorations in mini mode and restores them in full mode", async () => {
    const managedWindow = createManagedWindow();
    const isMiniMode = ref(true);
    const { applyWindowMode } = useWindowMode(
      managedWindow.window,
      isMiniMode,
      ref({ ...miniDefaultSize }),
      ref({ ...fullWindowSize }),
      ref(false),
      true,
    );

    await applyWindowMode();
    expect(managedWindow.maximizableCalls).toEqual([]);

    isMiniMode.value = false;
    await applyWindowMode();

    expect(managedWindow.decorationCalls).toEqual([false, true]);
    expect(managedWindow.maximizableCalls).toEqual([false]);
  });

  it("updates full-window topmost preference from mini mode while keeping mini mode topmost", async () => {
    const managedWindow = createManagedWindow();
    const isMiniMode = ref(true);
    const miniSize = ref({ ...miniDefaultSize });
    const fullSize = ref({ ...fullWindowSize });
    const alwaysOnTop = ref(true);
    const { setAlwaysOnTop } = useWindowMode(
      managedWindow.window,
      isMiniMode,
      miniSize,
      fullSize,
      alwaysOnTop,
    );

    await setAlwaysOnTop(false);

    expect(alwaysOnTop.value).toBe(false);
    expect(lastCall(managedWindow.alwaysOnTopCalls)).toBe(true);
  });

  it("restores the saved full-window size when leaving mini mode", async () => {
    const managedWindow = createManagedWindow();
    const isMiniMode = ref(false);
    const miniSize = ref({ ...miniDefaultSize });
    const fullSize = ref({ width: 720, height: 540 });
    const alwaysOnTop = ref(true);
    const { applyWindowMode } = useWindowMode(
      managedWindow.window,
      isMiniMode,
      miniSize,
      fullSize,
      alwaysOnTop,
    );

    await applyWindowMode();

    expect(lastCall(managedWindow.sizeCalls)).toEqual({ width: 720, height: 540 });
    expect(lastCall(managedWindow.alwaysOnTopCalls)).toBe(true);
  });

  it("drops the taskbar button in mini mode and restores it in full mode", async () => {
    const managedWindow = createManagedWindow();
    const isMiniMode = ref(true);
    const miniSize = ref({ ...miniDefaultSize });
    const fullSize = ref({ ...fullWindowSize });
    const alwaysOnTop = ref(false);
    const { applyWindowMode } = useWindowMode(
      managedWindow.window,
      isMiniMode,
      miniSize,
      fullSize,
      alwaysOnTop,
    );

    await applyWindowMode();
    expect(lastCall(managedWindow.skipTaskbarCalls)).toBe(true);

    isMiniMode.value = false;
    await applyWindowMode();
    expect(lastCall(managedWindow.skipTaskbarCalls)).toBe(false);
    expect(setDockVisibility).not.toHaveBeenCalled();
  });

  it("hides the Dock icon on macOS in mini mode and restores it in full mode", async () => {
    const managedWindow = createManagedWindow();
    const isMiniMode = ref(true);
    const { applyWindowMode, reapplyTaskbarVisibility } = useWindowMode(
      managedWindow.window,
      isMiniMode,
      ref({ ...miniDefaultSize }),
      ref({ ...fullWindowSize }),
      ref(false),
      true,
    );

    await applyWindowMode();
    await reapplyTaskbarVisibility();
    expect(setDockVisibility).toHaveBeenCalledExactlyOnceWith(false);

    isMiniMode.value = false;
    await applyWindowMode();

    expect(setDockVisibility).toHaveBeenNthCalledWith(2, true);
    expect(managedWindow.skipTaskbarCalls).toEqual([]);
  });

  it("waits for macOS to finish showing the Dock icon before hiding it again", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "performance"] });
    try {
      const managedWindow = createManagedWindow();
      const isMiniMode = ref(true);
      const { applyWindowMode } = useWindowMode(
        managedWindow.window,
        isMiniMode,
        ref({ ...miniDefaultSize }),
        ref({ ...fullWindowSize }),
        ref(false),
        true,
      );

      await applyWindowMode();
      isMiniMode.value = false;
      await applyWindowMode();

      isMiniMode.value = true;
      const pendingHide = applyWindowMode();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(setDockVisibility).toHaveBeenCalledTimes(2);

      await vi.runAllTimersAsync();
      await pendingHide;
      expect(setDockVisibility).toHaveBeenNthCalledWith(3, false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-asserts the mini-mode taskbar state without touching geometry", async () => {
    // Windows re-creates the taskbar button on every show, so hiding to the tray and coming
    // back would restore it even though the window never left mini mode.
    const managedWindow = createManagedWindow();
    const isMiniMode = ref(true);
    const miniSize = ref({ ...miniDefaultSize });
    const fullSize = ref({ ...fullWindowSize });
    const alwaysOnTop = ref(false);
    const { reapplyTaskbarVisibility } = useWindowMode(
      managedWindow.window,
      isMiniMode,
      miniSize,
      fullSize,
      alwaysOnTop,
    );

    await reapplyTaskbarVisibility();

    expect(managedWindow.skipTaskbarCalls).toEqual([true]);
    expect(managedWindow.sizeCalls).toEqual([]);

    isMiniMode.value = false;
    await reapplyTaskbarVisibility();

    expect(managedWindow.skipTaskbarCalls).toEqual([true, false]);
  });

  it("still resizes when the window rejects the taskbar call", async () => {
    const managedWindow = createManagedWindow({ failSkipTaskbar: true });
    const isMiniMode = ref(true);
    const miniSize = ref({ ...miniDefaultSize });
    const fullSize = ref({ ...fullWindowSize });
    const alwaysOnTop = ref(false);
    const { applyWindowMode } = useWindowMode(
      managedWindow.window,
      isMiniMode,
      miniSize,
      fullSize,
      alwaysOnTop,
    );

    await expect(applyWindowMode()).resolves.toBeUndefined();
    expect(lastCall(managedWindow.sizeCalls)).toEqual(miniDefaultSize);
  });

  it("keeps the Windows mini window topmost after changing the full-window preference", async () => {
    const managedWindow = createManagedWindow();
    const isMiniMode = ref(true);
    const miniSize = ref({ ...miniDefaultSize });
    const fullSize = ref({ ...fullWindowSize });
    const alwaysOnTop = ref(false);
    const { setAlwaysOnTop } = useWindowMode(
      managedWindow.window,
      isMiniMode,
      miniSize,
      fullSize,
      alwaysOnTop,
    );

    await setAlwaysOnTop(true);
    await setAlwaysOnTop(false);

    expect(alwaysOnTop.value).toBe(false);
    expect(managedWindow.alwaysOnTopCalls).toEqual([true, true]);
  });

  it("applies the macOS pin only to the mini window and allows turning it off", async () => {
    const managedWindow = createManagedWindow();
    const isMiniMode = ref(false);
    const alwaysOnTop = ref(true);
    const { applyWindowMode, setAlwaysOnTop } = useWindowMode(
      managedWindow.window,
      isMiniMode,
      ref({ ...miniDefaultSize }),
      ref({ ...fullWindowSize }),
      alwaysOnTop,
      true,
    );

    await applyWindowMode();
    isMiniMode.value = true;
    await applyWindowMode();
    await setAlwaysOnTop(false);
    await setAlwaysOnTop(true);
    isMiniMode.value = false;
    await applyWindowMode();

    expect(vi.mocked(invoke).mock.calls).toEqual([
      ["set_macos_mini_window", { miniMode: false, topmost: false }],
      ["set_macos_mini_window", { miniMode: true, topmost: true }],
      ["set_macos_mini_window", { miniMode: true, topmost: false }],
      ["set_macos_mini_window", { miniMode: true, topmost: true }],
      ["set_macos_mini_window", { miniMode: false, topmost: false }],
    ]);
    expect(managedWindow.alwaysOnTopCalls).toEqual([]);
  });
});
