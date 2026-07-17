import { defineStore } from 'pinia'
import type { StateTree } from 'pinia'
import { pinia } from '../plugins/pinia.ts'
import { useSettingsStore } from './settings.ts'

export enum BuildFlavor {
  serverless = 'serverless',
  default = 'default'
}

export enum AuthType {
  none = 'none',
  basicAuth = 'basicAuth',
  apiKey = 'apiKey',
  awsIAM = 'awsIAM'
}

export type ElasticsearchCluster = {
  clusterName: string
  version: string
  majorVersion: string
  distribution: string
  uuid: string
  status: string
  loading?: boolean
  predefined?: boolean
  flavor: BuildFlavor
} & ElasticsearchClusterConnection

export type ElasticsearchClusterConnection = {
  name: string
  uri: string
  auth: ElasticsearchClusterAuth
}

export type ElasticsearchClusterAuth =
  | {
      authType: AuthType.none
      authData: object
    }
  | {
      authType: AuthType.basicAuth
      authData: { username: string; password: string }
    }
  | {
      authType: AuthType.apiKey
      authData: { apiKey: string }
    }
  | {
      authType: AuthType.awsIAM
      authData: { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string }
    }

export type ConnectionState = {
  clusters: ElasticsearchCluster[]
  activeClusterIndex: number | null
}

export const useConnectionStore = defineStore('connection', {
  state: (): ConnectionState => {
    return {
      clusters: [],
      activeClusterIndex: null
    }
  },
  getters: {
    activeCluster(): ElasticsearchCluster | null {
      if (typeof this.activeClusterIndex !== 'number') return null
      return this.clusters[this.activeClusterIndex]
    },
    serverless(): boolean {
      if (typeof this.activeClusterIndex !== 'number') return false
      return this.clusters[this.activeClusterIndex].flavor === BuildFlavor.serverless
    },
    activeClusterNeedsPassword(): boolean {
      return clusterNeedsPassword(this.activeCluster)
    }
  },
  actions: {
    addCluster(cluster: ElasticsearchCluster) {
      const len = this.clusters.push(Object.assign({}, cluster))
      this.activeClusterIndex = len - 1
      return this.activeClusterIndex
    },
    updateCluster({ cluster, index }: { cluster: ElasticsearchClusterConnection; index: number }) {
      const old = this.clusters[index]
      this.clusters[index] = cleanupClusterAuth(Object.assign({}, old, cluster))
    },
    removeCluster(index: number) {
      this.clusters.splice(index, 1)
    },
    purgeStoredConnectionPasswords() {
      this.clusters = stripBasicAuthPasswords(this.clusters)
    },
    checkAndSetActiveCluster() {
      if (this.activeClusterIndex === null || this.clusters.length === 0) return
      if (!this.clusters[this.activeClusterIndex]) this.activeClusterIndex = 0

      return this.clusters[this.activeClusterIndex]
    },
    validateAndSetClusterIndex(index: string) {
      if (index === null || this.clusters.length === 0) return

      let clusterIndex: number = 0
      try {
        clusterIndex = parseInt(index)
      } catch (_e) {}

      if (isNaN(clusterIndex) || clusterIndex + 1 > this.clusters.length || clusterIndex < 0) {
        this.activeClusterIndex = 0
        return false
      } else {
        this.activeClusterIndex = clusterIndex
        return true
      }
    }
  },
  persist: {
    serializer: {
      serialize: (data: StateTree) => {
        const settingsStore = useSettingsStore(pinia)
        if (settingsStore.rememberConnectionPasswords) return JSON.stringify(data)

        return JSON.stringify({ ...data, clusters: stripBasicAuthPasswords(data.clusters as ElasticsearchCluster[]) })
      },
      deserialize: (data: string) => JSON.parse(data)
    }
  }
})

export const clusterNeedsPassword = (cluster: ElasticsearchCluster | null | undefined): boolean => {
  return !!cluster && cluster.auth.authType === AuthType.basicAuth && !cluster.auth.authData.password
}

export const stripBasicAuthPasswords = (clusters: ElasticsearchCluster[]): ElasticsearchCluster[] => {
  return clusters.map((cluster) => {
    if (cluster.auth.authType !== AuthType.basicAuth) return cluster

    return {
      ...cluster,
      auth: {
        authType: AuthType.basicAuth,
        authData: { ...cluster.auth.authData, password: '' }
      }
    }
  })
}

const cleanupClusterAuth = (cluster: ElasticsearchCluster): ElasticsearchCluster => {
  switch (cluster.auth.authType) {
    case AuthType.none:
      return {
        ...cluster,
        auth: {
          authType: AuthType.none,
          authData: {}
        }
      }
    case AuthType.basicAuth:
      return {
        ...cluster,
        auth: {
          authType: AuthType.basicAuth,
          authData: {
            username: cluster.auth.authData.username,
            password: cluster.auth.authData.password
          }
        }
      }
    case AuthType.apiKey:
      return {
        ...cluster,
        auth: {
          authType: AuthType.apiKey,
          authData: {
            apiKey: cluster.auth.authData.apiKey
          }
        }
      }
    case AuthType.awsIAM:
      return {
        ...cluster,
        auth: {
          authType: AuthType.awsIAM,
          authData: {
            accessKeyId: cluster.auth.authData.accessKeyId,
            secretAccessKey: cluster.auth.authData.secretAccessKey,
            sessionToken: cluster.auth.authData.sessionToken,
            region: cluster.auth.authData.region
          }
        }
      }
  }
}
