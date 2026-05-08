<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FolderOpen, Moon, Sun, Monitor, HardDrive, Palette, Info, ExternalLink, User, Settings2, Globe, RefreshCcw, AlertTriangle } from 'lucide-vue-next'
import { version } from '../../package.json'
import { toast } from 'vue-sonner'

const { locale, t } = useI18n()

const downloadDir = ref('')
const theme = ref('system')
const appLang = ref('en')
const defaultQuality = ref('best')
const defaultAudioLang = ref('default')
const isResetting = ref(false)
const isCheckingUpdates = ref(false)

const loadSettings = async () => {
  downloadDir.value = await window.api.getStoreValue('downloadDir') || ''
  theme.value = await window.api.getStoreValue('theme') || 'system'
  appLang.value = await window.api.getStoreValue('language') || 'en'
  defaultQuality.value = await window.api.getStoreValue('defaultQuality') || 'best'
  defaultAudioLang.value = await window.api.getStoreValue('defaultAudioLang') || 'default'
  applyTheme(theme.value)
  locale.value = appLang.value
}

const selectDirectory = async () => {
  try {
    const path = await window.api.selectDirectory()
    if (path) {
      downloadDir.value = path
      await window.api.setStoreValue('downloadDir', path)
      toast.success(t('settings.success_dir'))
    }
  } catch (e) {
    toast.error(t('settings.error_dir'))
  }
}

const applyTheme = (tTheme: string) => {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')

  if (tTheme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    root.classList.add(systemTheme)
  } else {
    root.classList.add(tTheme)
  }
}

watch(theme, async (newTheme) => {
  await window.api.setStoreValue('theme', newTheme)
  applyTheme(newTheme)
})

watch(appLang, async (newLang) => {
  await window.api.setStoreValue('language', newLang)
  locale.value = newLang
})

watch(defaultQuality, async (val) => {
  await window.api.setStoreValue('defaultQuality', val)
})

watch(defaultAudioLang, async (val) => {
  await window.api.setStoreValue('defaultAudioLang', val)
})

const openExternal = (url: string) => {
  window.api.openExternal(url)
}
const resetBinaries = async () => {
  const confirmed = window.confirm(t('settings.reset_confirm'))
  if (confirmed) {
    isResetting.value = true
    await window.api.deleteBinaries()
    // Reload to trigger download check in App.vue
    window.location.reload()
  }
}

const checkForUpdates = async () => {
  isCheckingUpdates.value = true
  try {
    await window.api.checkForUpdates()
    // We don't need to do anything else here as the listeners in App.vue will handle the response
    toast.info(t('app.update_downloading').replace('...', ''))
  } catch (e) {
    console.error('Failed to check for updates:', e)
  } finally {
    setTimeout(() => {
      isCheckingUpdates.value = false
    }, 1000)
  }
}

onMounted(loadSettings)

</script>

