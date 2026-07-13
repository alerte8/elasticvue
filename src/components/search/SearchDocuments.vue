<template>
  <q-card class="search-documents">
      <search-documents-form-tabs ref="tabs"/>
  </q-card>   
</template>

<script setup lang="ts">
  import SearchDocumentsFormTabs from './SearchDocumentsFormTabs.vue'
</script>

<style lang="scss">
  .search-documents {
    flex: 1;
    min-height: 0;
    overflow: auto;  
    display: flex;
    flex-direction: column;
  }
</style>