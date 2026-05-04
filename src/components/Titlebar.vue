<script setup lang="ts">
import { Minus, Square, X, Maximize2 } from 'lucide-vue-next'
import { ref } from 'vue'

const isMaximized = ref(false)

const minimize = () => window.api.minimize()
const maximize = () => {
  window.api.maximize()
  isMaximized.value = !isMaximized.value
}
const close = () => window.api.close()
</script>

<template>
  <div class="h-10 bg-background/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between select-none px-4 drag-region">
    <div class="flex items-center gap-2">
      <img src="/public/icon.png" class="h-4 w-4" alt="ClipVault" />
      <span class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">ClipVault</span>
    </div>

    <div class="flex items-center no-drag-region h-full">
      <button 
        @click="minimize" 
        class="h-10 w-12 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        <Minus class="h-3.5 w-3.5" />
      </button>
      <button 
        @click="maximize" 
        class="h-10 w-12 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        <component :is="isMaximized ? Square : Maximize2" class="h-3 w-3" />
      </button>
      <button 
        @click="close" 
        class="h-10 w-12 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.drag-region {
  -webkit-app-region: drag;
}
.no-drag-region {
  -webkit-app-region: no-drag;
}
</style>
