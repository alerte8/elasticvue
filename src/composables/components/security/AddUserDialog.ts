import { ref, watch } from 'vue'
import { useElasticsearchRequest } from '../../CallElasticsearch'
import { handleError } from '../../../helpers/error'

export const useAddUserDialog = (props: any, emit: any) => {
  const dialog = ref(false)
  const username = ref('')
  const roles = ref<string[]>([])
  const password = ref('')
  const roleOptions = ref<string[]>([])

  const { data: rolesData, load: loadRoles } = useElasticsearchRequest('getRoles')

  watch(rolesData, (val) => {
    if (!val) return
    roleOptions.value = Object.keys(val)
    if (roleOptions.value.length > 0) roles.value = [roleOptions.value[0]]
  })

  const reset = () => {
    username.value = ''
    password.value = ''
    roles.value = roleOptions.value.length > 0 ? [roleOptions.value[0]] : []
  }

  watch(() => props.modelValue, (v) => (dialog.value = !!v))
  watch(dialog, (v) => {
    emit('update:modelValue', v)
    if (v) {
      loadRoles()
    } else {
      reset()
    }
  })

  const submit = async () => {
    if (!username.value || roles.value.length === 0 || !password.value) return

    try {
      await props.createUser(username.value, roles.value, password.value)
      emit('created')
      dialog.value = false
    } catch (e) {
      handleError(e)
    }
  }

  return {
    dialog,
    username,
    roles,
    password,
    roleOptions,
    submit
  }
}