<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { 
  Search, Download, Loader2, CheckCircle2, AlertCircle, Youtube, Languages, Settings2, 
  PlayCircle, Folder, LayoutGrid, List, Trash2, ArrowUpDown, Clock, HardDrive, Filter, X,
  Music, Film
} from 'lucide-vue-next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu'
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from '@/components/ui/dialog'
import { toast } from 'vue-sonner'

interface VideoItem {
  name: string
  path: string
  size: number
  mtime: Date
  thumbnail?: string
  duration?: number
  type: 'video' | 'audio'
}

interface DownloadItem {
  url: string
  title: string
  thumbnail?: string
  progress: number
  status: 'downloading' | 'completed' | 'error'
  error?: string
  filePath?: string
  timestamp: Date
  type: 'video' | 'audio'
}

const { t } = useI18n()

const url = ref('')
const loadingMetadata = ref(false)
const metadata = ref<any>(null)
const selectedFormat = ref('best')
const enableSubtitles = ref(false)
const selectedSubLang = ref('en')
const activeDownloads = ref<DownloadItem[]>([])
const localVideos = ref<VideoItem[]>([])
const error = ref('')

const viewMode = ref<'detailed' | 'compact'>('detailed')
const searchQuery = ref('')
const sortBy = ref<'date' | 'name' | 'size'>('date')
const filterType = ref<'all' | 'video' | 'audio'>('all')
const videoToDelete = ref<VideoItem | null>(null)
const isDeleting = ref(false)

const filteredVideos = computed(() => {
  let result = [...localVideos.value]

  // Filter Search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(v => v.name.toLowerCase().includes(query))
  }

  // Filter Type
  if (filterType.value !== 'all') {
    result = result.filter(v => v.type === filterType.value)
  }

  // Sort
  result.sort((a, b) => {
    if (sortBy.value === 'date') {
      return new Date(b.mtime).getTime() - new Date(a.mtime).getTime()
    } else if (sortBy.value === 'name') {
      return a.name.localeCompare(b.name)
    } else if (sortBy.value === 'size') {
      return b.size - a.size
    }
    return 0
  })

  return result
})

