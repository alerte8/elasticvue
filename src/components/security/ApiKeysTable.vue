<template>
  <q-card>    
    <q-card-section>
      <div class="row q-mb-md items-center justify-between">
        <div class="col-6">
          <q-input
            v-model="filterText"
            dense
            outlined
            clearable
            :placeholder="t('defaults.filter.label')"
            class="q-mr-md"
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
        <div>
          <q-btn color="negative" flat icon="delete" class="q-mr-sm" :label="t('defaults.delete')" :disable="selectedApiKeys.length === 0" @click="deleteSelectedApiKeys" />
          <q-btn color="primary" flat icon="add" class="q-mr-sm" @click="dialog = true" :label="t('security.add_apikey')" />
          <add-api-key-dialog v-model="dialog" @created="loadApiKeys" />
        </div>
      </div>
       <q-table
        v-model:pagination="apikeysStore.pagination"
        v-model:selected="selectedApiKeys"
        :rows="filteredApiKeys"
        :columns="columns"
        :rows-per-page-options="DEFAULT_ROWS_PER_PAGE"
        row-key="id"
        selection="multiple"
        dense
      >
        <template #body-cell-actions="props">
          <q-tr :props="props">
            <q-td v-for="col in props.cols" :key="col.name" :props="props">
              <template v-if="col.name === 'actions'">
                <q-btn
                  color="negative"
                  icon="delete"
                  size="sm"
                  :disable="isCurrentApiKey(props.row.id)"
                  @click="deleteApiKey(props.row.id)"
                />
              </template>
              <template v-else-if="col.name === 'creation'">
                <div v-html="new Date(col.value).toLocaleString()" />
              </template>
              <template v-else-if="col.name === 'expiration'">
                <div v-html="col.value ? new Date(col.value).toLocaleString() : 'Never'" />
              </template>
              <template v-else-if="col.name === 'invalidated'">
                <q-chip 
                  :color="col.value ? 'negative' : 'positive'" 
                  :label="col.value ? 'Invalidated' : 'Active'"
                  size="sm"
                />
              </template>
              <template v-else>
                {{ col.value }}
              </template>
            </q-td>
            
            <q-menu 
              v-if="props.row.metadata && Object.keys(props.row.metadata).length > 0"
              anchor="center middle"
              self="center middle"
              :offset="[0, 10]"
              max-width="600px"
            >
              <q-card style="max-height: 400px; overflow-y: auto;">
                <q-card-section>
                  <code-editor
                    :model-value="JSON.stringify({ role_descriptors: props.row.role_descriptors, metadata: props.row.metadata }, null, 2)"
                    language="json"
                    :read-only="true"
                    :height="400"
                  />
                </q-card-section>
              </q-card>
            </q-menu>
          </q-tr>
        </template>

        <template #bottom="scope">
          <table-bottom v-model="apikeysStore.pagination.rowsPerPage"
                        :scope="scope"
                        :total="filteredApiKeys.length"
                        :rows-per-page="rowsPerPage"                        
                        @rows-per-page-accepted="acceptRowsPerPage" />
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
  import { ref, computed } from 'vue'
  import { useTranslation } from '../../composables/i18n'
  import { askConfirm } from '../../helpers/dialogs'
  import { Loading } from 'quasar'
  import { useSnackbar } from '../../composables/Snackbar'
  import CodeEditor from '../shared/CodeEditor.vue'
  
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
  const filterText = ref('')

  const filteredApiKeys = computed(() => {
    if (!filterText.value) return apiKeys.value

    const search = filterText.value.toLowerCase()
    return apiKeys.value.filter((apiKey: any) => {
      return (
        apiKey.name?.toLowerCase().includes(search) ||
        apiKey.username?.toLowerCase().includes(search) ||
        apiKey.id?.toLowerCase().includes(search) ||
        JSON.stringify(apiKey.metadata || {}).toLowerCase().includes(search) ||
        JSON.stringify(apiKey.role_descriptors || {}).toLowerCase().includes(search)
      )
    })
  })

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
