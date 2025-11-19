import { ref, watch } from 'vue'
import { useElasticsearchAdapter } from '../../CallElasticsearch'
import { handleError } from '../../../helpers/error'
import { NewApiKey } from '../../../store/apikeys'

export const useAddApiKeyDialog = (props: any, emit: any) => {
  const { callElasticsearch } = useElasticsearchAdapter()

  const dialog = ref(props.modelValue)
  watch(dialog, value => {
    if (props.modelValue !== value) {
      emit('update:modelValue', value)
    }
  })
  watch(() => props.modelValue, value => (dialog.value = value))

  const newApiKey = ref<NewApiKey>({
    name: '',
    expiration: '',
    roles: []
  })

  const roles = ref([])
  const loadRoles = async () => {
    try {
      const response = await callElasticsearch('getRoles')
      roles.value = Object.keys(response)
    } catch (e) {
      handleError(e)
      roles.value = []
    }
  }
  watch(dialog, value => {
    if (value) {
      loadRoles()
    }
  })

  const loading = ref(false)
  const create = async () => {
    loading.value = true
    try {
      const body: any = {
        name: newApiKey.value.name,
        role_descriptors: {}
      }
      if (newApiKey.value.expiration) {
        body.expiration = newApiKey.value.expiration
      }
      if (newApiKey.value.roles.length > 0) {
        body.role_descriptors = newApiKey.value.roles.reduce((acc: any, role: string) => {
          acc[role] = { cluster: ['all'], index: [{ names: ['*'], privileges: ['all'] }] }
          return acc
        }, {})
      }

      await callElasticsearch('createApiKey', { body })
      emit('created')
      dialog.value = false
    } catch (e) {
      handleError(e)
    } finally {
      loading.value = false
    }
  }

  return {
    dialog,
    newApiKey,
    roles,
    loading,
    create
  }
}
