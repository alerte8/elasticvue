import { defineStore } from 'pinia'

type SettingsState = {
  checkForUpdates: boolean
  rememberConnectionPasswords: boolean
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    checkForUpdates: false,
    rememberConnectionPasswords: true
  }),
  persist: true
})