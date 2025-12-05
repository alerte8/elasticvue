<template>
  <q-dialog v-model="dialog" persistent>
    <q-card style="min-width: 420px">
      <q-card-section>
        <div class="text-h6">
          {{ t('security.add_apikey') }}
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <q-form @submit.prevent="create">
          <div class="q-mb-md">
            <q-input
              v-model="newApiKey.name"
              :label="t('security.api_keys_table.new.name')"
              outlined
              autofocus
            />
          </div>

          <div class="q-mb-md">
            <q-input
              v-model="newApiKey.expiration"
              :label="t('security.api_keys_table.new.expiration')"
              outlined
              placeholder="e.g. 1d, 7d, 30d"
            />
          </div>

          <div class="q-mb-md">
            <q-select
              v-model="newApiKey.roles"
              :options="roles"
              :label="t('security.api_keys_table.new.roles')"
              multiple
              use-chips
              outlined
            />
          </div>

          <div class="row justify-end">
            <q-btn v-close-popup flat :label="t('defaults.cancel')" />
            <q-btn :loading="loading" color="primary-dark" class="q-ml-sm" :label="t('defaults.create')" type="submit" />
          </div>
        </q-form>
      </q-card-section>
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
