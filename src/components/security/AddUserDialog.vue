<template>
  <q-dialog v-model="dialog" persistent>
    <q-card style="min-width: 420px">
      <q-card-section>
        <div class="text-h6">{{ t('security.add_user') }}</div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <q-form @submit.prevent="submit">
          <div class="q-mb-md">
            <q-input v-model="username" :label="t('security.user_form.username')" outlined />
          </div>

          <div class="q-mb-md">
            <q-select
              v-model="roles"
              :options="roleOptions"
              :label="t('security.user_form.role')"
              multiple
              use-chips
              outlined
            />
          </div>

          <div class="q-mb-md">
            <q-input v-model="password" type="password" :label="t('security.user_form.password')" outlined />
          </div>

          <div class="row justify-end">
            <q-btn flat :label="t('defaults.cancel')" @click="dialog = false" />
            <q-btn color="primary-dark" class="q-ml-sm" :label="t('security.user_form.create')" type="submit" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">

  import { useTranslation } from '../../composables/i18n'

  import { useAddUserDialog } from '../../composables/components/security/AddUserDialog'



  const props = defineProps<{

      modelValue?: boolean

      createUser: (username: string, roles: string[], password: string) => Promise<any>

  }>()



  const emit = defineEmits(['update:modelValue', 'created'])

  const t = useTranslation()

  const { dialog, username, roles, password, roleOptions, submit } = useAddUserDialog(props, emit)

</script>
