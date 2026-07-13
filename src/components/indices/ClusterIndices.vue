<template>
  <q-card>
    <q-card-section class="flex items-center">
      <h1 class="text-h5 q-my-none">
        {{ t('indices.heading') }}
      </h1>
      <reload-button :action="load" v-model="indicesStore.reloadInterval" />
    </q-card-section>

    <q-separator />

    <loader-status :request-state="requestState">
      <indices-table :indices="data || []" @reload="load" />
    </loader-status>
  </q-card>
</template>

<script setup lang="ts">
import IndicesTable from './IndicesTable.vue'
import LoaderStatus from '../shared/LoaderStatus.vue'
import ReloadButton from '../shared/ReloadButton.vue'
import { useTranslation } from '../../composables/i18n.ts'
import { useClusterIndices } from '../../composables/components/indices/ClusterIndices.ts'

const t = useTranslation()
const { indicesStore, requestState, data, load } = useClusterIndices()
</script>
