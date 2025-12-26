<template>
  <q-btn id="import_index" color="primary-dark" :label="t('indices.import_index.heading')" @click="openImportDialog" />

  <!-- Dialog d'import -->
  <q-dialog v-model="importDialogVisible" persistent>
    <q-card style="min-width: 600px">
      <q-card-section>
        <div class="text-h6">{{ t('indices.import.title') }}</div>
        <div class="text-subtitle2">{{ t('indices.import.subtitle') }}</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="startImport">
          <!-- Sélection du fichier -->
          <div class="q-mb-md">
            <q-file
              v-model="selectedFile"
              :label="t('indices.import.select_file')"
              accept=".json,.zip"
              filled
              @update:model-value="onFileSelected"
            >
              <template #prepend>
                <q-icon name="attach_file" />
              </template>
            </q-file>
          </div>

          <!-- Options d'import -->
          <div class="q-mb-md">
            <q-radio 
              v-model="importMode" 
              val="new" 
              :label="t('indices.import.mode.new_index')" 
            />
            <q-radio 
              v-model="importMode" 
              val="existing" 
              :label="t('indices.import.mode.existing_index')" 
            />
          </div>

          <!-- Nom du nouvel index -->
          <div v-if="importMode === 'new'" class="q-mb-md">
            <q-input
              v-model="newIndexName"
              :label="t('indices.import.new_index_name')"
              filled
              :rules="[val => !!val || t('indices.import.validation.index_name_required')]"
            />
          </div>

          <!-- Sélection d'index existant -->
          <div v-if="importMode === 'existing'" class="q-mb-md">
            <q-select
              v-model="selectedExistingIndex"
              :options="existingIndices"
              :label="t('indices.import.select_existing_index')"
              filled
              :rules="[val => !!val || t('indices.import.validation.index_required')]"
            />
          </div>

          <!-- Options avancées -->
          <q-expansion-item
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

          <!-- Aperçu du fichier -->
          <div v-if="filePreview" class="q-mb-md">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle2">{{ t('indices.import.file_preview') }}</div>
                <div class="text-body2">
                  <div><strong>{{ t('indices.import.original_index') }}:</strong> {{ filePreview.index }}</div>
                  <div><strong>{{ t('indices.import.documents_count') }}:</strong> {{ filePreview.total }}</div>
                  <div><strong>{{ t('indices.import.has_mapping') }}:</strong> {{ filePreview.hasMapping ? t('common.yes') : t('common.no') }}</div>
                  <div><strong>{{ t('indices.import.export_date') }}:</strong> {{ new Date(filePreview.timestamp).toLocaleString() }}</div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </q-form>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="t('defaults.cancel')" @click="importDialogVisible = false" />
        <q-btn 
          color="primary" 
          :label="t('indices.import.start_import')" 
          :loading="importing"
          :disable="!selectedFile || !canStartImport"
          @click="startImport" 
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Dialog de progression -->
  <q-dialog v-model="progressDialogVisible" persistent>
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">{{ t('indices.import.progress.title') }}</div>
        <div class="text-subtitle2">{{ t('indices.import.progress.importing', { 
          targetIndex: targetIndexName 
        }) }}</div>
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

        <div v-if="importError" class="q-mt-md">
          <q-banner class="bg-negative text-white">
            <template #avatar>
              <q-icon name="error" />
            </template>
            {{ importError }}
          </q-banner>
        </div>

        <div v-if="importCompleted && importErrors.length > 0" class="q-mt-md">
          <q-banner class="bg-warning text-dark">
            <template #avatar>
              <q-icon name="warning" />
            </template>
            {{ t('indices.import.progress.completed_with_errors', { 
              errors: importErrors.length 
            }) }}
          </q-banner>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn 
          v-if="importCompleted || importError"
          flat 
          :label="t('defaults.close')" 
          @click="closeProgressDialog" 
        />
        <q-btn 
          v-else
          flat 
          color="negative" 
          :label="t('defaults.cancel')" 
          @click="cancelImport" 
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useTranslation } from '../../composables/i18n'
  import { useElasticsearchAdapter } from '../../composables/CallElasticsearch'
  import JSZip from 'jszip'

  const emit = defineEmits(['done'])

  const t = useTranslation()
  const { callElasticsearch } = useElasticsearchAdapter()

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

  // État des dialogs
  const importDialogVisible = ref(false)
  const openImportDialog = () => {
    importDialogVisible.value = true
  }
  const progressDialogVisible = ref(false)

  // Sélection de fichier
  const selectedFile = ref<File | null>(null)
  const filePreview = ref<any>(null)

  // Options d'import
  const importMode = ref<'new' | 'existing'>('new')
  const newIndexName = ref('')
  const selectedExistingIndex = ref('')
  const overwriteExisting = ref(false)

  // Liste des indices existants
  const existingIndices = ref<string[]>([])

  // État de l'import
  const importing = ref(false)
  const importCompleted = ref(false)
  const importError = ref('')
  const importErrors = ref<any[]>([])
  const isNdjson = ref(false)
  const ndjsonFile = ref<File | null>(null)

  const progressStatus = ref('')
  const progressProcessed = ref(0)
  const progressTotal = ref(0)
  const progressPercentage = computed(() => {
    if (progressTotal.value === 0) return 0
    return Math.min(Math.round((progressProcessed.value / progressTotal.value) * 100), 100)
  })
  
  const progressText = computed(() => {
    if (progressTotal.value === 0) return ''
    // Si Total = 100, c'est probablement un % arbitraire ou une taille en %
    // On essaie de dtecter si on est en mode "Streaming Bytes"
    if (isNdjson.value && progressTotal.value > 1000000) { // Si > 1MB, c'est des bytes
        const processedMb = (progressProcessed.value / 1024 / 1024).toFixed(2)
        const totalMb = (progressTotal.value / 1024 / 1024).toFixed(2)
        return `${processedMb} MB / ${totalMb} MB`
    }
    return `${progressProcessed.value} / ${progressTotal.value}`
  })

  const targetIndexName = computed(() => {
    return importMode.value === 'new' ? newIndexName.value : selectedExistingIndex.value
  })

  const canStartImport = computed(() => {
    if (!selectedFile.value || !filePreview.value) return false
    return !!targetIndexName.value
  })

  // Fonction pour lire les premiers octets et dtecter le format
  const peekFileHeader = async (file: File): Promise<string> => {
    // Lire les 64 premiers KB
    const chunk = file.slice(0, 64 * 1024)
    return await chunk.text()
  }

  const onFileSelected = async (file: File | null) => {
    selectedFile.value = file
    if (!file) {
      filePreview.value = null
      isNdjson.value = false
      ndjsonFile.value = null
      return
    }

    try {
      if (file.name.endsWith('.zip')) {
        // Mode ZIP : On doit lire pour extraire le JSON (limite mmoire applique ici par JSZip)
        // Pas de streaming facile pour le ZIP pour l'instant
        const zip = new JSZip()
        const zipContent = await zip.loadAsync(file)
        const jsonFile = Object.keys(zipContent.files).find(name => name.endsWith('.json'))
        
        if (!jsonFile) throw new Error(t('indices.import.error.no_json_in_zip'))
        
        const content = await zipContent.file(jsonFile)!.async('string')
        parseFullJsonContent(content) // On rutilise la logique JSON classique
        return
      }

      // Lecture partielle pour dtection
      const headerContent = await peekFileHeader(file)
      
      // 1. Essai JSON standard (dbut fichier)
      // Un JSON standard commence par { ou [
      const trimmed = headerContent.trim()
      if (trimmed.startsWith('{') && !trimmed.includes('\n')) {
          // Si pas de saut de ligne dans les 64KB, c'est soit un trs long NDJSON, soit un JSON minifi
          // Difficile  dire.
      }

      // On tente de voir si c'est du NDJSON avec header Elasticdump
      try {
        const firstLineEnd = headerContent.indexOf('\n')
        if (firstLineEnd > 0) {
            const firstLine = headerContent.slice(0, firstLineEnd)
            const header = JSON.parse(firstLine)
            
            if (header.mappings || header.settings) {
                // C'est du NDJSON Elasticdump
                isNdjson.value = true
                ndjsonFile.value = file
                
                // Estimation impossible sans tout lire, on basera la progression sur la taille fichier
                filePreview.value = {
                    index: 'dump_external', 
                    total: '?', // Inconnu
                    hasMapping: !!header.mappings,
                    timestamp: new Date().toISOString()
                }
                
                if (importMode.value === 'new') {
                    newIndexName.value = `import_${new Date().toISOString().split('T')[0]}`
                }
                return
            }
        }
      } catch (e) {
        // Pas du JSON valide sur la 1ere ligne
      }

      // Si on est l, ce n'est pas un NDJSON identifi.
      // On tente de lire tout le fichier comme un JSON classique (fallback)
      // Attention : Risque de crash si gros fichier, mais c'est le comportement par dfaut pour JSON
      const fullContent = await file.text()
      try {
          parseFullJsonContent(fullContent)
      } catch (e) {
          // Si a choue aussi, c'est peut-tre du NDJSON sans header spcial ?
          // On pourrait supposer NDJSON par dfaut pour les .json/.dump qui chouent au JSON.parse...
          // Pour la scurite, on erreur.
           throw new Error(t('indices.import.error.invalid_file_format'))
      }

    } catch (error) {
      console.error('Error parsing file:', error)
      importError.value = error instanceof Error ? error.message : t('indices.import.error.parse_failed')
      filePreview.value = null
    }
  }

  const parseFullJsonContent = (content: string) => {
      const dumpData = JSON.parse(content)
      if (dumpData.index && dumpData.documents && Array.isArray(dumpData.documents)) {
        isNdjson.value = false
        filePreview.value = {
            index: dumpData.index,
            total: dumpData.total || dumpData.documents.length,
            hasMapping: !!dumpData.mapping,
            timestamp: dumpData.timestamp
        }
        if (importMode.value === 'new') {
            newIndexName.value = `${dumpData.index}_imported_${new Date().toISOString().split('T')[0]}`
        }
      } else {
          throw new Error(t('indices.import.error.invalid_file_format'))
      }
  }

  const startImport = async () => {
    if (!selectedFile.value || !filePreview.value) return

    importing.value = true
    importDialogVisible.value = false
    progressDialogVisible.value = true
    importError.value = ''
    importCompleted.value = false
    importErrors.value = []
    
    try {
      progressStatus.value = t('indices.import.progress.preparing')
      progressProcessed.value = 0
      progressTotal.value = 100 // Valeur dummy initiale

      const targetIndex = targetIndexName.value

      if (importMode.value === 'new') {
        await loadExistingIndices()
        if (existingIndices.value.includes(targetIndex)) {
            if (!overwriteExisting.value) { // Petite amlioration UI
                 throw new Error(t('indices.import.error.index_exists', { index: targetIndex }))
            }
        }
      }

      let result
      
      if (isNdjson.value && ndjsonFile.value) {
        // Mode Streaming
        result = await callElasticsearch('indexRestoreNdjson', {
            index: targetIndex,
            file: ndjsonFile.value, // On passe le File object
            onProgress: (progress: any) => {
                progressProcessed.value = progress.processed
                progressTotal.value = progress.total
                progressStatus.value = progress.status
            }
        })
      } else {
        // Mode Classique (JSON en mmoire)
        let content: string
        if (selectedFile.value.name.endsWith('.zip')) {
            const zip = new JSZip()
            const zipContent = await zip.loadAsync(selectedFile.value)
            const jsonFile = Object.keys(zipContent.files).find(name => name.endsWith('.json'))!
            content = await zipContent.file(jsonFile)!.async('string')
        } else {
            content = await selectedFile.value.text()
        }
        
        const dumpData = JSON.parse(content)
        
        progressStatus.value = t('indices.import.progress.creating_index')
      
        result = await callElasticsearch('indexRestore', {
            index: targetIndex,
            data: {
                mapping: dumpData.mapping,
                data: dumpData.documents
            },
            onProgress: (progress: any) => {
                progressProcessed.value = progress.processed
                progressTotal.value = progress.total
                progressStatus.value = progress.status
            }
        })
      }

      if (!result.success) {
        throw new Error(result.error || t('indices.import.error.import_failed'))
      }

      importErrors.value = result.errors || []
      progressStatus.value = t('indices.import.progress.completed')
      importCompleted.value = true
      // Force 100% visuel  la fin
      progressPercentage.value // refresh computed
      progressProcessed.value = progressTotal.value

    } catch (error) {
      console.error('Import error:', error)
      importError.value = error instanceof Error ? error.message : t('indices.import.error.unknown')
    } finally {
      importing.value = false
    }
  }

  const cancelImport = () => {
    // Note: L'import ne peut pas être annulé une fois commencé
    // On ferme juste le dialog
    closeProgressDialog()
  }

  const closeProgressDialog = () => {
    progressDialogVisible.value = false
    if (importCompleted.value) {
      emit('done')
    }
  }

  onMounted(() => {
    // Reset form when dialog opens
    importDialogVisible.value = false
  })
</script>
