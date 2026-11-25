<script setup lang="ts">
// SPDX-FileCopyrightText: 2026 Mr.Baoboer
// SPDX-License-Identifier: AGPL-3.0-only
//
// Additional terms: see /legal/ADDITIONAL_TERMS.md
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  miniDefaultSize,
  fullWindowSize,
  defaultMiniOpacityPercent,
  normalizeMiniOpacityPercent,
  resolveWindowPreferences,
  type WindowPosition,
  type WindowSize,
} from "./lib/window-mode";
import { appName, isMacDesktop } from "./lib/app-meta";
import { localeChangedEventName } from "./lib/app-events";
import type { ResizeDirection } from "./lib/resize-handles";
import { useAppShell } from "./composables/useAppShell";
import {
  registerReadyWindowActions,
  useAppWindowLifecycle,
} from "./composables/useAppWindowLifecycle";
import { useAutostart } from "./composables/useAutostart";
import { macosAutostartAdapter } from "./lib/autostart";
import { provideCurrency } from "./composables/useCurrency";
import { useDashboardModel } from "./composables/useDashboardModel";
import { provideI18n } from "./composables/useI18n";
import { useMiniWindowDrag } from "./composables/useMiniWindowDrag";
import { useMiniOpacityPanel } from "./composables/useMiniOpacityPanel";
import { useSalarySettings } from "./composables/useSalarySettings";
import { useSalaryTicker } from "./composables/useSalaryTicker";
import { useThemeSync } from "./composables/useThemeSync";
import { useWindowMode } from "./composables/useWindowMode";
import { useWindowPositionRecovery } from "./composables/useWindowPositionRecovery";
import { useWindowStatePersistence } from "./composables/useWindowStatePersistence";
import { checkForUpdate, type UpdaterStatus } from "#updater";
import AppWindow from "./components/AppWindow.vue";
import MiniWindow from "./components/MiniWindow.vue";
import MiniOpacityPanel from "./components/MiniOpacityPanel.vue";
const appWindow = getCurrentWindow();
const isOpacityPanelWindow = appWindow.label === "mini-opacity";
const updateStatus = ref<UpdaterStatus>({ kind: "upToDate" });
const {
  amountMode,
  alwaysOnTop,
  config,
  currencySymbol,
  followsSystemTheme,
  hasCompletedOnboarding,
  isSettingsReady,
  loadSettings,
  locale,
  saveSettings,
  settingsSaveError,
  themeMode,
} = useSalarySettings(undefined, () => t.value, { isMacDesktop });

const { t } = provideI18n(locale);
provideCurrency(currencySymbol);

// Watch startup locale changes too. Only the main window owns the menu bar language.
watch(locale, (next) => {
  if (isOpacityPanelWindow) return;
  void appWindow.emit(localeChangedEventName, next);
});

const isMiniMode = ref(false);
const {
  autostartEnabled,
  autostartError,
  isAutostartUpdating,
  refreshAutostart,
  updateAutostartEnabled,
} = useAutostart(
  () => t.value(isMacDesktop ? "autostart.macosError" : "autostart.error"),
  isMacDesktop ? macosAutostartAdapter : undefined,
);
const fullSize = ref<WindowSize>({ ...fullWindowSize });
const miniSize = ref<WindowSize>({ ...miniDefaultSize });
const miniOpacityPercent = ref(defaultMiniOpacityPercent);
const mainPosition = ref<WindowPosition | undefined>(undefined);
const miniPosition = ref<WindowPosition | undefined>(undefined);
const defaultWindowPreferences = resolveWindowPreferences({});
const { snapshot, startTicker, stopTicker } = useSalaryTicker(
  config,
  t.value,
  isMacDesktop,
);
const { applyWindowMode, reapplyTaskbarVisibility, setAlwaysOnTop } = useWindowMode(
  appWindow,
  isMiniMode,
  miniSize,
  fullSize,
  alwaysOnTop,
  isMacDesktop,
);
const windowPosition = useWindowPositionRecovery({
  appWindow,
  fullSize,
  isMiniMode,
  mainPosition,
  miniPosition,
  miniSize,
});
const { clearSaveStateTimer, loadWindowPreferences, saveStateNow, scheduleSaveState } =
  useWindowStatePersistence({
    defaultWindowPreferences,
    fullSize,
    isMiniMode,
    isSettingsReady,
    loadSettings,
    mainPosition,
    miniOpacityPercent,
    miniPosition,
    miniSize,
    saveSettings,
  });
