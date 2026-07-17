<template>
  <q-dialog :model-value="show" persistent no-esc-dismiss no-backdrop-dismiss>
    <q-card style="min-width: 400px">
      <q-card-section>
        <h2 class="text-h6 q-my-none">
          {{ t('base.connection_password_prompt.heading') }}
        </h2>
        <div class="text-caption text-grey">
          {{ t('base.connection_password_prompt.message', { name: connectionStore.activeCluster?.name }) }}
        </div>
      </q-card-section>

      <q-separator />

      <q-form @submit.prevent="submit">
        <q-card-section>
          <custom-input :model-value="username" outlined readonly :label="t('setup.test_and_connect.form.username.label')" />

          <custom-input
            v-model="password"
            autofocus
            outlined
            autocomplete="off"
            class="q-mt-md"
            :rules="[(val) => !!val || 'required']"
            :label="t('setup.test_and_connect.form.password.label')"
            :type="passwordVisible ? 'text' : 'password'"
          >
            <template #append>
              <q-icon
                :name="passwordVisible ? 'visibility' : 'visibility_off'"
                class="cursor-pointer"
                @click="passwordVisible = !passwordVisible"
              />
            </template>
          </custom-input>
        </q-card-section>

        <q-card-section class="flex items-center justify-between">
          <q-btn type="submit" color="primary" :label="t('base.connection_password_prompt.submit')" />
          <q-btn flat :label="t('base.connection_password_prompt.go_to_settings')" @click="goToSettings" />
        </q-card-section>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AuthType, useConnectionStore } from '../../store/connection.ts'
import { checkHealth } from '../../composables/components/home/ClusterHealth.ts'
import { useTranslation } from '../../composables/i18n.ts'
import CustomInput from '../shared/CustomInput.vue'

const t = useTranslation()
const connectionStore = useConnectionStore()
const route = useRoute()
const router = useRouter()

const username = computed(() => {
  const cluster = connectionStore.activeCluster
  return cluster && cluster.auth.authType === AuthType.basicAuth ? cluster.auth.authData.username : ''
})

// Le dialog reste masqué sur la page paramètres, seule page accessible sans identifiants.
const show = computed(() => connectionStore.activeClusterNeedsPassword && route.name !== 'settings')

const password = ref('')
const passwordVisible = ref(false)

const submit = () => {
  if (!password.value) return
  if (typeof connectionStore.activeClusterIndex !== 'number') return

  const cluster = connectionStore.clusters[connectionStore.activeClusterIndex]
  if (cluster.auth.authType === AuthType.basicAuth) {
    cluster.auth.authData.password = password.value
  }

  password.value = ''
  checkHealth(cluster)
}

const goToSettings = () => {
  router.push({ name: 'settings', params: { clusterIndex: connectionStore.activeClusterIndex } })
}
</script>
