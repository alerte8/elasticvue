import { addTrailingSlash, clusterAuthHeader } from '../helpers/elasticsearchAdapter.ts'
import { REQUEST_DEFAULT_HEADERS } from '../consts'
import { fetchMethod } from '../helpers/fetch'
import { stringifyJson } from '../helpers/json/stringify.ts'
import { cleanIndexName } from '../helpers/cleanIndexName.ts'
import { AuthType, ElasticsearchClusterConnection } from '../store/connection.ts'
import { AwsClient } from 'aws4fetch'

interface IndexGetArgs {
  routing?: string
}

export type ElasticsearchMethod = keyof ElasticsearchAdapter
const MAX_INDICES_PER_REQUEST = 16

const chunk = (array: any[], size: number) => {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, i * size + size))
}

export default class ElasticsearchAdapter {
  uri: string
  awsClient: AwsClient | null
  authHeader?: string

  constructor({ uri, auth }: ElasticsearchClusterConnection) {
    this.uri = addTrailingSlash(uri)

    if (auth.authType === AuthType.awsIAM) {
      this.awsClient = new AwsClient({
        accessKeyId: auth.authData.accessKeyId,
        secretAccessKey: auth.authData.secretAccessKey,
        sessionToken: auth.authData.sessionToken,
        region: auth.authData.region,
        service: 'es',
      })
    }

    this.authHeader = clusterAuthHeader(auth)
  }

  call(method: ElasticsearchMethod, ...args: any[]): Promise<any> {
    // @ts-expect-error dynamic function call
    return this[method](...args)
  }

  async callInChunks({
    method,
    indices,
    ...additionalParams
  }: {
    method: keyof ElasticsearchAdapter
    indices: string[]
    [key: string]: any
  }) {
    const chunks = chunk(indices, MAX_INDICES_PER_REQUEST)
    const responses = []

    for (const c of chunks) {
      const response = await this.call(method, { indices: c, ...additionalParams })
      responses.push(response)
    }

    return responses
  }

  /** routes always available **/

  ping() {
    return this.request('', 'GET')
  }

  clusterInfo() {
    return this.ping()
  }

  catIndices(params: object, filter?: string) {
    const query = filter ? `${filter}*` : ''
    return this.request(`_cat/indices/${query}`, 'GET', params)
  }

  template() {
    return this.request('_template', 'GET')
  }

  indexTemplate() {
    return this.request('_index_template', 'GET')
  }

  indexGetAlias({ index }: { index: string }) {
    return this.request(`${cleanIndexName(index)}/_alias`, 'GET')
  }

  indexAddAlias({ index, alias }: { index: string, alias: string }) {
    return this.request(`${cleanIndexName(index)}/_alias/${alias}`, 'PUT')
  }

  indexDeleteAlias({ index, alias }: { index: string, alias: string }) {
    return this.request(`${cleanIndexName(index)}/_alias/${alias}`, 'DELETE')
  }

  indexCreate({ index, body }: { index: string, body?: object }) {
    return this.request(`${cleanIndexName(index)}`, 'PUT', body)
  }

  getTask({ taskId }: { taskId: string }) {
    return this.request(`_tasks/${taskId}`, 'GET')
  }

  deleteByQuery({ index, body }: { index: string, body: any }) {
    if (body == null)
      body = { query: { match_all: {} } }
    return this.request(`${cleanIndexName(index)}/_delete_by_query?refresh=true`, 'POST', body)
  }

  indexGet(params: Record<string, any>) {
    const index = Array.isArray(params.index) ? params.index.join(',') : params.index
    return this.request(`${cleanIndexName(index)}`, 'GET')
  }

  indexStats({ index }: { index: string }) {
    return this.request(`${cleanIndexName(index)}/_stats`, 'GET')
  }

  indexDelete({ indices }: { indices: string[] }) {
    if (indices.length > MAX_INDICES_PER_REQUEST) {
      return this.callInChunks({ method: 'indexDelete', indices })
    } else {
      return this.request(cleanIndexName(indices.join(',')), 'DELETE')
    }
  }

  async indicesGetMapping({ index }: { index: string }) {

    // R�cup�rer le mapping
    const mappingResponse = await this.request(`${cleanIndexName(index)}/_mapping`, 'GET') as any
    const mapping: any = await mappingResponse.json()

    return mapping
  }

