<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import DownloaderTab from '@/components/DownloaderTab.vue'
import SettingsTab from '@/components/SettingsTab.vue'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'vue-sonner'
import { AlertCircle, Download, X } from 'lucide-vue-next'
import { version } from '../package.json'
import { TooltipProvider } from '@/components/ui/tooltip'
import Titlebar from '@/components/Titlebar.vue'

const binariesReady = ref(false)
const checkingBinaries = ref(true)
const binaryStatus = ref({ ytDlp: false, ffmpeg: false, ffprobe: false })
const isDownloading = ref(false)
const downloadProgress = ref({
  ytDlp: { active: false, progress: 0 },
  ffmpeg: { active: false, progress: 0 }
})

const activeTab = ref('downloader')
const currentTheme = ref<'light' | 'dark' | 'system'>('system')
let cleanupBinary: (() => void) | null = null
let cleanupUpdateAvailable: (() => void) | null = null
let cleanupUpdateNotAvailable: (() => void) | null = null
let cleanupUpdateDownloaded: (() => void) | null = null
let cleanupUpdateError: (() => void) | null = null
let cleanupSettingsChanged: (() => void) | null = null

const { locale, t } = useI18n()

const applyTheme = (tTheme: string) => {
  currentTheme.value = tTheme as 'light' | 'dark' | 'system'
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')

  if (tTheme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    root.classList.add(systemTheme)
  } else {
    root.classList.add(tTheme)
  }
}

const checkBinaries = async () => {
  checkingBinaries.value = true
  try {
    // Add a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500))
    binaryStatus.value = await window.api.checkBinaries()
    binariesReady.value = binaryStatus.value.ytDlp && binaryStatus.value.ffmpeg && binaryStatus.value.ffprobe
  } catch (e) {
    console.error('Failed to check binaries:', e)
    binariesReady.value = false
  } finally {
    checkingBinaries.value = false
  }
}

const installBinaries = async () => {
  isDownloading.value = true
  
  const tasks = []
  
  if (!binaryStatus.value.ytDlp) {
    downloadProgress.value.ytDlp.active = true
    tasks.push(window.api.downloadYTIDlp().then(() => {
      downloadProgress.value.ytDlp.progress = 100
    }))
  }
  
  if (!binaryStatus.value.ffmpeg || !binaryStatus.value.ffprobe) {
    downloadProgress.value.ffmpeg.active = true
    tasks.push(window.api.downloadFFmpeg().then(() => {
      downloadProgress.value.ffmpeg.progress = 100
    }))
  }
  
  await Promise.all(tasks)
  isDownloading.value = false
  await checkBinaries()
}

onMounted(async () => {
  const lang = await window.api.getStoreValue('language') || 'en'
  locale.value = lang

  const theme = await window.api.getStoreValue('theme') || 'system'
  applyTheme(theme)

  checkBinaries()
  cleanupBinary = window.api.onBinaryProgress(({ name, progress }) => {
    if (name === 'yt-dlp') {
      downloadProgress.value.ytDlp.progress = progress
    } else {
      downloadProgress.value.ffmpeg.progress = progress
    }
  })

  // Listen for setting changes
  cleanupSettingsChanged = window.api.onSettingsChanged(() => {
    // Other reactive logic can go here
  })

  // Update listeners
  cleanupUpdateAvailable = window.api.onUpdateAvailable((info: any) => {
    toast.info(t('app.update_available'), {
      description: t('app.update_available_desc', { version: info.version }) + ' ' + t('app.update_downloading'),
      duration: 10000,
    })
  })

  cleanupUpdateDownloaded = window.api.onUpdateDownloaded(() => {
    toast.success(t('app.update_downloaded'), {
      description: t('app.update_downloaded_desc'),
      duration: Infinity,
      action: {
        label: t('app.update_restart'),
        onClick: () => window.api.restartAndUpdate()
      }
    })
  })

  cleanupUpdateNotAvailable = window.api.onUpdateNotAvailable((info: any) => {
    if (info?.manual) {
      toast.info(t('app.update_no_new'), {
        description: t('app.update_no_new_desc'),
        duration: 5000
      })
    }
  })

  cleanupUpdateError = window.api.onUpdateError((err: any) => {
    toast.error('Update Error', {
      description: err?.message || 'Failed to check for updates.',
      duration: 5000
    })
  })
})

onUnmounted(() => {
  if (cleanupBinary) cleanupBinary()
  if (cleanupUpdateAvailable) cleanupUpdateAvailable()
  if (cleanupUpdateNotAvailable) cleanupUpdateNotAvailable()
  if (cleanupUpdateDownloaded) cleanupUpdateDownloaded()
  if (cleanupUpdateError) cleanupUpdateError()
  if (cleanupSettingsChanged) cleanupSettingsChanged()
})
</script>

