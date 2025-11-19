<template>
  <q-dialog v-model="dialog" persistent>
    <q-card style="min-width: 500px">
      <q-card-section class="q-pb-none">
        <div class="text-h6">
          {{ t('security.add_apikey') }}
        </div>
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="newApiKey.name"
          :label="t('security.api_keys_table.new.name')"
          dense
          autofocus
          class="q-mb-md"
        />

        <q-input
          v-model="newApiKey.expiration"
          :label="t('security.api_keys_table.new.expiration')"
          dense
          class="q-mb-md"
          placeholder="e.g. 1d, 7d, 30d"
        />

        <q-select
          v-model="newApiKey.roles"
          :options="roles"
          :label="t('security.api_keys_table.new.roles')"
          multiple
          dense
          use-chips
          stack-label
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup flat :label="t('defaults.cancel')" />
        <q-btn :loading="loading" flat color="primary" :label="t('defaults.create')" @click="create" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
  import { useTranslation } from '../../composables/i18n'
  import { useAddApiKeyDialog } from '../../composables/components/security/AddApiKeyDialog'

  const props = defineProps<{
    modelValue: boolean
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void,
    (e: 'created'): void
  }>()

  const t = useTranslation()
  const { dialog, newApiKey, roles, loading, create } = useAddApiKeyDialog(props, emit)
</script>
