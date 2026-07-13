<template>
  <div>
    <q-card class="q-mb-md">
      <q-card-section class="flex items-center">
        <h1 class="text-h5 q-my-none">
          {{ t('cluster_nodes.heading') }}
        </h1>
        <reload-button :action="load" v-model="nodesStore.reloadInterval" />
      </q-card-section>

      <q-separator />

      <loader-status :request-state="requestState">
        <nodes-table :nodes="data || []">
          <q-select
            v-model="nodesStore.nodeRoles"
            :options="nodeRoleOptions"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            :label="t('cluster_nodes.node_role')"
            multiple
            dense
            outlined
            style="width: 200px"
          />
        </nodes-table>
      </loader-status>
    </q-card>

    <q-card class="inline-block text-body2">
      <q-card-section class="q-pa-sm">
        <table class="text-muted">
          <tbody>
            <tr>
              <td>
                <q-icon name="star" size="xs" />
              </td>
              <td>{{ t('cluster_nodes.node_icons.master.title') }}</td>
            </tr>
            <tr>
              <td>
                <q-icon name="star_outline" size="xs" />
              </td>
              <td>{{ t('cluster_nodes.node_icons.master_eligible.title') }}</td>
            </tr>
            <tr>
              <td>
                <q-icon name="save" size="xs" />
              </td>
              <td>{{ t('cluster_nodes.node_icons.data.title') }}</td>
            </tr>
            <tr>
              <td>
                <q-icon name="drive_file_move" size="xs" />
              </td>
              <td>{{ t('cluster_nodes.node_icons.ingest.title') }}</td>
            </tr>
            <tr>
              <td>
                <q-icon name="route" size="xs" />
              </td>
              <td>{{ t('cluster_nodes.node_icons.coordinating_only.title') }}</td>
            </tr>
            <tr>
              <td>
                <q-icon name="psychology" size="xs" />
              </td>
              <td>{{ t('cluster_nodes.node_icons.ml.title') }}</td>
            </tr>
            <tr>
              <td>
                <q-icon name="folder" size="xs" />
              </td>
              <td>{{ t('cluster_nodes.node_icons.content.title') }}</td>
            </tr>
            <tr>
              <td>
                <q-icon name="transform" size="xs" />
              </td>
              <td>{{ t('cluster_nodes.node_icons.transform.title') }}</td>
            </tr>
          </tbody>
        </table>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, Ref, ref } from 'vue'
import ReloadButton from '../shared/ReloadButton.vue'
import LoaderStatus from '../shared/LoaderStatus.vue'
import NodesTable from './NodesTable.vue'
import { useElasticsearchAdapter } from '../../composables/CallElasticsearch'
import { useTranslation } from '../../composables/i18n'
import { EsNode, NodeAttributes } from '../../types/types.ts'
import { flattenObj } from '../../helpers/flatten.ts'
import { useNodesStore } from '../../store/nodes.ts'

const t = useTranslation()
const nodesStore = useNodesStore()

const nodeRoleOptions = computed(() => [
  { value: 'm', label: t('cluster_nodes.node_icons.master_eligible.title') },
  { value: 'd', label: t('cluster_nodes.node_icons.data.title') },
  { value: 'i', label: t('cluster_nodes.node_icons.ingest.title') },
  { value: '-', label: t('cluster_nodes.node_icons.coordinating_only.title') },
  { value: 'c', label: t('cluster_nodes.node_icons.cold.title') },
  { value: 'f', label: t('cluster_nodes.node_icons.frozen.title') },
  { value: 'h', label: t('cluster_nodes.node_icons.hot.title') },
  { value: 'l', label: t('cluster_nodes.node_icons.ml.title') },
  { value: 'r', label: t('cluster_nodes.node_icons.remote_cluster_client.title') },
  { value: 's', label: t('cluster_nodes.node_icons.content.title') },
  { value: 't', label: t('cluster_nodes.node_icons.transform.title') },
  { value: 'v', label: t('cluster_nodes.node_icons.voting_only.title') },
  { value: 'w', label: t('cluster_nodes.node_icons.warm.title') }
])

const CAT_METHOD_PARAMS = {
  h: [
    'ip',
    'id',
    'name',
    'version',
    'heap.percent',
    'heap.current',
    'heap.max',
    'ram.percent',
    'ram.current',
    'ram.max',
    'node.role',
    'master',
    'cpu',
    'load_1m',
    'load_5m',
    'load_15m',
    'disk.used_percent',
    'disk.used',
    'disk.total',
    'shards' // es >= 8
  ],
  full_id: true
}

const data: Ref<EsNode[]> = ref([])
const { requestState, callElasticsearch } = useElasticsearchAdapter()
const load = async () => {
  data.value = []
  const catNodes = callElasticsearch('catNodes', CAT_METHOD_PARAMS)
  const nodesInfo = callElasticsearch('nodes')

  const [nodes, nodeAttributes]: [EsNode[], NodeAttributes] = await Promise.all([catNodes, nodesInfo])

  data.value = nodes.map((node) => {
    const attributes = flattenObj(nodeAttributes.nodes[node.id]?.settings?.node?.attr)
    return Object.assign({}, node, { attributes })
  })
}

onMounted(load)
</script>
