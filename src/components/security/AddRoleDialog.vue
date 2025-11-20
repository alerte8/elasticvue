<template>
  <q-dialog v-model="dialog" persistent>
    <q-card style="min-width: 500px">
      <q-card-section class="q-pb-none">
        <div class="text-h6">
          {{ t('security.add_role') }}
        </div>
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="newRole.name"
          :label="t('security.roles_table.new.name')"
          dense
          autofocus
          class="q-mb-md"
        />

        <q-input
          v-model="newRole.cluster"
          :label="t('security.roles_table.new.cluster')"
          dense
          class="q-mb-md"
          placeholder="e.g. all"
        />

        <q-input
          v-model="newRole.indices"
          :label="t('security.roles_table.new.indices')"
          dense
          class="q-mb-md"
          placeholder="e.g. *"
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