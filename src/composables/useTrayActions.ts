// SPDX-FileCopyrightText: 2026 Mr.Baoboer
// SPDX-License-Identifier: AGPL-3.0-only
//
// Additional terms: see /legal/ADDITIONAL_TERMS.md

import { trayEventNames } from "../lib/app-events";

type UnlistenFn = () => void;

type TrayEventWindow = {
  listen: <T>(
    event: string,
    handler: (event: { payload: T }) => void,
  ) => Promise<UnlistenFn>;
};

export type TrayActions = {
  openMain?: () => Promise<void> | void;
  openSettings: () => Promise<void> | void;
  toggleAlwaysOnTop: () => Promise<void> | void;
  toggleMiniMode: () => Promise<void> | void;
};

export async function registerTrayActions(
  appWindow: TrayEventWindow,
  actions: TrayActions,
) {
  const unlisteners: UnlistenFn[] = [];

  const { openMain } = actions;
  if (openMain) {
    unlisteners.push(
      await appWindow.listen(trayEventNames.openMain, () => {
        void openMain();
      }),
    );
  }

  unlisteners.push(
    await appWindow.listen(trayEventNames.openSettings, () => {
      void actions.openSettings();
    }),
  );

  unlisteners.push(
    await appWindow.listen(trayEventNames.toggleAlwaysOnTop, () => {
      void actions.toggleAlwaysOnTop();
    }),
  );

  unlisteners.push(
    await appWindow.listen(trayEventNames.toggleMiniMode, () => {
      void actions.toggleMiniMode();
    }),
  );

  return unlisteners;
}
