<template>
  <q-card>    
    <q-card-section>
      <div class="row q-mb-md items-center justify-between">
        <div />
        <div>
          <q-btn color="primary" flat icon="add" class="q-mr-sm" @click="dialog = true" :label="t('security.add_apikey')" />
          <add-api-key-dialog v-model="dialog" @created="loadApiKeys" />
        </div>
      </div>
      <q-table
        v-model:pagination="apikeysStore.pagination"
        :rows="apiKeys"
        :columns="columns"
        :rows-per-page-options="DEFAULT_ROWS_PER_PAGE"
        row-key="id"
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

  const emit = defineEmits<{ 
    reload: []
    statusChanged: []
  }>()

  const { 
    apiKeys,
    columns,
    deleteApiKey,
    loadApiKeys,
    rowsPerPage,
    acceptRowsPerPage,
    apikeysStore,
    isCurrentApiKey  } = useApiKeysTable(emit)

  const dialog = ref(false)
  const t = useTranslation()
</script>