const {
  applyThemeMode,
  isThemeSwitching,
  resolvedThemeMode,
  setFollowsSystemTheme,
  setThemeMode,
  toggleTheme,
} = useThemeSync(
  appWindow,
  themeMode,
  saveStateNow,
  isMacDesktop && !isOpacityPanelWindow ? followsSystemTheme : undefined,
);
const {
  activeView,
  completeOnboarding,
  openSettings,
  setMiniMode,
  shouldShowOnboarding,
  showSalaryInfo,
  showSettings,
  toggleMiniMode,
} = useAppShell({
  alwaysOnTop,
  appWindow,
  applyThemeMode,
  applyWindowMode,
  captureWindowPosition: windowPosition.captureWindowPosition,
  fullSize,
  hasCompletedOnboarding,
  isMiniMode,
  isOpacityPanelWindow,
  isSettingsReady,
  readWindowPosition: windowPosition.readWindowPosition,
  restoreWindowPosition: windowPosition.restoreWindowPosition,
  saveStateNow,
  setAlwaysOnTop,
  themeMode,
});
const { showMiniOpacityPanel } = useMiniOpacityPanel(
  appWindow,
  miniOpacityPercent,
  resolvedThemeMode,
  locale,
  isMacDesktop && !isOpacityPanelWindow,
);
const { clearMiniDrag, startMiniDrag } = useMiniWindowDrag(appWindow);
const {
  dailyEarnText,
  earnedText,
  firstConfigIssue,
  hasConfigIssues,
  hasIssue,
  middleStat,
  salaryModeLabel,
  statusText,
  workedTimeText,
} = useDashboardModel(config, snapshot, t.value, locale);

const shellClass = computed(() =>
  resolvedThemeMode.value === "dark" ? "theme-dark" : "theme-light",
);

const updateMiniOpacityPercent = (value: number, options: { commit?: boolean } = {}) => {
  miniOpacityPercent.value = normalizeMiniOpacityPercent(value);
  if (options.commit) {
    void saveStateNow();
    return;
  }
  scheduleSaveState();
};

const toggleAlwaysOnTop = async () => {
  await setAlwaysOnTop(!alwaysOnTop.value);
  await saveStateNow();
};

const startDrag = async (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.closest("button, input, label")) return;

  await appWindow.startDragging();
};

const startResize = async (direction: ResizeDirection) => {
  await appWindow.startResizeDragging(direction);
};

const { clearWindowLifecycleTimers, registerWindowLifecycle } = useAppWindowLifecycle(
  appWindow,
  {
    ensureWindowOnScreen: windowPosition.ensureWindowOnScreen,
    fullSize,
    isMiniMode,
    isSettingsReady,
    miniSize,
    reapplyTaskbarVisibility,
    saveStateNow,
    updateMiniOpacityPercent,
  },
);

watch(config, scheduleSaveState, { deep: true });
// These choices can change without triggering a window-state save.
watch([amountMode, currencySymbol, locale], scheduleSaveState);
const unlisteners: Array<() => void> = [];

