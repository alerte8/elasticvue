<template>
  <q-dialog v-model="dialog" persistent>
    <q-card style="min-width: 420px">
      <q-card-section>
        <div class="text-h6">
          {{ t('security.add_role') }}
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <q-form @submit.prevent="create">
          <div class="q-mb-md">
            <q-input
              v-model="newRole.name"
              :label="t('security.roles_table.new.name')"
              outlined
              autofocus
            />
          </div>

          <div class="q-mb-md">
            <q-input
              v-model="newRole.cluster"
              :label="t('security.roles_table.new.cluster')"
              outlined
              placeholder="e.g. all"
            />
          </div>

          <div class="q-mb-md">
            <q-input
              v-model="newRole.indices"
              :label="t('security.roles_table.new.indices')"
              outlined
              placeholder="e.g. *"
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
  import { useAddRoleDialog } from '../../composables/components/security/AddRoleDialog'

  const props = defineProps<{
    modelValue: boolean
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void,
    (e: 'created'): void
  }>()

  const t = useTranslation()
  const { dialog, newRole, loading, create } = useAddRoleDialog(props, emit)
</script>