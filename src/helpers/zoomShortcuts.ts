import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'
import { onMounted, onUnmounted } from 'vue'
import { buildConfig } from '../buildConfig.ts'

export function useZoomShortcuts(resetZoom: () => void) {
  onMounted( async () => {
    if (!buildConfig.tauri) return
    await register('CommandOrControl+Numpad0', resetZoom)
  })

  onUnmounted(async () => {
    if (!buildConfig.tauri) return
    await unregisterAll()
  })
}
