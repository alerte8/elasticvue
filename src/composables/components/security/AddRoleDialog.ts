import { ref, watch } from 'vue'
import { useElasticsearchAdapter } from '../../CallElasticsearch'
import { handleError } from '../../../helpers/error'

export const useAddRoleDialog = (props: any, emit: any) => {
  const { callElasticsearch } = useElasticsearchAdapter()

  const dialog = ref(props.modelValue)
  watch(() => props.modelValue, value => (dialog.value = value))

  const newRole = ref({
    name: '',
    cluster: '',
    indices: ''
  })

  const reset = () => {
    newRole.value = {
      name: '',
      cluster: '',
      indices: ''
    }
  }

  watch(dialog, value => {
    if (props.modelValue !== value) {
      emit('update:modelValue', value)
    }

    if (!value) {
      reset()
    }
  })

  const loading = ref(false)
  const create = async () => {
    loading.value = true
    try {
      const body: any = {
        cluster: [newRole.value.cluster],
        indices: [{
          names: [newRole.value.indices],
          privileges: ['all']
        }]
      }

      await callElasticsearch('createRole', { name: newRole.value.name, body })
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
    newRole,
    loading,
    create
  }
}
