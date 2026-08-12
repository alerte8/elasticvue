import { useRoute, useRouter } from 'vue-router'
import { useConnectionStore } from '../store/connection.ts'
import { clusterVersionGt } from '../helpers/minClusterVersion.ts'
import { useRestStore } from '../store/rest.ts'
import { useRestQueryTabs } from './components/rest/RestQueryTabs.ts'
import { usesearchDocumentsFormTabs } from './components/search/SearchDocumentsTabs.ts'

// Ordre des "fonctions" du bandeau de navigation (voir AppHeader.vue), utilise par CTRL+SHIFT+TAB.
const NAV_ORDER = ['home', 'nodes', 'shards', 'indices', 'search', 'rest', 'security', 'snapshot_repositories', 'settings']

export const useGlobalKeyboardShortcuts = () => {
  const route = useRoute()
  const router = useRouter()
  const connectionStore = useConnectionStore()

  const visibleNavRoutes = () => NAV_ORDER.filter(name => {
    if (['nodes', 'shards', 'snapshot_repositories'].includes(name) && connectionStore.serverless) return false
    if (name === 'security' && !clusterVersionGt(6)) return false
    return true
  })

  const cycleFeature = () => {
    if (!connectionStore.activeCluster) return

    const order = visibleNavRoutes()
    const currentIndex = order.indexOf(route.name as string)
    const nextName = order[currentIndex === -1 ? 0 : (currentIndex + 1) % order.length]
    router.push({ name: nextName, params: route.params })
  }

  const cycleSearchTab = () => {
    const { tabs, activeTabName } = usesearchDocumentsFormTabs()
    if (tabs.value.length < 2) return

    const currentIndex = tabs.value.findIndex(tab => tab.name === activeTabName.value)
    const nextTab = tabs.value[(currentIndex + 1) % tabs.value.length]
    activeTabName.value = nextTab.name
  }

  const cycleRestTab = () => {
    const restStore = useRestStore()
    const { tabs } = useRestQueryTabs()
    if (tabs.value.length < 2) return

    restStore.activeTabIndex = (restStore.activeTabIndex + 1) % tabs.value.length
  }

  const reopenClosedTab = () => {
    if (route.name === 'search') {
      usesearchDocumentsFormTabs().reopenLastClosedTab()
    } else if (route.name === 'rest') {
      useRestQueryTabs().reopenLastClosedTab()
    }
  }

  const duplicateActiveTab = () => {
    if (route.name === 'search') {
      const { activeTabIndex, duplicateTab } = usesearchDocumentsFormTabs()
      if (activeTabIndex.value < 0) return
      duplicateTab(activeTabIndex.value)
    } else if (route.name === 'rest') {
      const restStore = useRestStore()
      const { tabs, duplicateTab } = useRestQueryTabs()
      if (restStore.activeTabIndex < 0 || restStore.activeTabIndex >= tabs.value.length) return
      duplicateTab(restStore.activeTabIndex)
    }
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (!event.ctrlKey) return

    if (event.key === 'Tab') {
      event.preventDefault()

      if (event.shiftKey) {
        cycleFeature()
      } else if (route.name === 'search') {
        cycleSearchTab()
      } else if (route.name === 'rest') {
        cycleRestTab()
      }
      return
    }

    if (route.name !== 'search' && route.name !== 'rest') return

    if (event.shiftKey && !event.altKey && event.key.toLowerCase() === 't') {
      event.preventDefault()
      reopenClosedTab()
      return
    }

    // Avec Alt enfonce, event.key depend de la disposition clavier (Alt+d donne '∂' sur macOS),
    // d'ou le test sur event.code qui designe la touche physique.
    if (event.altKey && !event.shiftKey && (event.code === 'KeyD' || event.key.toLowerCase() === 'd')) {
      event.preventDefault()
      duplicateActiveTab()
    }
  }

  return { handleKeydown }
}