<template>
  <div class="space-y-8">
    <!-- Storage Section -->
    <section class="space-y-3">
      <div class="flex items-center gap-2 mb-1">
        <div class="bg-blue-500/10 p-1.5 rounded-lg text-blue-500">
          <HardDrive class="h-4 w-4" />
        </div>
        <h3 class="text-base font-bold">{{ $t('settings.storage') }}</h3>
      </div>
      <div class="pl-10 space-y-3">
        <div class="space-y-1.5">
          <label class="font-bold text-muted-foreground uppercase tracking-wider text-[9px]">{{ $t('settings.default_dir') }}</label>
          <div class="flex gap-2">
            <Input v-model="downloadDir" readonly :placeholder="$t('settings.default_dir_placeholder')" class="bg-muted/50 border-none shadow-inner h-10 text-xs" />
            <Button variant="secondary" size="icon" @click="selectDirectory" class="h-10 w-10 shrink-0">
              <FolderOpen class="h-4 w-4" />
            </Button>
          </div>
          <p class="text-[10px] text-muted-foreground italic pl-1">{{ $t('settings.dir_hint') }}</p>
        </div>
      </div>
    </section>

    <!-- Appearance Section -->
    <section class="space-y-3">
      <div class="flex items-center gap-2 mb-1">
        <div class="bg-purple-500/10 p-1.5 rounded-lg text-purple-500">
          <Palette class="h-4 w-4" />
        </div>
        <h3 class="text-base font-bold">{{ $t('settings.appearance') }}</h3>
      </div>
      <div class="pl-10 space-y-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-1.5 mt-0">
          <label class="font-bold text-muted-foreground uppercase tracking-wider text-[9px]">{{ $t('settings.theme_mode') }}</label>
          <Select v-model="theme">
            <SelectTrigger class="bg-muted/50 border-none shadow-inner h-10 text-xs">
              <SelectValue :placeholder="$t('settings.select_theme')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">
                <div class="flex items-center gap-2 py-0.5">
                  <Sun class="h-3.5 w-3.5 text-orange-500" /> {{ $t('settings.light_mode') }}
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div class="flex items-center gap-2 py-0.5">
                  <Moon class="h-3.5 w-3.5 text-indigo-400" /> {{ $t('settings.dark_mode') }}
                </div>
              </SelectItem>
              <SelectItem value="system">
                <div class="flex items-center gap-2 py-0.5">
                  <Monitor class="h-3.5 w-3.5 text-slate-400" /> {{ $t('settings.system_default') }}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div class="space-y-1.5 mt-0">
          <label class="font-bold text-muted-foreground uppercase tracking-wider text-[9px]">{{ $t('settings.app_language') }}</label>
          <Select v-model="appLang">
            <SelectTrigger class="bg-muted/50 border-none shadow-inner h-10 text-xs">
              <SelectValue :placeholder="$t('settings.select_language')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">
                <div class="flex items-center gap-2 py-0.5">
                  <Globe class="h-3.5 w-3.5 text-blue-400" /> English
                </div>
              </SelectItem>
              <SelectItem value="de">
                <div class="flex items-center gap-2 py-0.5">
                  <Globe class="h-3.5 w-3.5 text-yellow-400" /> Deutsch
                </div>
              </SelectItem>
              <SelectItem value="es">
                <div class="flex items-center gap-2 py-0.5">
                  <Globe class="h-3.5 w-3.5 text-red-500" /> Español
                </div>
              </SelectItem>
              <SelectItem value="fr">
                <div class="flex items-center gap-2 py-0.5">
                  <Globe class="h-3.5 w-3.5 text-blue-300" /> Français
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>

    <!-- Download Preferences Section -->
    <section class="space-y-3">
      <div class="flex items-center gap-2 mb-1">
        <div class="bg-green-500/10 p-1.5 rounded-lg text-green-500">
          <Settings2 class="h-4 w-4" />
        </div>
        <h3 class="text-base font-bold">{{ $t('settings.download_prefs') }}</h3>
      </div>
      <div class="pl-10 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="font-bold text-muted-foreground uppercase tracking-wider text-[9px]">{{ $t('settings.default_quality') }}</label>
            <Select v-model="defaultQuality">
              <SelectTrigger class="bg-muted/50 border-none shadow-inner h-10 text-xs">
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
          <div class="space-y-1.5">
            <label class="font-bold text-muted-foreground uppercase tracking-wider text-[9px]">{{ $t('settings.default_audio_lang') }}</label>
            <Select v-model="defaultAudioLang">
              <SelectTrigger class="bg-muted/50 border-none shadow-inner h-10 text-xs">
                <SelectValue :placeholder="$t('downloader.audio_language')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">{{ $t('downloader.original_best') }}</SelectItem>
                <SelectItem value="en">{{ $t('downloader.lang_en') }}</SelectItem>
                <SelectItem value="de">{{ $t('downloader.lang_de') }}</SelectItem>
                <SelectItem value="es">{{ $t('downloader.lang_es') }}</SelectItem>
                <SelectItem value="fr">{{ $t('downloader.lang_fr') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>

    <!-- Troubleshooting Section -->
    <section class="space-y-3">
      <div class="flex items-center gap-2 mb-1">
        <div class="bg-destructive/10 p-1.5 rounded-lg text-destructive">
          <AlertTriangle class="h-4 w-4" />
        </div>
        <h3 class="text-base font-bold">{{ $t('settings.troubleshooting') }}</h3>
      </div>
      <div class="pl-10 space-y-3">
        <div class="p-4 bg-destructive/5 rounded-2xl border border-destructive/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="space-y-1 text-center sm:text-left">
            <p class="text-xs font-bold text-foreground">{{ $t('settings.reset_deps') }}</p>
            <p class="text-[10px] text-muted-foreground leading-relaxed max-w-sm">
              {{ $t('settings.reset_deps_desc') }}
            </p>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            class="h-9 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-destructive/10 shrink-0"
            @click="resetBinaries"
            :disabled="isResetting"
          >
            <RefreshCcw class="mr-2 h-3.5 w-3.5" :class="{ 'animate-spin': isResetting }" />
            {{ $t('settings.reset_deps') }}
          </Button>
        </div>
      </div>
    </section>

    <!-- About Section -->
    <section class="space-y-3 pt-2">
      <div class="flex items-center gap-2 mb-1">
        <div class="bg-orange-500/10 p-1.5 rounded-lg text-orange-500">
          <Info class="h-4 w-4" />
        </div>
        <h3 class="text-base font-bold">{{ $t('settings.about') }}</h3>
      </div>
      <div class="pl-10 space-y-4">
        <div class="p-3 bg-muted/30 rounded-xl border border-border/50">
          <p class="text-sm font-bold text-foreground">ClipVault</p>
          <div class="flex items-center justify-between mt-0.5">
            <p class="text-[10px] text-muted-foreground">{{ $t('settings.version', { version }) }}</p>
            <Button 
              variant="ghost" 
              size="xs" 
              class="h-6 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider"
              @click="checkForUpdates"
              :disabled="isCheckingUpdates"
            >
              <RefreshCcw class="mr-1.5 h-3 w-3" :class="{ 'animate-spin': isCheckingUpdates }" />
              {{ $t('app.update_check') }}
            </Button>
          </div>
          <p class="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            {{ $t('settings.desc') }}
          </p>
        </div>

        <div class="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/10 group hover:bg-primary/10 transition-colors">
          <div class="flex items-center gap-3">
            <div class="bg-background p-1.5 rounded-full shadow-sm">
              <User class="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p class="text-[9px] font-bold uppercase tracking-tight text-primary/70">{{ $t('settings.developer') }}</p>
              <p class="text-xs font-bold">Nick Weschkalnies</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            class="rounded-full gap-2 text-[10px] h-7 px-3"
            @click="openExternal('https://www.weschkalnies.de')"
          >
            {{ $t('settings.visit_website') }} <ExternalLink class="h-3 w-3" />
          </Button>
        </div>
      </div>
    </section>
  </div>
</template>