  async indexDump({ index, onProgress }: { index: string, onProgress?: (progress: { processed: number, total: number, percentage: number }) => void }) {
    try {
      // R�cup�rer le mapping
      const mappingResponse = await this.request(`${cleanIndexName(index)}/_mapping`, 'GET') as any
      const mapping: any = await mappingResponse.json()

      // Utiliser scroll API pour r�cup�rer tous les documents
      const scrollSize = 1000
      const allDocuments: any[] = []

      // Premi�re requ�te avec scroll
      const firstSearchResponse = await this.request(`${cleanIndexName(index)}/_search?scroll=5m`, 'POST', {
        query: { match_all: {} },
        size: scrollSize,
        sort: ['_doc']
      }) as any
      let scrollResponse: any = await firstSearchResponse.json()

      const totalHits = (scrollResponse.hits?.total?.value ?? scrollResponse.hits?.total) || 0
      let processed = 0

      // Traiter la premi�re batch
      const firstBatch = (scrollResponse.hits?.hits || []).map((hit: any) => ({
        _id: hit._id,
        _source: hit._source
      }))
      allDocuments.push(...firstBatch)
      processed += firstBatch.length

      // Callback de progression
      if (onProgress) {
        onProgress({
          processed,
          total: totalHits,
          percentage: Math.round((processed / totalHits) * 100)
        })
      }

      // Continuer avec scroll tant qu'il y a des documents
      while ((scrollResponse.hits?.hits || []).length > 0) {
        const nextResponse = await this.request('_search/scroll', 'POST', {
          scroll: '5m',
          scroll_id: scrollResponse._scroll_id
        }) as any
        scrollResponse = await nextResponse.json()

        if ((scrollResponse.hits?.hits || []).length > 0) {
          const batch = scrollResponse.hits.hits.map((hit: any) => ({
            _id: hit._id,
            _source: hit._source
          }))
          allDocuments.push(...batch)
          processed += batch.length

          // Callback de progression
          if (onProgress) {
            onProgress({
              processed,
              total: totalHits,
              percentage: Math.round((processed / totalHits) * 100)
            })
          }
        }
      }

      // Nettoyer le scroll
      if (scrollResponse?._scroll_id) {
        try {
          await this.request('_search/scroll', 'DELETE', {
            scroll_id: scrollResponse._scroll_id
          })
        } catch (_e) { }
      }

      return {
        success: true,
        mapping: mapping[index]?.mappings ?? mapping?.mappings ?? mapping,
        data: allDocuments,
        total: allDocuments.length
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        mapping: null,
        data: [],
        total: 0
      }
    }
  }

  async indexRestore({
    index,
    data,
    onProgress
  }: {
    index: string,
    data: { mapping: any, data: any[] },
    onProgress?: (progress: { processed: number, total: number, percentage: number, status: string }) => void
  }) {
    try {
      // Callback de progression - d�but
      if (onProgress) {
        onProgress({
          processed: 0,
          total: data.data.length,
          percentage: 0,
          status: 'Cr�ation de l\'index...'
        })
      }

      // 1. Cr�er l'index avec le mapping (seulement s'il n'existe pas)
      const exists = await this.indexExists({ index }) as unknown as boolean
      if (!exists) {
        const cleanMapping = this.fixMappingStructure(data.mapping)
        await this.request(`${cleanIndexName(index)}`, 'PUT', {
          mappings: cleanMapping
        })
      }

      if (data.data.length === 0) {
        if (onProgress) {
          onProgress({
            processed: 0,
            total: 0,
            percentage: 100,
            status: 'Index cr�� (aucune donn�e � restaurer)'
          })
        }
        return {
          success: true,
          processed: 0,
          total: 0,
          errors: []
        }
      }

      // 2. Pr�parer les documents pour bulk insert
      const bulkBody: string[] = []
      data.data.forEach(doc => {
        bulkBody.push(JSON.stringify({
          index: {
            _index: index,
            _id: doc._id
          }
        }))
        bulkBody.push(JSON.stringify(doc._source))
      })

      // 3. Ins�rer les documents par batch pour �viter les timeouts
      const batchSize = 1000
      let processed = 0
      const errors: any[] = []

      for (let i = 0; i < bulkBody.length; i += batchSize * 2) { // *2 car chaque doc = 2 lignes
        const batch = bulkBody.slice(i, i + batchSize * 2)
        const bulkRequest = batch.join('\n') + '\n'

        const response: any = await this.request('_bulk?refresh=wait_for', 'POST', bulkRequest) as any
        const json = await response.json()

        if (json.errors) {
          const batchErrors = json.items.filter((item: any) => item.index?.error)
          errors.push(...batchErrors)
        }

        processed += Math.min(batchSize, data.data.length - processed)

        // Callback de progression
        if (onProgress) {
          onProgress({
            processed,
            total: data.data.length,
            percentage: Math.round((processed / data.data.length) * 100),
            status: `Insertion des documents... (${processed}/${data.data.length})`
          })
        }
      }

      // Callback de progression - fin
      if (onProgress) {
        onProgress({
          processed: data.data.length,
          total: data.data.length,
          percentage: 100,
          status: errors.length > 0 ? `Termin� avec ${errors.length} erreurs` : 'Termin� avec succ�s'
        })
      }

      return {
        success: true,
        processed: data.data.length,
        total: data.data.length,
        errors
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        processed: 0,
        total: data.data?.length || 0,
        errors: []
      }
    }
  }

