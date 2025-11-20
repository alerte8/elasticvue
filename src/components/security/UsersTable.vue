<template>
  <q-card>
    <q-card-section>
        <div class="row q-mb-md items-center justify-between">
          <div />
          <div>
            <q-btn color="negative" flat icon="delete" class="q-mr-sm" :label="t('defaults.delete')" :disable="selectedUsers.length === 0" @click="deleteSelectedUsers" />
            <q-btn color="primary" flat icon="person_add" class="q-mr-sm" @click="dialog = true" :label="t('security.add_user')" />
            <add-user-dialog v-model="dialog" :create-user="createUser" @created="loadUsers" />
          </div>
        </div>

      <q-table
        v-model:pagination="usersStore.pagination"
        v-model:selected="selectedUsers"
        :rows="users"
        :columns="columns"
        :rows-per-page-options="DEFAULT_ROWS_PER_PAGE"
        row-key="username"
        selection="multiple"
        dense
      >
        <template #body-cell-enabled="props">
          <q-td :props="props">
            <q-toggle
              v-model="props.row.enabled"
              :disable="isCurrentUser(props.row.username)"
              checked-icon="check"
              unchecked-icon="clear"
              color="green"
              @update:model-value="toggleUserEnabled(props.row)"
            />
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              color="negative"
              icon="delete"
              size="sm"
              :disable="isCurrentUser(props.row.username)"
              @click="deleteUser(props.row.username)"
            />
          </q-td>
        </template>

        <template #bottom="scope">
          <table-bottom v-model="usersStore.pagination.rowsPerPage"
                        :scope="scope"
                        :total="users.length"
                        :rows-per-page="rowsPerPage"
                        @rows-per-page-accepted="acceptRowsPerPage" />
        </template>
      </q-table>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
  import { useUsersTable } from '../../composables/components/security/UsersTable'
  import TableBottom from '../shared/TableBottom.vue'
  import { DEFAULT_ROWS_PER_PAGE } from '../../consts.ts'
  import AddUserDialog from './AddUserDialog.vue'
  import { ref } from 'vue'
  import { useTranslation } from '../../composables/i18n'
  import { askConfirm } from '../../helpers/dialogs'
  import { Loading } from 'quasar'
  import { useSnackbar } from '../../composables/Snackbar'
  
  const emit = defineEmits<{ 
    reload: []
  }>()

  const { 
    users, 
    columns, 
    loadUsers,
    createUser,
    deleteUser, 
    deleteUsers,
    toggleUserEnabled,
    rowsPerPage,
    acceptRowsPerPage,
    usersStore,
    isCurrentUser } = useUsersTable(emit)

  const dialog = ref(false)
  const t = useTranslation()
  const selectedUsers = ref([])
  const { showSnackbar } = useSnackbar()

  const deleteSelectedUsers = async () => {
    const confirmed = await askConfirm(t('security.users_result.delete.confirm_multiple', { count: selectedUsers.value.length }))
    if (!confirmed) return

    Loading.show()
    const usernamesToDelete = selectedUsers.value.map((user: any) => user.username)
    const results = await deleteUsers(usernamesToDelete)
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
        body: t('security.users_result.delete.growl_multiple_success', { count: successfulDeletions })
      })
    }

    if (failedDeletions > 0) {
      showSnackbar({
        apiError: true,
        networkError: false,
        loading: false,
        apiErrorMessage: t('security.users_result.delete.growl_multiple_fail', { count: failedDeletions }),
        status: 500
      })
    }
    selectedUsers.value = []
  }
</script>