const formatDuration = (seconds?: number) => {
  if (!seconds) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (date: Date) => {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${month}.${year} ${hours}:${minutes}`
}

const loadLocalVideos = async () => {
  try {
    const videos = await window.api.listVideos()
    localVideos.value = videos
  } catch (e) {
    toast.error(t('downloader.error_list'))
  }
}

const isValidUrl = (string: string) => {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

const fetchMetadata = async () => {
  if (!url.value) return
  
  if (!isValidUrl(url.value)) {
    error.value = t('downloader.error_invalid_url')
    toast.error(t('downloader.error_invalid_url'))
    return
  }

  loadingMetadata.value = true
  error.value = ''
  metadata.value = null
  
  try {
    const data = await window.api.getMetadata(url.value)
    metadata.value = data
  } catch (e: any) {
    const rawError = e.message || ''
    // If error contains "is not a valid URL" or similar from yt-dlp, show a clean message
    if (rawError.includes('is not a valid URL') || rawError.includes('ERROR:')) {
      error.value = t('downloader.error_invalid_url')
    } else {
      error.value = t('downloader.error_metadata')
    }
    toast.error(error.value)
  } finally {
    loadingMetadata.value = false
  }
}

const startDownload = async () => {
  if (!metadata.value) return

  const exists = await window.api.checkVideoExists(metadata.value.title, selectedFormat.value)
  if (exists) {
    const confirmDownload = window.confirm(`"${metadata.value.title}" already exists in your library. Do you want to download it again?`)
    if (!confirmDownload) return
  }

  const newDownload: DownloadItem = {
    url: url.value,
    title: metadata.value.title,
    thumbnail: metadata.value.thumbnail,
    progress: 0,
    status: 'downloading',
    timestamp: new Date(),
    type: selectedFormat.value === 'bestaudio' ? 'audio' : 'video'
  }

  activeDownloads.value.unshift(newDownload)
  const currentUrl = url.value
  const currentTitle = metadata.value.title
  
  const downloadOptions = {
    url: currentUrl,
    title: currentTitle,
    format: selectedFormat.value,
    subtitles: enableSubtitles.value,
    subtitleLang: selectedSubLang.value
  }

  url.value = ''
  metadata.value = null

  try {
    const result = await window.api.startDownload(downloadOptions) as any
    const item = activeDownloads.value.find(d => d.url === currentUrl)
    if (item) {
      item.status = 'completed'
      item.progress = 100
      item.filePath = result.filePath
    }
    toast.success(t('downloader.success_download', { title: currentTitle }))
    await loadLocalVideos()
  } catch (e: any) {
    const item = activeDownloads.value.find(d => d.url === currentUrl)
    if (item) {
      item.status = 'error'
      item.error = e.message
    }
    toast.error(t('downloader.error_download'))
  }
}

const openFile = (filePath?: string) => {
  if (filePath) {
    window.api.openFile(filePath)
  }
}

const openFolder = (filePath?: string) => {
  if (filePath) {
    window.api.openFolder(filePath)
  }
}

const confirmDelete = (video: VideoItem) => {
  videoToDelete.value = video
}

const deleteVideo = async () => {
  if (!videoToDelete.value) return
  isDeleting.value = true
  try {
    const success = await window.api.deleteVideo(videoToDelete.value.path)
    if (success) {
      toast.success(t('downloader.success_delete'))
      await loadLocalVideos()
      videoToDelete.value = null
    }
  } catch (e) {
    toast.error(t('downloader.error_delete'))
  } finally {
    isDeleting.value = false
  }
}

onMounted(async () => {
  loadLocalVideos()
  
  // Load preferences
  const mode = await window.api.getStoreValue('libraryViewMode')
  if (mode) viewMode.value = mode as any
  
  const sort = await window.api.getStoreValue('librarySortBy')
  if (sort) sortBy.value = sort as any

  const defQuality = await window.api.getStoreValue('defaultQuality')
  if (defQuality) selectedFormat.value = defQuality
  
  const defSubtitles = await window.api.getStoreValue('defaultSubtitles')
  if (defSubtitles !== undefined) enableSubtitles.value = defSubtitles
  
  const defSubLang = await window.api.getStoreValue('defaultSubLang')
  if (defSubLang) selectedSubLang.value = defSubLang

  window.api.onDownloadProgress(({ url, progress }) => {
    const item = activeDownloads.value.find(d => d.url === url)
    if (item) {
      item.progress = progress
    }
  })
})

const setViewMode = (mode: 'detailed' | 'compact') => {
  viewMode.value = mode
  window.api.setStoreValue('libraryViewMode', mode)
}

const setSortBy = (sort: 'date' | 'name' | 'size') => {
  sortBy.value = sort
  window.api.setStoreValue('librarySortBy', sort)
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Fixed Top Section -->
    <div class="flex-shrink-0 p-1 pb-4 space-y-4">
      <!-- URL Input Section -->
      <Card class="border-border/50 shadow-lg bg-card/60 backdrop-blur-md">
        <CardContent class="p-3">
          <div class="flex flex-col sm:flex-row items-center gap-2">
            <div class="relative flex-1 w-full group">
              <Input 
                v-model="url" 
                placeholder="https://www.youtube.com/watch?v=..." 
                class="h-10 pl-10 text-xs rounded-xl transition-all border-none bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                @keyup.enter="fetchMetadata" 
              />
              <Youtube class="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500 h-4 w-4" />
              <button 
                v-if="url" 
                @click="url = ''" 
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
            <Button 
              @click="fetchMetadata" 
              :disabled="loadingMetadata || !url"
              class="h-10 px-5 rounded-xl w-full sm:w-auto font-bold text-[10px] uppercase tracking-widest shadow-sm"
            >
              <Loader2 v-if="loadingMetadata" class="mr-2 h-3.5 w-3.5 animate-spin" />
              <Search v-else class="mr-2 h-3.5 w-3.5" />
              {{ loadingMetadata ? 'Fetching...' : $t('downloader.fetch_details') }}
            </Button>
          </div>
          <p v-if="error" class="text-destructive text-[10px] mt-2 flex items-center gap-1.5 animate-in slide-in-from-top-1 font-bold pl-1 uppercase tracking-tighter">
            <AlertCircle class="h-3.5 w-3.5" />
            {{ error }}
          </p>
        </CardContent>
      </Card>

      <!-- Preview & Configuration Section -->
      <div v-if="metadata" class="animate-in zoom-in-95 duration-300">
        <Card class="overflow-hidden border border-primary/15 shadow-2xl bg-card/40 backdrop-blur-xl">
          <div class="flex flex-col md:flex-row">
            <div class="md:w-1/4 relative group shrink-0 bg-muted">
              <img :src="metadata.thumbnail || '/video-placeholder.svg'" class="w-full h-full object-cover aspect-video md:aspect-auto" />
              <div class="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div class="bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded text-[10px] font-bold border border-border/50">
                  {{ metadata.duration_string }}
                </div>
              </div>
            </div>
            <div class="md:w-3/4 p-5 flex flex-col justify-between space-y-5">
              <div class="space-y-1.5">
                <h3 class="text-xl font-bold leading-tight line-clamp-2 tracking-tight" :title="metadata.title">{{ metadata.title }}</h3>
                <p class="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">{{ metadata.uploader }}</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-muted/40 rounded-xl border border-border/50">
                <div class="space-y-2">
                  <div class="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
                    <Settings2 class="h-3 w-3" /> {{ $t('downloader.quality') }}
                  </div>
                  <Select v-model="selectedFormat">
                    <SelectTrigger class="bg-background/50 border-none shadow-sm h-9 text-xs font-medium rounded-lg">
                      <SelectValue placeholder="Select quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="best">{{ $t('downloader.highest_available') }}</SelectItem>
                      <SelectItem value="bestvideo+bestaudio">{{ $t('downloader.remux') }}</SelectItem>
                      <SelectItem value="mp4">{{ $t('downloader.mp4_format') }}</SelectItem>
                      <SelectItem value="bestaudio">{{ $t('downloader.audio_only') }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
                      <Languages class="h-3 w-3" /> {{ $t('downloader.subtitles') }}
                    </div>
                    <Switch v-model:checked="enableSubtitles" class="scale-75 origin-right" />
                  </div>
                  <Select v-model="selectedSubLang" :disabled="!enableSubtitles">
                    <SelectTrigger class="bg-background/50 border-none shadow-sm h-9 text-xs font-medium rounded-lg disabled:opacity-40">
                      <SelectValue :placeholder="$t('downloader.language')" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{{ $t('downloader.lang_en') }}</SelectItem>
                      <SelectItem value="de">{{ $t('downloader.lang_de') }}</SelectItem>
                      <SelectItem value="fr">{{ $t('downloader.lang_fr') }}</SelectItem>
                      <SelectItem value="es">{{ $t('downloader.lang_es') }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button @click="startDownload" size="lg" class="w-full h-12 text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all rounded-xl">
                <Download class="mr-2 h-4 w-4" />
                {{ $t('downloader.start_download') }}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>

    <!-- Scrollable Content Section -->
    <div class="flex-1 overflow-y-auto p-1 pr-2 pb-8 space-y-4">
      <!-- Download Queue Section -->
      <div v-if="activeDownloads.length > 0" class="space-y-3 pt-2">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-[10px] font-black tracking-[0.2em] text-muted-foreground/60 uppercase">{{ $t('downloader.recent_activity') }}</h3>
          <span class="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/10">
            {{ activeDownloads.length }}
          </span>
        </div>
        
        <div class="grid gap-2">
          <Card v-for="download in activeDownloads" :key="download.url" class="overflow-hidden hover:bg-muted/30 transition-colors border-border/50 shadow-sm bg-card/40">
            <CardContent class="p-2.5">
              <div class="flex items-center gap-3">
                <div class="relative w-20 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-muted border border-border/50">
                  <img :src="download.thumbnail || '/video-placeholder.svg'" class="w-full h-full object-cover" />
                  <div v-if="download.status === 'downloading'" class="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 class="h-4 w-4 text-white animate-spin" />
                  </div>
                </div>
                
                <div class="flex-1 min-w-0 flex flex-col justify-center">
                  <div class="flex justify-between items-center mb-1.5">
                    <div class="min-w-0 pr-4">
                      <p class="text-[11px] font-bold truncate text-foreground tracking-tight">{{ download.title }}</p>
                      <p class="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-tighter">{{ formatDate(download.timestamp) }}</p>
                    </div>
                    <div class="flex-shrink-0 flex items-center gap-1.5">
                      <Tooltip v-if="download.status === 'completed'">
                        <TooltipTrigger as-child>
                          <Button 
                            variant="secondary" 
                            size="icon" 
                            class="h-7 w-7 rounded-lg bg-muted/50"
                            @click="openFolder(download.filePath)"
                          >
                            <Folder class="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p class="text-[10px]">{{ $t('downloader.open_folder') }}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Button 
                        v-if="download.status === 'completed'" 
                        variant="secondary" 
                        size="sm" 
                        class="h-7 px-2.5 text-[9px] font-black uppercase tracking-widest gap-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border-none"
                        @click="openFile(download.filePath)"
                      >
                        <PlayCircle class="h-3 w-3" /> {{ download.type === 'audio' ? $t('downloader.play_audio_short') : $t('downloader.view_video_short') }}
                      </Button>
                      <div v-if="download.status === 'completed'" class="bg-green-500/10 text-green-500 text-[9px] font-black px-2 py-1 rounded-lg flex items-center uppercase tracking-widest">
                        <CheckCircle2 class="h-3 w-3 mr-1" />
                      </div>
                      <div v-else-if="download.status === 'error'" class="bg-destructive/10 text-destructive text-[9px] font-black px-2 py-1 rounded-lg flex items-center uppercase tracking-widest">
                        <AlertCircle class="h-3 w-3 mr-1" />
                      </div>
                      <div v-else class="text-[10px] font-black tabular-nums text-primary bg-primary/10 px-2 py-1 rounded-lg tracking-tight">
                        {{ Math.round(download.progress) }}%
                      </div>
                    </div>
                  </div>
                  
                  <div class="relative">
                    <Progress 
                      :model-value="download.progress" 
                      class="h-1.5 rounded-full bg-muted/50 overflow-hidden" 
                      :class="{ 'bg-green-500/20': download.status === 'completed', 'bg-red-500/20': download.status === 'error' }" 
                    />
                    <div 
                      v-if="download.status === 'downloading'"
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
                    ></div>
                  </div>
                  
                  <p v-if="download.error" class="text-[9px] text-destructive mt-1 font-bold uppercase tracking-tighter flex items-center gap-1">
                    <AlertCircle class="h-2.5 w-2.5" /> {{ download.error }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Library Section -->
      <div v-if="localVideos.length > 0" class="space-y-4 pt-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1">
          <div class="flex items-center gap-3">
            <h3 class="text-sm font-black tracking-[0.2em] text-muted-foreground uppercase">{{ $t('downloader.library') }}</h3>
            <span class="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-border/10 shadow-sm">
              {{ localVideos.length }}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <!-- Search Input -->
            <div class="relative w-full md:w-48 group">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
              <Input 
                v-model="searchQuery" 
                :placeholder="$t('downloader.search_library')" 
                class="h-9 pl-9 pr-8 bg-muted/30 border-none text-xs rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20 shadow-inner"
              />
              <button 
                v-if="searchQuery" 
                @click="searchQuery = ''" 
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                <X class="h-3 w-3" />
              </button>
            </div>

            <!-- Filter Type Dropdown -->
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="secondary" size="icon" class="h-9 w-9 shrink-0 bg-muted/30 border-none rounded-lg hover:bg-muted/50">
                  <div class="relative">
                    <Filter class="h-3.5 w-3.5 opacity-60" />
                    <div v-if="filterType !== 'all'" class="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border border-background"></div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-48 rounded-xl border-border/50 bg-card/95 backdrop-blur-xl">
                <DropdownMenuLabel class="text-[10px] font-black uppercase tracking-widest opacity-50">{{ $t('downloader.filter_type') }}</DropdownMenuLabel>
                <DropdownMenuSeparator class="bg-white/5" />
                <DropdownMenuItem @click="filterType = 'all'" :class="{ 'bg-primary/10 text-primary': filterType === 'all' }" class="text-xs font-bold rounded-lg m-1">
                  <LayoutGrid class="mr-2 h-3.5 w-3.5" /> {{ $t('downloader.type_all') }}
                </DropdownMenuItem>
                <DropdownMenuItem @click="filterType = 'video'" :class="{ 'bg-primary/10 text-primary': filterType === 'video' }" class="text-xs font-bold rounded-lg m-1">
                  <Film class="mr-2 h-3.5 w-3.5" /> {{ $t('downloader.type_video') }}
                </DropdownMenuItem>
                <DropdownMenuItem @click="filterType = 'audio'" :class="{ 'bg-primary/10 text-primary': filterType === 'audio' }" class="text-xs font-bold rounded-lg m-1">
                  <Music class="mr-2 h-3.5 w-3.5" /> {{ $t('downloader.type_audio') }}
                </DropdownMenuItem>
                
                <DropdownMenuSeparator class="bg-white/5" />
                <DropdownMenuLabel class="text-[10px] font-black uppercase tracking-widest opacity-50">{{ $t('downloader.sort_by') }}</DropdownMenuLabel>
                <DropdownMenuItem @click="setSortBy('date')" :class="{ 'bg-primary/10 text-primary': sortBy === 'date' }" class="text-xs font-bold rounded-lg m-1">
                  <Clock class="mr-2 h-3.5 w-3.5" /> {{ $t('downloader.sort_date') }}
                </DropdownMenuItem>
                <DropdownMenuItem @click="setSortBy('name')" :class="{ 'bg-primary/10 text-primary': sortBy === 'name' }" class="text-xs font-bold rounded-lg m-1">
                  <ArrowUpDown class="mr-2 h-3.5 w-3.5" /> {{ $t('downloader.sort_name') }}
                </DropdownMenuItem>
                <DropdownMenuItem @click="setSortBy('size')" :class="{ 'bg-primary/10 text-primary': sortBy === 'size' }" class="text-xs font-bold rounded-lg m-1">
                  <HardDrive class="mr-2 h-3.5 w-3.5" /> {{ $t('downloader.sort_size') }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <!-- View Toggle -->
            <div class="flex items-center bg-muted/30 p-1 rounded-lg shadow-inner">
              <Button 
                variant="ghost" 
                size="icon" 
                class="h-7 w-7 rounded-md transition-all"
                :class="{ 'bg-background shadow-sm text-primary': viewMode === 'detailed' }"
                @click="setViewMode('detailed')"
              >
                <LayoutGrid class="h-3.5 w-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                class="h-7 w-7 rounded-md transition-all"
                :class="{ 'bg-background shadow-sm text-primary': viewMode === 'compact' }"
                @click="setViewMode('compact')"
              >
                <List class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
        
        <!-- Grid View (Detailed) -->
        <div v-if="viewMode === 'detailed'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card v-for="video in filteredVideos" :key="video.path" class="group overflow-hidden border-border/50 shadow-sm hover:shadow-xl transition-all duration-500 bg-card/40 backdrop-blur-md">
            <CardContent class="p-3">
              <div class="flex flex-col h-full">
                <!-- Thumbnail Wrapper (Conditional for Video/Audio) -->
                <div class="relative aspect-video overflow-hidden cursor-pointer rounded-xl border border-border/50 shadow-inner" @click="openFile(video.path)">
                  <template v-if="video.type === 'video'">
                    <img :src="video.thumbnail || '/video-placeholder.svg'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  </template>
                  <template v-else>
                    <!-- Audio Black Card Design -->
                    <div class="w-full h-full bg-neutral-950 flex items-center justify-center relative overflow-hidden group/audio">
                      <!-- Abstract Background Pattern -->
                      <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent)]"></div>
                      <div class="absolute -inset-[100%] opacity-10 bg-[conic-gradient(from_0deg,transparent,rgba(249,115,22,0.1),transparent)] animate-[spin_15s_linear_infinite]"></div>
                      
                      <div class="relative z-10 flex flex-col items-center gap-3">
                        <div class="p-4 rounded-3xl bg-orange-500/10 border border-orange-500/20 shadow-2xl backdrop-blur-xl group-hover/audio:scale-110 transition-transform duration-500">
                          <Music class="h-10 w-10 text-orange-500 animate-pulse" />
                        </div>
                        <div class="flex flex-col items-center">
                           <span class="text-[8px] font-black uppercase tracking-[0.3em] text-orange-500/40 mb-1">High Quality Audio</span>
                           <div class="flex gap-0.5 items-end h-3">
                             <div class="w-0.5 bg-orange-500/40 rounded-full animate-music-bar-1 h-[40%]"></div>
                             <div class="w-0.5 bg-orange-500/60 rounded-full animate-music-bar-2 h-[70%]"></div>
                             <div class="w-0.5 bg-orange-500/40 rounded-full animate-music-bar-3 h-[50%]"></div>
                             <div class="w-0.5 bg-orange-500/60 rounded-full animate-music-bar-4 h-[90%]"></div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Duration Badge -->
                  <div class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] font-black text-white tracking-widest border border-border/50 uppercase">
                    {{ formatDuration(video.duration) }}
                  </div>
                </div>

                <!-- Content Wrapper -->
                <div class="pt-3 px-1 flex flex-col justify-between flex-1 space-y-3">
                  <div class="space-y-1">
                    <p class="text-[13px] font-bold line-clamp-1 text-foreground tracking-tight" :title="video.name">{{ video.name }}</p>
                    <div class="flex items-center gap-2.5 text-[9px] text-muted-foreground/70 font-black uppercase tracking-widest">
                      <span class="flex items-center gap-1" :class="{ 'text-orange-500': video.type === 'audio' }">
                        <Music v-if="video.type === 'audio'" class="h-2.5 w-2.5" />
                        <Film v-else class="h-2.5 w-2.5 opacity-50" />
                        {{ video.type === 'audio' ? 'Audio' : 'Video' }}
                      </span>
                      <span class="opacity-20">•</span>
                      <span class="flex items-center gap-1"><HardDrive class="h-2.5 w-2.5 opacity-50" /> {{ formatFileSize(video.size) }}</span>
                      <span class="opacity-20">•</span>
                      <span class="flex items-center gap-1"><Clock class="h-2.5 w-2.5 opacity-50" /> {{ formatDate(video.mtime) }}</span>
                    </div>
                  </div>

                  <!-- Action Bar -->
                  <div class="flex items-center justify-between pt-3 border-t border-border/50">
                    <div class="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            class="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary transition-all active:scale-90" 
                            @click="openFile(video.path)"
                          >
                            <PlayCircle class="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p class="text-[10px] font-bold uppercase tracking-widest">{{ video.type === 'audio' ? $t('downloader.play_audio') : $t('downloader.view_video') }}</p></TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            class="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-all active:scale-90" 
                            @click="openFolder(video.path)"
                          >
                            <Folder class="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p class="text-[10px] font-bold uppercase tracking-widest">{{ $t('downloader.open_folder') }}</p></TooltipContent>
                      </Tooltip>
                    </div>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          class="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-all active:scale-90" 
                          @click="confirmDelete(video)"
                        >
                          <Trash2 class="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p class="text-[10px] font-bold uppercase tracking-widest">{{ $t('downloader.delete_video') }}</p></TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- List View (Compact) -->
        <div v-else class="space-y-1.5">
          <div v-for="video in filteredVideos" :key="video.path" class="group flex items-center justify-between p-2 pl-3 pr-2 bg-card/40 hover:bg-muted/30 rounded-xl border border-border/50 transition-all duration-300">
            <div class="flex items-center gap-3 min-w-0">
              <div class="p-1.5 rounded-lg shrink-0 transition-all" :class="video.type === 'audio' ? 'bg-orange-500/10 text-orange-500' : 'bg-primary/10 text-primary'">
                <Music v-if="video.type === 'audio'" class="h-3.5 w-3.5" />
                <PlayCircle v-else class="h-3.5 w-3.5" />
              </div>
              <div class="min-w-0">
                <p class="text-[11px] font-bold truncate text-foreground pr-4" :title="video.name">{{ video.name }}</p>
                <div class="flex items-center gap-2.5 mt-0.5 opacity-50 text-[8px] font-black uppercase tracking-widest">
                  <span class="flex items-center gap-1" :class="{ 'text-orange-500': video.type === 'audio' }">
                    {{ video.type === 'audio' ? 'Audio' : 'Video' }}
                  </span>
                  <span class="opacity-30">•</span>
                  <span class="flex items-center gap-1"><HardDrive class="h-2 w-2" /> {{ formatFileSize(video.size) }}</span>
                  <span class="opacity-30">•</span>
                  <span class="flex items-center gap-1"><Clock class="h-2 w-2" /> {{ formatDate(video.mtime) }}</span>
                  <span v-if="video.duration" class="opacity-30">•</span>
                  <span v-if="video.duration">{{ formatDuration(video.duration) }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0 ml-4">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-muted" @click="openFolder(video.path)">
                    <Folder class="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p class="text-[9px] font-black uppercase tracking-widest">{{ $t('downloader.open_folder') }}</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive" @click="confirmDelete(video)">
                    <Trash2 class="h-3.5 w-3.5 opacity-40 hover:opacity-100" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p class="text-[9px] font-black uppercase tracking-widest">{{ $t('downloader.delete_video') }}</p></TooltipContent>
              </Tooltip>
              
              <Button variant="secondary" size="sm" class="h-7 px-3 font-black text-[9px] uppercase gap-1.5 shadow-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border-none ml-1" @click="openFile(video.path)">
                <PlayCircle class="h-3 w-3" /> {{ video.type === 'audio' ? $t('downloader.play_audio_short') : $t('downloader.view_video_short') }}
              </Button>
            </div>
          </div>
        </div>

        <!-- Empty Search State -->
        <div v-if="filteredVideos.length === 0 && searchQuery" class="flex flex-col items-center justify-center py-20 text-muted-foreground animate-in fade-in zoom-in-95">
          <div class="bg-muted/30 p-4 rounded-full mb-4">
            <Search class="h-8 w-8 opacity-10" />
          </div>
          <p class="text-xs font-black uppercase tracking-widest opacity-40">{{ $t('downloader.no_results') }}</p>
          <Button variant="link" size="sm" class="mt-2 text-primary font-bold text-xs" @click="searchQuery = ''">
            {{ $t('downloader.clear_search') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="!!videoToDelete" @update:open="(val) => !val && (videoToDelete = null)">
      <DialogContent class="sm:max-w-md rounded-3xl bg-card/95 backdrop-blur-2xl border-border/50">
        <DialogHeader>
          <DialogTitle class="text-lg font-black uppercase tracking-widest flex items-center gap-2.5">
            <AlertCircle class="h-5 w-5 text-destructive" />
            {{ $t('downloader.delete_confirm_title') }}
          </DialogTitle>
          <DialogDescription class="pt-3">
            <span class="text-xs font-bold text-muted-foreground/80 leading-relaxed">{{ $t('downloader.delete_confirm_desc') }}</span>
            <p class="mt-4 p-3.5 bg-muted/50 rounded-2xl text-[10px] font-bold break-all text-foreground border border-border/50 shadow-inner leading-relaxed">
              {{ videoToDelete?.name }}
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="mt-8 gap-2 sm:gap-2">
          <Button variant="ghost" class="rounded-xl px-6 text-xs font-bold h-11" @click="videoToDelete = null">
            {{ $t('downloader.cancel') }}
          </Button>
          <Button variant="destructive" class="rounded-xl px-6 shadow-lg shadow-destructive/20 h-11 text-xs font-black uppercase tracking-widest" :disabled="isDeleting" @click="deleteVideo">
            <Loader2 v-if="isDeleting" class="mr-2 h-3.5 w-3.5 animate-spin" />
            {{ $t('downloader.delete_forever') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
@keyframes shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
.animate-shimmer {
  animation: shimmer 1.5s infinite linear;
}

@keyframes music-bar {
  0%, 100% { height: 30%; }
  50% { height: 100%; }
}
.animate-music-bar-1 { animation: music-bar 1.2s ease-in-out infinite; }
.animate-music-bar-2 { animation: music-bar 0.8s ease-in-out infinite; }
.animate-music-bar-3 { animation: music-bar 1.5s ease-in-out infinite; }
.animate-music-bar-4 { animation: music-bar 1.0s ease-in-out infinite; }
</style>