  async indexRestoreNdjson({
    index,
    file,
    onProgress
  }: {
    index: string,
    file: File,
    onProgress?: (progress: { processed: number, total: number, percentage: number, status: string }) => void
  }) {
    try {
      const fileSize = file.size
      let bytesProcessed = 0

      if (onProgress) {
        onProgress({
          processed: 0,
          total: fileSize,
          percentage: 0,
          status: 'Dmarrage du flux...'
        })
      }

      // 1. Vrifier la version du cluster
      const info = await this.clusterInfo() as any
      const version = info.version?.number || '7.0.0'
      const majorVersion = parseInt(version.split('.')[0])
      const isSevenOrNewer = majorVersion >= 7
      const tthis = this

      // 2. Prparer la lecture Streaming
      const stream = file.stream()
      const reader = stream.getReader()
      const decoder = new TextDecoder('utf-8')

      let buffer = ''
      let headerProcessed = false
      let lineCounter = 0

      const batchSize = 1000 // Paires de lignes (action + source)
      let currentBatch: string[] = []
      const errors: any[] = []

      // Fonction d'envoi batch
      const sendBatch = async (batch: string[]) => {
        if (batch.length === 0) return

        const bulkRequest = batch.join('\n') + '\n'
        const response: any = await this.request('_bulk?refresh=wait_for', 'POST', bulkRequest) as any
        const json = await response.json()

        if (json.errors) {
          const batchErrors = json.items.filter((item: any) => item.index?.error || item.create?.error)
          errors.push(...batchErrors)
        }
      }

      // 3. Boucle de lecture
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Fin du fichier : traiter ce qui reste dans le buffer
          if (buffer.trim().length > 0) {
            const lines = buffer.split(/\r?\n/)
            // Traiter les dernires lignes
            for (const line of lines) {
              if (line.trim().length === 0) continue
              await processLine(line)
            }
          }
          // Envoyer le dernier batch restant
          if (currentBatch.length > 0) await sendBatch(currentBatch)
          break
        }

        // Dcoder le fragment binaire
        bytesProcessed += value.length
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // Dcouper en lignes
        let lineEndIndex = buffer.indexOf('\n')
        while (lineEndIndex !== -1) {
          const line = buffer.slice(0, lineEndIndex)
          buffer = buffer.slice(lineEndIndex + 1)

          if (line.trim().length > 0) {
            await processLine(line)
          }

          lineEndIndex = buffer.indexOf('\n')
        }

        // Update progress
        if (onProgress) {
          onProgress({
            processed: bytesProcessed,
            total: fileSize,
            percentage: Math.round((bytesProcessed / fileSize) * 100),
            status: `Import en cours... (${(bytesProcessed / 1024 / 1024).toFixed(1)} MB)`
          })
        }
      }

