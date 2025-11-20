<template>
  <q-card>    
    <q-card-section>
      <div class="row q-mb-md items-center justify-between">
        <div />
        <div>
          <q-btn color="negative" flat icon="delete" class="q-mr-sm" :label="t('defaults.delete')" :disable="selectedApiKeys.length === 0" @click="deleteSelectedApiKeys" />
          <q-btn color="primary" flat icon="add" class="q-mr-sm" @click="dialog = true" :label="t('security.add_apikey')" />
          <add-api-key-dialog v-model="dialog" @created="loadApiKeys" />
        </div>
      </div>
      <q-table
        v-model:pagination="apikeysStore.pagination"
        v-model:selected="selectedApiKeys"
        :rows="apiKeys"
        :columns="columns"
        :rows-per-page-options="DEFAULT_ROWS_PER_PAGE"
        row-key="id"
        selection="multiple"
        dense
      >
        <template #body-cell-actions="props">
          <q-td :props="props">
           
            <q-btn
              color="negative"
              icon="delete"
              size="sm"
              :disable="isCurrentApiKey(props.row.id)"
              @click="deleteApiKey(props.row.id)"
            />
          </q-td>
        </template>

        <template #bottom="scope">
          <table-bottom v-model="apikeysStore.pagination.rowsPerPage"
                        :scope="scope"
                        :total="apiKeys.length"
                        :rows-per-page="rowsPerPage"                        
                        @rows-per-page-accepted="acceptRowsPerPage" />
        </template>

        <template #body-cell-creation="props">
          <q-td :props="props">
            <div v-html="new Date(props.value).toLocaleString()" />
          </q-td>
        </template>

         <template #body-cell-expiration="props">
          <q-td :props="props">
            <div v-html="props.value ? new Date(props.value).toLocaleString() : 'Never'" />
          </q-td>
        </template>

        <template #body-cell-invalidated="props">
          <q-td :props="props">
            <q-chip 
              :color="props.value ? 'negative' : 'positive'" 
              :label="props.value ? 'Invalidated' : 'Active'"
              size="sm"
            />
          </q-td>
        </template>
      </q-table>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
  import { useApiKeysTable } from '../../composables/components/security/ApiKeysTable'
  import TableBottom from '../shared/TableBottom.vue'
  import { DEFAULT_ROWS_PER_PAGE } from '../../consts.ts'
  import AddApiKeyDialog from './AddApiKeyDialog.vue'
  import { ref } from 'vue'
  import { useTranslation } from '../../composables/i18n'
  import { askConfirm } from '../../helpers/dialogs'
  import { Loading } from 'quasar'
  import { useSnackbar } from '../../composables/Snackbar'

  const emit = defineEmits<{ 
    reload: []
    statusChanged: []
  }>()

  const { 
    apiKeys,
    columns,
    deleteApiKey,
    deleteApiKeys,
    loadApiKeys,
    rowsPerPage,
    acceptRowsPerPage,
    apikeysStore,
    isCurrentApiKey  } = useApiKeysTable(emit)

  const dialog = ref(false)
  const t = useTranslation()
  const selectedApiKeys = ref([])
  const { showSnackbar } = useSnackbar()

  const deleteSelectedApiKeys = async () => {
    const confirmed = await askConfirm(t('security.apiKeys_result.delete.confirm_multiple', { count: selectedApiKeys.value.length }))
    if (!confirmed) return

    Loading.show()
    const idsToDelete = selectedApiKeys.value.map((apiKey: any) => apiKey.id)
    const results = await deleteApiKeys(idsToDelete)
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
        body: t('security.apiKeys_result.delete.growl_multiple_success', { count: successfulDeletions })
      })
    }

    if (failedDeletions > 0) {
      showSnackbar({
        apiError: true,
        networkError: false,
        loading: false,
        apiErrorMessage: t('security.apiKeys_result.delete.growl_multiple_fail', { count: failedDeletions }),
        status: 500
      })
    }
    selectedApiKeys.value = []
  }
</script>
