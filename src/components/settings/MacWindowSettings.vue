<script setup lang="ts">
// SPDX-FileCopyrightText: 2026 Mr.Baoboer
// SPDX-License-Identifier: AGPL-3.0-only
//
// Additional terms: see /legal/ADDITIONAL_TERMS.md
import { useI18n } from "../../composables/useI18n";
import SettingsGroup from "../ui/SettingsGroup.vue";
import SwitchRow from "../ui/SwitchRow.vue";

defineProps<{ miniAlwaysOnTop: boolean; followsSystemTheme: boolean }>();
const emit = defineEmits<{
  toggleMiniAlwaysOnTop: [];
  "update:followsSystemTheme": [enabled: boolean];
}>();
const { t } = useI18n();
</script>

<template>
  <SettingsGroup :title="t('settings.miniAlwaysOnTop')">
    <template #action>
      <SwitchRow
        :label="t('settings.miniAlwaysOnTop')"
        title-action
        :model-value="miniAlwaysOnTop"
        @update:model-value="emit('toggleMiniAlwaysOnTop')"
      />
    </template>
  </SettingsGroup>
  <SettingsGroup :title="t('settings.followSystemTheme')">
    <template #action>
      <SwitchRow
        :label="t('settings.followSystemTheme')"
        title-action
        :model-value="followsSystemTheme"
        @update:model-value="emit('update:followsSystemTheme', $event)"
      />
    </template>
  </SettingsGroup>
</template>
