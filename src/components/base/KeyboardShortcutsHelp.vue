<template>
  <q-btn
    icon="keyboard"
    round
    dense
    size="sm"
    color="dark-grey"
    class="q-mr-md"
    :title="t('base.keyboard_shortcuts_help.title')"
    data-testid="keyboard-shortcuts-help-button"
    @click="dialog = true"
  />

  <q-dialog v-model="dialog" transition-duration="100">
    <q-card style="width: 640px; max-width: 90vw">
      <q-card-section class="flex justify-between items-center">
        <h2 class="text-h6 q-my-none">
          {{ t('base.keyboard_shortcuts_help.title') }}
        </h2>
        <q-btn v-close-popup icon="close" flat round dense />
      </q-card-section>

      <q-separator />

      <q-card-section class="shortcuts-help-body scroll">
        <div v-for="section in sections" :key="section.title" class="shortcuts-help-section">
          <div class="shortcuts-help-section-title">
            {{ section.title }}
          </div>

          <div v-for="(item, index) in section.shortcuts" :key="index" class="shortcuts-help-row">
            <div class="shortcuts-help-combo">
              <template v-for="(group, groupIndex) in splitCombo(item.combo)" :key="groupIndex">
                <span v-if="groupIndex > 0" class="shortcuts-help-combo-sep">/</span>
                <template v-for="(key, keyIndex) in group" :key="keyIndex">
                  <span v-if="keyIndex > 0" class="shortcuts-help-combo-plus">+</span>
                  <kbd class="shortcuts-help-key">{{ key }}</kbd>
                </template>
              </template>
            </div>
            <div class="shortcuts-help-description">
              {{ item.description }}
            </div>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <q-btn v-close-popup flat :label="t('defaults.close')" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTranslation } from '../../composables/i18n.ts'

const t = useTranslation()
const dialog = ref(false)

const splitCombo = (combo: string) => combo.split(' / ').map(group => group.split('+'))

const sections = computed(() => [
  {
    title: t('base.keyboard_shortcuts_help.sections.navigation'),
    shortcuts: [
      { combo: 'Ctrl+Shift+Tab', description: t('base.keyboard_shortcuts_help.shortcuts.cycle_feature.description') }
    ]
  },
  {
    title: t('base.keyboard_shortcuts_help.sections.tabs'),
    shortcuts: [
      { combo: 'Ctrl+Tab', description: t('base.keyboard_shortcuts_help.shortcuts.cycle_tab.description') },
      { combo: 'Ctrl+Shift+T', description: t('base.keyboard_shortcuts_help.shortcuts.reopen_tab.description') }
    ]
  },
  {
    title: t('base.keyboard_shortcuts_help.sections.zoom'),
    shortcuts: [
      { combo: 'Ctrl+Scroll', description: t('base.keyboard_shortcuts_help.shortcuts.zoom.description') },
      { combo: 'Ctrl+Numpad0', description: t('base.keyboard_shortcuts_help.shortcuts.reset_zoom.description') }
    ]
  },
  {
    title: t('base.keyboard_shortcuts_help.sections.search'),
    shortcuts: [
      { combo: 'Ctrl+Enter', description: t('base.keyboard_shortcuts_help.shortcuts.run_search.description') },
      { combo: 'Ctrl+Space', description: t('base.keyboard_shortcuts_help.shortcuts.suggestions.description') },
      { combo: 'Esc', description: t('base.keyboard_shortcuts_help.shortcuts.clear_search.description') },
      { combo: '↑ / ↓', description: t('base.keyboard_shortcuts_help.shortcuts.navigate_suggestions.description') },
      { combo: 'Enter / Tab', description: t('base.keyboard_shortcuts_help.shortcuts.apply_suggestion.description') }
    ]
  },
  {
    title: t('base.keyboard_shortcuts_help.sections.rest'),
    shortcuts: [
      { combo: 'Ctrl+Enter', description: t('base.keyboard_shortcuts_help.shortcuts.send_rest_body.description') },
      { combo: 'Enter', description: t('base.keyboard_shortcuts_help.shortcuts.send_rest_path.description') }
    ]
  },
  {
    title: t('base.keyboard_shortcuts_help.sections.editor'),
    shortcuts: [
      { combo: 'Ctrl+Alt+L', description: t('base.keyboard_shortcuts_help.shortcuts.beautify.description') },
      { combo: 'Tab', description: t('base.keyboard_shortcuts_help.shortcuts.indent.description') }
    ]
  },
  {
    title: t('base.keyboard_shortcuts_help.sections.filters'),
    shortcuts: [
      { combo: 'Esc', description: t('base.keyboard_shortcuts_help.shortcuts.clear_filter.description') }
    ]
  }
])
</script>

<style lang="scss" scoped>
.shortcuts-help-body {
  max-height: 65vh;
  overflow-y: auto;
}

.shortcuts-help-section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.shortcuts-help-section-title {
  font-weight: bold;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--theme-muted-color);
  margin-bottom: 8px;
}

.shortcuts-help-row {
  display: grid;
  grid-template-columns: minmax(150px, auto) 1fr;
  column-gap: 20px;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid var(--theme-separator-background);

  &:first-of-type {
    border-top: none;
  }
}

.shortcuts-help-combo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
}

.shortcuts-help-key {
  font-family: Hack, monospace;
  font-size: 0.8rem;
  font-weight: bold;
  padding: 3px 7px;
  border-radius: 4px;
  color: var(--theme-dark-grey-color);
  background-color: var(--theme-dark-grey-background);
  border: 1px solid var(--theme-border-color);
}

.shortcuts-help-combo-plus,
.shortcuts-help-combo-sep {
  color: var(--theme-muted-color);
  font-size: 0.8rem;
}

.shortcuts-help-description {
  font-size: 0.9rem;
}
</style>
