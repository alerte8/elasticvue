<template>
  <q-card>
    <q-card-section>
      <div class="row q-mb-md items-center justify-between">
        <div />
        <div>
          <q-btn color="negative" flat icon="delete" class="q-mr-sm" :label="t('defaults.delete')" :disable="selectedRoles.length === 0" @click="deleteSelectedRoles" />
          <q-btn color="primary" flat icon="add" class="q-mr-sm" @click="dialog = true" :label="t('security.add_role')" />
          <add-role-dialog v-model="dialog" @created="loadRoles" />
        </div>
      </div>
      <q-table
        v-model:pagination="rolesStore.pagination"
        v-model:selected="selectedRoles"
        :rows="roles"
        :columns="columns"
        :rows-per-page-options="DEFAULT_ROWS_PER_PAGE"
        row-key="name"
        selection="multiple"
        dense
      >
        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              color="negative"
              icon="delete"
              size="sm"
              @click="deleteRole(props.row.name)"
            />
          </q-td>
        </template>
        <template #body-cell-cluster="props">
          <q-td :props="props">
            <div v-html="props.value" />
          </q-td>
        </template>
        <template #body-cell-indices="props">
          <q-td :props="props">
            <div v-html="props.value" />
          </q-td>
        </template>

        <template #bottom="scope">
          <table-bottom v-model="rolesStore.pagination.rowsPerPage"
                        :scope="scope"
                        :total="roles.length"
                        :rows-per-page="rowsPerPage"
                        @rows-per-page-accepted="acceptRowsPerPage" />
        </template>
      </q-table>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
  import { useRolesTable } from '../../composables/components/security/RolesTable'
  import TableBottom from '../shared/TableBottom.vue'
  import { DEFAULT_ROWS_PER_PAGE } from '../../consts.ts'
  import AddRoleDialog from './AddRoleDialog.vue'
  import { ref } from 'vue'
  import { useTranslation } from '../../composables/i18n'
  import { askConfirm } from '../../helpers/dialogs'
  import { Loading } from 'quasar'
  import { useSnackbar } from '../../composables/Snackbar'

  const emit = defineEmits<{ 
    reload: []
  }>()

  const { 
    roles,
    columns,
    deleteRole,
    deleteRoles,
    loadRoles,
    rowsPerPage,
    acceptRowsPerPage,
    rolesStore } = useRolesTable(emit)

  const t = useTranslation()
  const selectedRoles = ref([])
  const dialog = ref(false)
  const { showSnackbar } = useSnackbar()

  const deleteSelectedRoles = async () => {
    const confirmed = await askConfirm(t('security.roles_result.delete.confirm_multiple', { count: selectedRoles.value.length }))
    if (!confirmed) return

    Loading.show()
    const namesToDelete = selectedRoles.value.map((role: any) => role.name)
    const results = await deleteRoles(namesToDelete)
    Loading.hide()

    const successfulDeletions = results.filter(r => r.success).length
    const failedDeletions = results.filter(r => !r.success).length

    if (successfulDeletions > 0) {
      showSnackbar({
        apiError: false,
        networkError: false,
        loading: false,
        apiErrorMessage: '',
        status: 200
      }, {
        body: t('security.roles_result.delete.growl_multiple_success', { count: successfulDeletions })
      })
    }

    if (failedDeletions > 0) {
      showSnackbar({
        apiError: true,
        networkError: false,
        loading: false,
        apiErrorMessage: t('security.roles_result.delete.growl_multiple_fail', { count: failedDeletions }),
        status: 500
      })
    }
    selectedRoles.value = []
  }
</script>