onMounted(async () => {
  if (isOpacityPanelWindow) return;

  // Intercept Windows close requests even while preferences load.
  unlisteners.push(...(await registerWindowLifecycle()));

  const windowPreferences = await loadWindowPreferences();
  isMiniMode.value = windowPreferences.isMiniMode;
  fullSize.value = windowPreferences.fullSize;
  miniSize.value = windowPreferences.miniSize;
  miniOpacityPercent.value = windowPreferences.miniOpacityPercent;
  mainPosition.value = windowPreferences.mainPosition;
  miniPosition.value = windowPreferences.miniPosition;
  await refreshAutostart();
  await applyThemeMode(themeMode.value, { persist: false });
  // Keep the menu bar and ticker available if applying window geometry fails.
  await applyWindowMode().catch(() => undefined);
  await windowPosition.restoreWindowPosition().catch(() => undefined);

  unlisteners.push(
    ...(await registerReadyWindowActions(appWindow, {
      openMain: isMacDesktop
        ? () => (isMiniMode.value ? setMiniMode(false) : undefined)
        : undefined,
      openSettings,
      recordWindowPosition: windowPosition.recordWindowPosition,
      refreshAutostart,
      saveStateNow,
      scheduleSaveState,
      toggleAlwaysOnTop,
      toggleMiniMode,
    })),
  );

  startTicker();

  // Silent background update check — never blocks the UI
  checkForUpdate().then((status) => {
    updateStatus.value = status;
  });
});

onBeforeUnmount(() => {
  stopTicker();
  clearSaveStateTimer();
  clearWindowLifecycleTimers();
  clearMiniDrag();
  for (const unlisten of unlisteners) {
    unlisten();
  }
});
</script>

<template>
  <MiniOpacityPanel v-if="activeView === 'mini-opacity'" />

  <main
    v-else
    class="app-shell h-full w-full select-none p-0"
    :class="[
      shellClass,
      activeView === 'mini' ? 'is-mini' : '',
      { 'app-shell--macos': isMacDesktop },
      { 'is-theme-syncing': isThemeSwitching },
    ]"
    @contextmenu.prevent
  >
    <MiniWindow
      v-if="activeView === 'mini'"
      :amount="earnedText"
      :amount-mode="amountMode"
      :opacity-percent="miniOpacityPercent"
      @drag-start="startMiniDrag"
      @opacity-menu="showMiniOpacityPanel"
      @restore="setMiniMode(false)"
    />

    <AppWindow
      v-else
      v-model:always-on-top="alwaysOnTop"
      v-model:amount-mode="amountMode"
      v-model:config="config"
      v-model:currency-symbol="currencySymbol"
      v-model:show-salary-info="showSalaryInfo"
      v-model:show-settings="showSettings"
      :app-name="appName"
      :update-status="updateStatus"
      :autostart-enabled="autostartEnabled"
      :autostart-error="autostartError"
      :daily-earn-text="dailyEarnText"
      :earned-text="earnedText"
      :first-config-issue="firstConfigIssue"
      :follows-system-theme="followsSystemTheme"
      :has-config-issues="hasConfigIssues"
      :has-issue="hasIssue"
      :is-autostart-updating="isAutostartUpdating"
      :is-theme-switching="isThemeSwitching"
      :middle-stat="middleStat"
      :salary-mode-label="salaryModeLabel"
      :settings-save-error="settingsSaveError"
      :should-show-onboarding="shouldShowOnboarding"
      :show-desktop-features="true"
      :use-native-window-controls="isMacDesktop"
      :snapshot="snapshot"
      :status-text="statusText"
      :theme-mode="resolvedThemeMode"
      :worked-time-text="workedTimeText"
      @close="appWindow.hide()"
      @complete-onboarding="completeOnboarding"
      @drag-start="startDrag"
      @minimize="appWindow.minimize()"
      @resize-start="startResize"
      @set-mini-mode="setMiniMode"
      @toggle-always-on-top="toggleAlwaysOnTop"
      @toggle-mini-mode="toggleMiniMode"
      @toggle-settings="showSettings = !showSettings"
      @toggle-theme="toggleTheme"
      @update:autostart-enabled="updateAutostartEnabled"
      @update:follows-system-theme="setFollowsSystemTheme"
      @update:theme-mode="setThemeMode"
    />
  </main>
</template>