      // Fonction Helper : Traitement d'une ligne unique
      async function processLine(lineStr: string) {
        // Gestion du Header (lignes 0)
        if (!headerProcessed) {
          try {
            const header = JSON.parse(lineStr)
            if (header.mappings || header.settings) {
              headerProcessed = true
              // Cration de l'index si ncessaire
              const exists = await tthis.indexExists({ index }) as unknown as boolean
              if (!exists) {
                const settings = header?.settings || {}
                let mappings = header?.mappings || {}
                if (settings.index) {
                  const { uuid, version, creation_date, provided_name, ...restIndex } = settings.index
                  settings.index = restIndex
                }
                mappings = tthis.fixMappingStructure(mappings, isSevenOrNewer)

                await tthis.request(`${cleanIndexName(index)}`, 'PUT', { settings, mappings })
              }
              return // Ligne consome
            }
          } catch (e) { /* ignore */ }

          // Si on est l, ce n'tait pas un header valide ou le header est dj pass.
          // On considre que c'est une ligne de donnes (action ou source).
          // Mais le header est "processed" implicitement si on n'en trouve pas, 
          // on suppose que l'index existe dj ou qu'on s'en fiche.
          headerProcessed = true
        }

        // Traitement Donnes
        // On doit appairer : Action -> Source.
        // Ici on stream ligne par ligne. On a besoin de contexte.
        // MAIS l'API bulk accepte "Action \n Source \n Action \n Source".
        // Donc on peut juste parser l'Action pour corriger l'index/type, 
        // et laisser passer la Source telle quelle.

        try {
          // Essayons de voir si c'est une ligne Action
          // Une ligne action contient "index" ou "create" ou "delete" ou "update"
          // Un document source peut tout contenir.
          // Heureusement l'elasticdump est rgulier : Action puis Source.

          // Astuce : On modifie JUSTE les lignes d'action. On touche les autres si ncessaire ?
          // En fait, on a besoin de savoir si on est sur une ligne Action pour la Rewrite.
          // On peut utiliser la parit : Ligne 0 = Action, Ligne 1 = Source (aprs header).

          // Wait, elasticdump header is 1 line. Data starts after.
          // Donc si on a eu un header, lineCounter est reset. 
          // Si on incremente lineCounter que pour les datas : 
          // Pair (0, 2...) = Action. Impair (1, 3...) = Source.

          const isActionLine = (lineCounter % 2) === 0

          if (isActionLine) {
            const action = JSON.parse(lineStr)
            // Rewrite Action
            if (action.index) {
              action.index._index = index
              if (isSevenOrNewer) delete action.index._type
              else if (!action.index._type) action.index._type = '_doc'
            } else if (action.create) {
              action.create._index = index
              if (isSevenOrNewer) delete action.create._type
            }
            currentBatch.push(JSON.stringify(action))
          } else {
            // Source Line : On passe brut
            currentBatch.push(lineStr)
          }

          lineCounter++

          // Flush Check
          if (currentBatch.length >= batchSize * 2) {
            await sendBatch(currentBatch)
            currentBatch = []
          }

        } catch (e) {
          console.warn('Skipping bad line', e)
        }
      }

      // Callback de progression - fin
      if (onProgress) {
        onProgress({
          processed: bytesProcessed,
          total: fileSize,
          percentage: 100,
          status: errors.length > 0 ? `Termin avec ${errors.length} erreurs` : 'Termin avec succs'
        })
      }

