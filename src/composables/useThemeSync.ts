// SPDX-FileCopyrightText: 2026 Mr.Baoboer
// SPDX-License-Identifier: AGPL-3.0-only
//
// Additional terms: see /legal/ADDITIONAL_TERMS.md

import { computed, onScopeDispose, ref, type Ref } from "vue";
import type { ThemeMode } from "../lib/window-mode";

type ThemeWindow = {
  setTheme: (theme: ThemeMode | null) => Promise<void>;
};

const waitForThemePaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

export function useThemeSync(
  appWindow: ThemeWindow,
  themeMode: Ref<ThemeMode>,
  saveStateNow: () => Promise<void>,
  followsSystemTheme?: Ref<boolean>,
) {
  const isThemeSwitching = ref(false);
  let themeApplyToken = 0;
  const systemAppearance = followsSystemTheme
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : undefined;
  const systemIsDark = ref(systemAppearance?.matches ?? false);
  const resolvedThemeMode = computed<ThemeMode>(() =>
    followsSystemTheme?.value ? (systemIsDark.value ? "dark" : "light") : themeMode.value,
  );
  if (systemAppearance) {
    const updateSystemTheme = (event: MediaQueryListEvent) => {
      systemIsDark.value = event.matches;
    };
    systemAppearance.addEventListener("change", updateSystemTheme);
    onScopeDispose(() =>
      systemAppearance.removeEventListener("change", updateSystemTheme),
    );
  }

  const applyThemeMode = async (mode: ThemeMode, options: { persist?: boolean } = {}) => {
    const { persist = true } = options;
    const token = ++themeApplyToken;
    isThemeSwitching.value = true;

    try {
      themeMode.value = mode;
      await waitForThemePaint();
      if (token !== themeApplyToken) return;

      await appWindow.setTheme(followsSystemTheme?.value ? null : mode);
      if (token !== themeApplyToken) return;

      if (persist) {
        await saveStateNow();
      }
    } finally {
      if (token === themeApplyToken) {
        isThemeSwitching.value = false;
      }
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    if (isThemeSwitching.value) return;
    if (themeMode.value === mode && !followsSystemTheme?.value) return;
    if (followsSystemTheme) followsSystemTheme.value = false;

    await applyThemeMode(mode);
  };

  const toggleTheme = async () => {
    if (isThemeSwitching.value) return;

    const nextMode = resolvedThemeMode.value === "dark" ? "light" : "dark";
    await setThemeMode(nextMode);
  };

  const setFollowsSystemTheme = async (enabled: boolean) => {
    if (
      !followsSystemTheme ||
      isThemeSwitching.value ||
      followsSystemTheme.value === enabled
    )
      return;
    if (!enabled) themeMode.value = resolvedThemeMode.value;
    followsSystemTheme.value = enabled;
    await applyThemeMode(themeMode.value);
  };

  return {
    applyThemeMode,
    isThemeSwitching,
    resolvedThemeMode,
    setFollowsSystemTheme,
    setThemeMode,
    toggleTheme,
  };
}
