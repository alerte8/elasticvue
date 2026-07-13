<template>
  <q-btn id="import_index" color="primary-dark" :label="t('indices.import_index.heading')" @click="openImportDialog" />

  <!-- Dialog d'import -->
  <q-dialog v-model="importDialogVisible" persistent>
    <q-card style="min-width: 700px; max-width: 90vw">
      <q-card-section>
        <div class="text-h6">{{ t('indices.import.title') }}</div>
        <div class="text-subtitle2">{{ t('indices.import.subtitle') }}</div>
      </q-card-section>

      <q-card-section style="max-height: 65vh" class="scroll">
        <!-- Sélection des fichiers -->
        <div class="q-mb-md">
          <q-file
            v-model="selectedFiles"
            :label="t('indices.import.select_files')"
            accept=".json,.ndjson,.zip"
            multiple
            use-chips
            filled
            @update:model-value="onFilesSelected"
          >
            <template #prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>
        </div>

        <!-- Options avancées globales -->
        <q-expansion-item
          v-if="jobs.length > 0"
          :label="t('indices.import.advanced_options')"
          icon="settings"
          class="q-mb-md"
        >
          <div class="q-pa-md">
            <q-checkbox
              v-model="overwriteExisting"
              :label="t('indices.import.overwrite_existing')"
            />
            <div class="text-caption text-grey-6 q-mt-sm">
              {{ t('indices.import.overwrite_warning') }}
            </div>
          </div>
        </q-expansion-item>

        <!-- Paramétrage par fichier -->
        <q-card v-for="(job, i) in jobs" :key="`${job.file.name}-${i}`" flat bordered class="q-mb-md">
          <q-card-section>
            <div class="row items-center q-mb-sm">
              <q-icon name="description" size="sm" class="q-mr-sm" />
              <strong>{{ job.file.name }}</strong>
              <q-badge class="q-ml-sm" :color="job.analyzeError ? 'negative' : 'grey-7'">
                {{ job.analyzeError ? t('indices.import.status.error') : jobTypeLabel(job) }}
              </q-badge>
              <span class="text-caption text-grey-6 q-ml-sm">{{ prettyBytes(job.file.size) }}</span>
            </div>

            <div v-if="job.analyzeError" class="text-negative text-body2">
              {{ job.analyzeError }}
            </div>

            <template v-else>
              <div v-if="job.preview" class="text-caption text-grey-7 q-mb-sm">
                <span v-if="job.preview.index">{{ t('indices.import.original_index') }}: <strong>{{ job.preview.index }}</strong> — </span>
                {{ t('indices.import.documents_count') }}: <strong>{{ job.preview.total }}</strong> —
                {{ t('indices.import.has_mapping') }}: <strong>{{ job.preview.hasMapping ? t('common.yes') : t('common.no') }}</strong>
              </div>

              <div class="row items-center q-col-gutter-md">
                <div class="col-auto">
                  <q-radio v-model="job.mode" val="new" :label="t('indices.import.mode.new_index')" dense />
                  <q-radio v-model="job.mode" val="existing" :label="t('indices.import.mode.existing_index')" dense class="q-ml-sm" />
                </div>
                <div class="col">
                  <q-input
                    v-if="job.mode === 'new'"
                    v-model="job.newIndexName"
                    :label="t('indices.import.new_index_name')"
                    dense
                    filled
                    :rules="[(val: string) => !!val || t('indices.import.validation.index_name_required')]"
                  />
                  <q-select
                    v-else
                    v-model="job.existingIndex"
                    :options="existingIndices"
                    :label="t('indices.import.select_existing_index')"
                    dense
                    filled
                    :rules="[(val: string) => !!val || t('indices.import.validation.index_required')]"
                  />
                </div>
              </div>
            </template>
          </q-card-section>
        </q-card>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="t('defaults.cancel')" @click="closeImportDialog" />
        <q-btn
          color="primary"
          :label="t('indices.import.start_import')"
          :loading="importing"
          :disable="!canStartImport"
          @click="startImport"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Dialog de progression -->
  <q-dialog v-model="progressDialogVisible" persistent>
    <q-card style="min-width: 500px">
      <q-card-section>
        <div class="text-h6">{{ t('indices.import.progress.title') }}</div>
        <div v-if="currentJob" class="text-subtitle2">
          {{ t('indices.import.progress.file_of', { current: currentJobIndex + 1, total: jobs.length, name: currentJob.file.name }) }}
        </div>
      </q-card-section>

      <q-card-section>
        <div class="q-mb-md">
          <div class="text-body2 q-mb-sm">{{ progressStatus }}</div>
          <q-linear-progress
            :value="progressPercentage / 100"
            color="primary"
            size="20px"
            rounded
          />
          <div class="text-caption text-center q-mt-sm">
            {{ progressText }} ({{ progressPercentage }}%)
          </div>
        </div>

        <!-- Statut de chaque fichier -->
        <q-list dense bordered separator class="q-mb-md">
          <q-item v-for="(job, i) in jobs" :key="`status-${i}`">
            <q-item-section side>
              <q-icon v-if="job.status === 'done'" name="check_circle" color="positive" />
              <q-icon v-else-if="job.status === 'error'" name="error" color="negative" />
              <q-spinner v-else-if="job.status === 'running'" color="primary" size="sm" />
              <q-icon v-else name="schedule" color="grey" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ job.file.name }} → {{ jobTargetIndex(job) }}</q-item-label>
              <q-item-label v-if="job.errorMessage" caption class="text-negative">{{ job.errorMessage }}</q-item-label>
              <q-item-label v-else-if="job.status === 'done' && job.bulkErrors.length > 0" caption class="text-warning">
                {{ t('indices.import.progress.completed_with_errors', { errors: job.bulkErrors.length }) }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          v-if="!importing"
          flat
          :label="t('defaults.close')"
          @click="closeProgressDialog"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import prettyBytes from 'pretty-bytes'
  import { useTranslation } from '../../composables/i18n'
  import { useElasticsearchAdapter } from '../../composables/CallElasticsearch'
  import JSZip from 'jszip'

  type ImportJob = {
    file: File
    isNdjson: boolean
    isZip: boolean
    preview: { index?: string, total: number | string, hasMapping: boolean } | null
    analyzeError: string
    mode: 'new' | 'existing'
    newIndexName: string
    existingIndex: string
    status: 'pending' | 'running' | 'done' | 'error'
    errorMessage: string
    bulkErrors: any[]
  }

  const emit = defineEmits(['done'])

  const t = useTranslation()
  const { callElasticsearch } = useElasticsearchAdapter()

  // État des dialogs
  const importDialogVisible = ref(false)
  const progressDialogVisible = ref(false)

  // Fichiers et jobs
  const selectedFiles = ref<File[]>([])
  const jobs = ref<ImportJob[]>([])
  const overwriteExisting = ref(false)

  // Liste des indices existants
  const existingIndices = ref<string[]>([])

  // État de l'import
  const importing = ref(false)
  const anyCompleted = ref(false)
  const currentJobIndex = ref(0)
  const currentJob = computed(() => jobs.value[currentJobIndex.value] || null)

  const progressStatus = ref('')
  const progressProcessed = ref(0)
  const progressTotal = ref(0)
  const progressPercentage = computed(() => {
    if (progressTotal.value === 0) return 0
    return Math.min(Math.round((progressProcessed.value / progressTotal.value) * 100), 100)
  })

  const progressText = computed(() => {
    if (progressTotal.value === 0) return ''
    if (currentJob.value?.isNdjson && progressTotal.value > 1000000) { // streaming : progression en octets
      const processedMb = (progressProcessed.value / 1024 / 1024).toFixed(2)
      const totalMb = (progressTotal.value / 1024 / 1024).toFixed(2)
      return `${processedMb} MB / ${totalMb} MB`
    }
    return `${progressProcessed.value} / ${progressTotal.value}`
  })

  const jobTargetIndex = (job: ImportJob) => (job.mode === 'new' ? job.newIndexName : job.existingIndex)

  const jobTypeLabel = (job: ImportJob) => {
    if (job.isNdjson) return 'NDJSON'
    if (job.isZip) return 'ZIP'
    return 'JSON'
  }

  const canStartImport = computed(() => {
    if (jobs.value.length === 0 || importing.value) return false
    return jobs.value.every(job => !job.analyzeError && !!jobTargetIndex(job))
  })

  const openImportDialog = async () => {
    importDialogVisible.value = true
    await loadExistingIndices()
  }

  const closeImportDialog = () => {
    importDialogVisible.value = false
    selectedFiles.value = []
    jobs.value = []
  }

  const loadExistingIndices = async () => {
    try {
      const indices = await callElasticsearch('catIndices', { h: 'index' }) as any
      if (Array.isArray(indices)) {
        existingIndices.value = indices.map((i: any) => i.index).sort()
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Lecture des premiers octets seulement — jamais le fichier entier pour l'analyse
  const peekFileHeader = async (file: File): Promise<string> => {
    const chunk = file.slice(0, 64 * 1024)
    return await chunk.text()
  }

  const suggestIndexName = (file: File, originalIndex?: string) => {
    const date = new Date().toISOString().split('T')[0]
    if (originalIndex) return `${originalIndex}_imported_${date}`
    const base = file.name.replace(/\.(ndjson|json|zip)$/i, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    return `${base}_${date}`
  }

  const onFilesSelected = async (files: File[] | null) => {
    jobs.value = []
    if (!files || files.length === 0) return

    for (const file of files) {
      const job: ImportJob = {
        file,
        isNdjson: false,
        isZip: false,
        preview: null,
        analyzeError: '',
        mode: 'new',
        newIndexName: '',
        existingIndex: '',
        status: 'pending',
        errorMessage: '',
        bulkErrors: []
      }

      try {
        await analyzeFile(job)
      } catch (error) {
        console.error('Error parsing file:', error)
        job.analyzeError = error instanceof Error ? error.message : t('indices.import.error.parse_failed')
      }

      jobs.value.push(job)
    }
  }

  const analyzeFile = async (job: ImportJob) => {
    const file = job.file

    if (file.name.endsWith('.zip')) {
      // ZIP hérité : contient un dump JSON classique (décompression en mémoire)
      job.isZip = true
      const zip = new JSZip()
      const zipContent = await zip.loadAsync(file)
      const jsonFile = Object.keys(zipContent.files).find(name => name.endsWith('.json'))
      if (!jsonFile) throw new Error(t('indices.import.error.no_json_in_zip'))

      const content = await zipContent.file(jsonFile)!.async('string')
      applyJsonPreview(job, JSON.parse(content))
      return
    }

    // Détection NDJSON : header elasticdump {settings, mappings} ou paire action/source
    const headerContent = await peekFileHeader(file)
    const firstLineEnd = headerContent.indexOf('\n')
    if (firstLineEnd > 0) {
      const firstLine = headerContent.slice(0, firstLineEnd).trim()
      try {
        const parsed = JSON.parse(firstLine)
        if (parsed.mappings || parsed.settings || parsed.index || parsed.create) {
          job.isNdjson = true
          job.preview = {
            total: '?', // inconnu sans lire tout le fichier
            hasMapping: !!(parsed.mappings || parsed.settings)
          }
          job.newIndexName = suggestIndexName(file)
          return
        }
      } catch { /* première ligne non JSON : pas du NDJSON */ }
    }

    // JSON classique : il faut lire tout le fichier (limité par la mémoire — format hérité)
    const fullContent = await file.text()
    applyJsonPreview(job, JSON.parse(fullContent))
  }

  const applyJsonPreview = (job: ImportJob, dumpData: any) => {
    if (!dumpData.index || !dumpData.documents || !Array.isArray(dumpData.documents)) {
      throw new Error(t('indices.import.error.invalid_file_format'))
    }
    job.preview = {
      index: dumpData.index,
      total: dumpData.total || dumpData.documents.length,
      hasMapping: !!dumpData.mapping
    }
    job.newIndexName = suggestIndexName(job.file, dumpData.index)
  }

  const startImport = async () => {
    if (!canStartImport.value) return

    importing.value = true
    importDialogVisible.value = false
    progressDialogVisible.value = true
    anyCompleted.value = false

    for (let i = 0; i < jobs.value.length; i++) {
      currentJobIndex.value = i
      const job = jobs.value[i]
      job.status = 'running'
      job.errorMessage = ''
      job.bulkErrors = []
      progressProcessed.value = 0
      progressTotal.value = 100
      progressStatus.value = t('indices.import.progress.preparing')

      try {
        await runJob(job)
        job.status = 'done'
        anyCompleted.value = true
      } catch (error) {
        console.error('Import error:', error)
        job.status = 'error'
        job.errorMessage = error instanceof Error ? error.message : t('indices.import.error.unknown')
      }
    }

    progressStatus.value = t('indices.import.progress.completed')
    importing.value = false
  }

  const runJob = async (job: ImportJob) => {
    const targetIndex = jobTargetIndex(job)

    if (job.mode === 'new') {
      await loadExistingIndices()
      if (existingIndices.value.includes(targetIndex) && !overwriteExisting.value) {
        throw new Error(t('indices.import.error.index_exists', { index: targetIndex }))
      }
    }

    const onProgress = (progress: any) => {
      progressProcessed.value = progress.processed
      progressTotal.value = progress.total
      progressStatus.value = progress.status
    }

    let result
    if (job.isNdjson) {
      // Flux : lecture du fichier par fragments, envoi par lots de 1000 documents
      result = await callElasticsearch('indexRestoreNdjson', { index: targetIndex, file: job.file, onProgress })
    } else {
      let content: string
      if (job.isZip) {
        const zip = new JSZip()
        const zipContent = await zip.loadAsync(job.file)
        const jsonFile = Object.keys(zipContent.files).find(name => name.endsWith('.json'))!
        content = await zipContent.file(jsonFile)!.async('string')
      } else {
        content = await job.file.text()
      }
      const dumpData = JSON.parse(content)

      progressStatus.value = t('indices.import.progress.creating_index')
      result = await callElasticsearch('indexRestore', {
        index: targetIndex,
        data: { mapping: dumpData.mapping, data: dumpData.documents },
        onProgress
      })
    }

    if (!result.success) {
      throw new Error(result.error || t('indices.import.error.import_failed'))
    }
    job.bulkErrors = result.errors || []
  }

  const closeProgressDialog = () => {
    progressDialogVisible.value = false
    selectedFiles.value = []
    jobs.value = []
    if (anyCompleted.value) {
      emit('done')
    }
  }
</script>