      return {
        success: true,
        processed: Math.floor(lineCounter / 2),
        total: Math.floor(lineCounter / 2),
        errors
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        processed: 0,
        total: 0,
        errors: []
      }
    }
  }

  // Fonction pour nettoyer et corriger la structure du mapping
  fixMappingStructure(mapping: any, removeType: boolean = false): any {
    if (!mapping) return { properties: {} }

    // Structure cible : { properties: { ... } }

    // 1. Dtecter si on a une racine de type (ex: "my_type": { properties: ... })
    let cleanProperties = mapping.properties

    if (!cleanProperties) {
      // Chercher une cl qui contient 'properties'
      const keys = Object.keys(mapping)
      for (const key of keys) {
        if (mapping[key] && typeof mapping[key] === 'object' && mapping[key].properties) {
          // On a trouv un type wrapper
          cleanProperties = mapping[key].properties
          break
        }
      }
    }

    // Si toujours rien, on assume que mapping EST la liste des champs (rare mais possible ds certains formats plats)
    if (!cleanProperties && Object.keys(mapping).length > 0 && !mapping.properties) {
      // Attention : Risqu, mais fallback
      cleanProperties = mapping
    }

    if (!cleanProperties) cleanProperties = {}

    // 2. Si on doit supprimer les types (ES 7+), on retourne { properties: cleanProperties } directement
    // Cela "aplatit" structurellement le mapping au format standard 7+

    // Note: ES 7 accepte { "mappings": { "properties": ... } }
    // ES 6 attendait { "mappings": { "doc": { "properties": ... } } }

    // Cette fonction retourne l'objet qui va DANS "mappings": ...

    if (removeType) {
      return { properties: cleanProperties }
    } else {
      // Pour les vieux clusters, on essaye de garder une structure compatible
      // Si l'entre avait dj un type, on le perd ici si on ne fait pas attention
      // Mais comme on standardise, on peut wrapper dans "_doc" ou laisser tel quel si le serveur est permissif
      // Le plus sr pour < 7 est souvent de ne pas trop toucher si a marchait, 
      // mais ici on standardise pour l'import universel.

      // Si on veut tre trs compatible < 7, on devrait peut-tre wrapper dans "type_placeholder" 
      // ou rutiliser le nom de l'index comme type.
      // Simplification : on renvoie properties direct, la plupart des ES 6.x rcents grent a ou dfaut  _doc.
      return { properties: cleanProperties }
    }
  }

  indexRefresh({ indices }: { indices: string[] }) {
    if (indices.length > MAX_INDICES_PER_REQUEST) {
      return this.callInChunks({ method: 'indexRefresh', indices })
      return this.request(`${cleanIndexName(indices.join(','))}/_refresh`, 'POST')
    }
  }

  indexClearCache({ indices }: { indices: string[] }) {
    if (indices.length > MAX_INDICES_PER_REQUEST) {
      return this.callInChunks({ method: 'indexClearCache', indices })
    } else {
      return this.request(`${cleanIndexName(indices.join(','))}/_cache/clear`, 'POST')
    }
  }

  indexFlush({ indices }: { indices: string[] }) {
    if (indices.length > MAX_INDICES_PER_REQUEST) {
      return this.callInChunks({ method: 'indexFlush', indices })
    } else {
      return this.request(`${cleanIndexName(indices.join(','))}/_flush`, 'POST')
    }
  }

  async indexClear({ indices, onProgress }: { indices: string[], onProgress?: (progress: { processed: number, total: number, percentage: number, status: string }) => void }) {
    const body = { query: { match_all: {} } }
    const response: any = await this.request(`${cleanIndexName(indices.join(','))}/_delete_by_query?refresh=true&wait_for_completion=false`, 'POST', body)
    const taskId = (await response.json()).task

    if (taskId && onProgress) {
      onProgress({ processed: 0, total: 1, percentage: 0, status: 'Task started' })

      const poll = async () => {
        try {
          const taskResponse: any = await this.getTask({ taskId })
          const taskJson = await taskResponse.json()

          if (taskJson.completed) {
            const total = taskJson.task.status.total || 0
            const processed = taskJson.task.status.deleted || 0
            onProgress({ processed, total, percentage: 100, status: 'Completed' })
          } else {
            const total = taskJson.task.status.total || 0
            const processed = taskJson.task.status.deleted || 0
            const percentage = total > 0 ? Math.round((processed / total) * 100) : 0
            onProgress({ processed, total, percentage, status: 'In progress...' })
            setTimeout(poll, 1000)
          }
        } catch (e) {
          console.error(e)
          // Stop polling on error
        }
      }
      setTimeout(poll, 1000)
    }

    return response
  }

  indexExists({ index }: { index: string }) {
    return this.request(`${cleanIndexName(index)}`, 'HEAD')
  }

  indexGetSettings({ index }: { index: string }) {
    return this.request(`${cleanIndexName(index)}/_settings`, 'GET')
  }

  indexPutSettings({ indices, body }: { indices: string[]; body: object }) {
    if (indices.length > MAX_INDICES_PER_REQUEST) {
      return this.callInChunks({ method: 'indexPutSettings', indices, body })
    } else {
      return this.request(`${cleanIndexName(indices.join(','))}/_settings`, 'PUT', body)
    }
  }

  reindex({ source, dest }: { source: string, dest: string }) {
    return this.request('_reindex?wait_for_completion=false', 'POST', {
      source: { index: source },
      dest: { index: dest }
    })
  }

  clone({ source, dest }: { source: string; dest: string }) {
    return this.request(`${cleanIndexName(source)}/_clone/${cleanIndexName(dest)}`, 'POST')
  }

  index({ index, type, id, routing, body }: {
    index: string,
    type: string,
    id: any,
    routing: string,
    body: any
  }) {
    let path = id ? `${cleanIndexName(index)}/${type}/${encodeURIComponent(id)}?refresh=true` : `${cleanIndexName(index)}/${type}?refresh=true`
    if (routing) path += `&routing=${routing}`
    return this.request(path, id ? 'PUT' : 'POST', body)
  }

  get({ index, type, id, routing }: { index: string, type: string, id: any, routing?: string }) {
    const params: IndexGetArgs = {}
    if (routing) params.routing = routing
    return this.request(`${cleanIndexName(index)}/${type}/${encodeURIComponent(id)}`, 'GET', params)
  }

  delete({ index, type, id, routing }: { index: string, type: string, id: any, routing?: string }) {
    let path = `${cleanIndexName(index)}/${type}/${encodeURIComponent(id)}?refresh=true`
    if (routing) path += `&routing=${routing}`
    return this.request(path, 'DELETE')
  }

  search(params: object, searchIndex?: string | string[], queryParams?: Record<string, string>) {
    const index = Array.isArray(searchIndex) ? searchIndex.join(',') : searchIndex

    let path = index && index.length > 0 ? `${cleanIndexName(index)}/_search` : '_search'

    if (queryParams && Object.keys(queryParams).length > 0) {
      path += `?${new URLSearchParams(queryParams).toString()}`
    }

    return this.request(path, 'POST', params)
  }

  docsBulkDelete(documents: any[]) {
    const body = documents.map(str => {
      const matches = str.split(/####(.*)####(.*)/)
      return JSON.stringify({ delete: { _index: matches[0], _id: matches[2] } })
    }).join('\r\n') + '\r\n'
    return this.request('_bulk?refresh=true', 'POST', body)
  }

  docsBulkCreate({ index, type, documents }: { index: string, type: string, documents: any[] }) {
    const body = documents.map(doc => {
      if (type !== '')
        return JSON.stringify({ index: { _index: index || 'unknown', _type: type } }) + '\r\n' + JSON.stringify(doc._source || doc)
      else
        return JSON.stringify({ index: { _index: index || 'unknown' } }) + '\r\n' + JSON.stringify(doc._source || doc)
    }).join('\r\n') + '\r\n'
    return this.request('_bulk?refresh=true', 'POST', body)
  }

  bulk({ body }: { body: string }) {
    return this.request('_bulk?refresh=wait_for', 'POST', body)
  }

  /** routes only available in default elasticsearch, but not in serverless **/

  clusterHealth() {
    return this.request('_cluster/health', 'GET')
  }

  clusterStats() {
    return this.request('_cluster/stats', 'GET')
  }

  clusterReroute(commands: object) {
    return this.request('_cluster/reroute', 'POST', { commands })
  }

  clusterGetSettings() {
    return this.request('_cluster/settings', 'GET')
  }

  clusterPutSettings(body: object) {
    return this.request('_cluster/settings', 'PUT', body)
  }

  catShards(params: object, filter?: string) {
    const query = filter ? `${filter}*` : ''
    return this.request(`_cat/shards/${query}`, 'GET', params)
  }

  catRecovery() {
    return this.request('_cat/recovery?s=start_time_millis:desc', 'GET')
  }

  recovery() {
    return this.request('_recovery', 'GET')
  }

  indexClose({ indices }: { indices: string[] }) {
    if (indices.length > MAX_INDICES_PER_REQUEST) {
      return this.callInChunks({ method: 'indexClose', indices })
    } else {
      return this.request(`${cleanIndexName(indices.join(','))}/_close`, 'POST')
    }
  }

  indexOpen({ indices }: { indices: string[] }) {
    if (indices.length > MAX_INDICES_PER_REQUEST) {
      return this.callInChunks({ method: 'indexOpen', indices })
    } else {
      return this.request(`${cleanIndexName(indices.join(','))}/_open`, 'POST')
    }
  }

  indexForcemerge({ indices }: { indices: string[] }) {
    if (indices.length > MAX_INDICES_PER_REQUEST) {
      return this.callInChunks({ method: 'indexForcemerge', indices })
    } else {
      return this.request(`${cleanIndexName(indices.join(','))}/_forcemerge`, 'POST')
    }
  }

  catNodes(params: object) {
    return this.request('_cat/nodes', 'GET', params)
  }

  nodes() {
    return this.request('_nodes', 'GET')
  }

  catRepositories(params: object) {
    return this.request('_snapshot', 'GET', params)
  }

  catSnapshots({ repository }: { repository: string }) {
    return this.request(`_snapshot/${repository}/_all`, 'GET')
  }

  snapshotCreateRepository({ repository, body }: { repository: string, body: object }) {
    return this.request(`_snapshot/${repository}`, 'PUT', body)
  }

  snapshotDeleteRepository({ repository }: { repository: string }) {
    return this.request(`_snapshot/${repository}`, 'DELETE')
  }

  snapshotCreate({ repository, snapshot, body }: { repository: string, snapshot: string, body: object }) {
    return this.request(`_snapshot/${repository}/${snapshot}`, 'PUT', body)
  }

  snapshotDelete({ repository, snapshot }: { repository: string, snapshot: string }) {
    return this.request(`_snapshot/${repository}/${snapshot}`, 'DELETE')
  }

  snapshotRestore({ repository, snapshot, body }: { repository: string, snapshot: string, body: object }) {
    return this.request(`_snapshot/${repository}/${snapshot}/_restore`, 'POST', body)
  }

  getSnapshot({ repository, snapshot }: { repository: string, snapshot: string }) {
    return this.request(`_snapshot/${repository}/${snapshot}`, 'GET')
  }

  getRoles() {
    return this.request('_security/role', 'GET')
  }

  deleteRole({ name }: { name: string }) {
    return this.request(`_security/role/${name}`, 'DELETE')
  }

  createRole({ name, body }: { name: string, body: object }) {
    return this.request(`_security/role/${name}`, 'POST', body)
  }

  getApiKeys() {
    return this.request('_security/api_key', 'GET')
  }

  deleteApiKey({ id }: { id: string }) {
    return this.request('_security/api_key', 'DELETE', { ids: [id] })
  }

  createApiKey({ body }: { body: object }) {
    return this.request('_security/api_key', 'POST', body)
  }

  getUsers() {
    return this.request('_security/user', 'GET')
  }

  deleteUser({ username }: { username: string }) {
    return this.request(`_security/user/${username}`, 'DELETE')
  }

  updateUser({ username, body }: { username: string, body: object }) {
    return this.request(`_security/user/${username}`, 'PUT', body)
  }

  createUser({ username, body }: { username: string; body?: object }) {
    return this.request(`_security/user/${username}`, 'POST', body)
  }

  disableUser({ username }: { username: string }) {
    return this.request(`_security/user/${username}/_disable`, 'POST')
  }

  enableUser({ username }: { username: string }) {
    return this.request(`_security/user/${username}/_enable`, 'POST')
  }

  catSlmPolicies() {
    return this.request('_slm/policy', 'GET')
  }

  slmGetPolicy({ policy }: { policy: string }) {
    return this.request(`_slm/policy/${policy}`, 'GET')
  }

  slmPutPolicy({ policy, body }: { policy: string; body: object }) {
    return this.request(`_slm/policy/${policy}`, 'PUT', body)
  }

  slmDeletePolicy({ policy }: { policy: string }) {
    return this.request(`_slm/policy/${policy}`, 'DELETE')
  }

  slmExecutePolicy({ policy }: { policy: string }) {
    return this.request(`_slm/policy/${policy}/_execute`, 'POST')
  }

  slmGetStatus() {
    return this.request('_slm/status', 'GET')
  }

  async request(path: string, method: string, params?: any) {
    const url = new URL(this.uri + path)

    if (method === 'GET' && typeof params === 'object') {
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]))
    }

    let body = null
    if (method === 'PUT' || method === 'POST' || method === 'DELETE') body = params

    const options: RequestInit = {
      method,
      body: body && typeof body !== 'string' ? stringifyJson(body) : body,
      headers: { ...REQUEST_DEFAULT_HEADERS }
    }

    if (this.authHeader) {
      // @ts-expect-error header definition
      options.headers['Authorization'] = this.authHeader
    } else if (this.awsClient) {
      const signed = await this.awsClient.sign(url.toString(), options)
      options.headers = {} as HeadersInit
      signed.headers.forEach((value, key) => {
        // @ts-expect-error header definition
        options.headers[key] = value
      })
    }

    return new Promise((resolve, reject) => {
      return fetchMethod(url, options)
        .then(response => {
          if (options.method === 'HEAD') {
            return resolve(response.ok)
          }

          if (response.ok) {
            resolve(response)
          } else {
            reject(response)
          }
        }).catch(reject)
    })
  }

  async test() {
    try {
      const info = await this.ping()
      await this.search({}, 'no_indices_match_this_pattern*', { allow_no_indices: 'true', ignore_unavailable: 'true', size: '0' })
      return Promise.resolve(info)
    } catch (e) {
      return Promise.reject(e)
    }
  }
}