<template>
  <Toaster :theme="currentTheme" />
  
  <TooltipProvider>
    <div class="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <Titlebar />
      <div v-if="checkingBinaries" class="flex items-center justify-center flex-1">
        <p>{{ $t('app.checking_deps') }}</p>
      </div>

      <div v-else-if="!binariesReady" class="flex items-center justify-center flex-1 p-6">
        <Card class="w-[500px] border-border/50 shadow-2xl bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardHeader class="pb-4">
            <CardTitle class="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
              <div class="bg-destructive/10 p-2 rounded-xl">
                <AlertCircle class="text-destructive h-6 w-6" />
              </div>
              {{ $t('app.missing_deps') }}
            </CardTitle>
            <CardDescription class="text-xs font-bold pt-1">
              {{ $t('app.deps_required') }}
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <div class="p-4 bg-muted/40 rounded-2xl border border-border/50">
              <p class="text-[11px] leading-relaxed text-muted-foreground/90 font-medium whitespace-pre-wrap" v-html="$t('app.deps_explanation').replace(/\*\*(.*?)\*\*/g, '<span class=\'text-foreground font-black\'>$1</span>')"></p>
            </div>

            <div v-if="isDownloading" class="space-y-4 animate-in fade-in duration-500">
              <div v-if="downloadProgress.ytDlp.active" class="space-y-2">
                <div class="flex justify-between items-end">
                  <p class="text-[9px] font-black uppercase tracking-widest text-primary">yt-dlp</p>
                  <span class="text-[9px] font-black tabular-nums">{{ Math.round(downloadProgress.ytDlp.progress) }}%</span>
                </div>
                <Progress :model-value="downloadProgress.ytDlp.progress" class="h-1.5 rounded-full overflow-hidden bg-muted shadow-inner" />
              </div>

              <div v-if="downloadProgress.ffmpeg.active" class="space-y-2">
                <div class="flex justify-between items-end">
                  <p class="text-[9px] font-black uppercase tracking-widest text-primary">FFmpeg & FFprobe</p>
                  <span class="text-[9px] font-black tabular-nums">{{ Math.round(downloadProgress.ffmpeg.progress) }}%</span>
                </div>
                <Progress :model-value="downloadProgress.ffmpeg.progress" class="h-1.5 rounded-full overflow-hidden bg-muted shadow-inner" />
              </div>
            </div>
            <Button v-else @click="installBinaries" class="w-full h-12 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Download class="mr-2 h-4 w-4" />
              {{ $t('app.download_install') }}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div v-else class="max-w-5xl w-full mx-auto px-6 py-4 flex flex-col flex-1 overflow-hidden">
        <Tabs v-model="activeTab" class="flex flex-col flex-1 overflow-hidden">
          <header class="flex items-center justify-between mb-6 flex-shrink-0">
            <div class="flex items-center gap-4">
              <div class="bg-primary/15 p-2.5 rounded-2xl shadow-sm border border-primary/10">
                <Download class="h-6 w-6 text-primary" />
              </div>
              <div>
                <div class="flex items-center gap-2.5 leading-none">
                  <h1 class="text-2xl font-black tracking-tighter">ClipVault</h1>
                  <span class="text-[10px] text-muted-foreground/50 font-bold bg-muted px-1.5 py-0.5 rounded uppercase tracking-widest">v{{ version }}</span>
                </div>
                <p class="text-[11px] text-muted-foreground/80 mt-1 font-medium">{{ $t('app.subtitle') }}</p>
              </div>
            </div>
            
            <TabsList class="h-10 p-1 bg-muted/30 border-none shadow-inner rounded-xl">
              <TabsTrigger value="downloader" class="h-8 px-5 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg">{{ $t('app.tab_downloader') }}</TabsTrigger>
              <TabsTrigger 
                value="settings" 
                class="h-8 px-5 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg"
                @pointerdown="activeTab === 'settings' ? (activeTab = 'downloader', $event.preventDefault()) : null"
              >
                {{ $t('app.tab_settings') }}
              </TabsTrigger>
            </TabsList>
          </header>
          
          <div class="flex-1 flex flex-col overflow-hidden px-1 pt-1">
            <TabsContent value="downloader" class="flex-1 outline-none m-0 overflow-hidden h-full">
              <DownloaderTab />
            </TabsContent>
            
            <div 
              v-show="activeTab === 'settings'"
              class="flex-1 overflow-y-auto outline-none animate-in fade-in slide-in-from-right-4 duration-300 m-0 pb-4 h-full"
            >
              <div class="relative bg-card rounded-2xl border shadow-xl overflow-hidden flex flex-col">
                <div class="flex items-center justify-between p-4 border-b bg-muted/30 flex-shrink-0">
                  <div>
                    <h2 class="text-lg font-bold tracking-tight">{{ $t('app.settings_title') }}</h2>
                    <p class="text-xs text-muted-foreground">{{ $t('app.settings_desc') }}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    class="hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors h-8 w-8"
                    @click="activeTab = 'downloader'"
                  >
                    <X class="h-5 w-5" />
                  </Button>
                </div>
                <div class="p-6">
                  <SettingsTab />
                </div>
              </div>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  </TooltipProvider>
</template>

<style>
/* Base shadcn variables are already in style.css */
</style>
