<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner'

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-vue-next'
import { Toaster as Sonner } from 'vue-sonner'
import 'vue-sonner/style.css'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<ToasterProps & { theme?: 'light' | 'dark' | 'system' }>(), {
  theme: 'auto',
  position: 'bottom-right',
  expand: true,
})
</script>

<template>
  <Sonner
    :class="cn('toaster group', props.class)"
    v-bind="props"
    :theme="props.theme"
    :expand="props.expand"
    :rich-colors="false"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
      '--success-bg': 'var(--primary)',
      '--success-text': 'var(--primary-foreground)',
      '--success-border': 'var(--primary)',
      '--error-bg': 'var(--destructive)',
      '--error-text': 'var(--destructive-foreground)',
      '--error-border': 'var(--destructive)',
    }"
    :toast-options="{
      classes: {
        toast: 'rounded-2xl border shadow-lg font-sans',
        description: 'text-muted-foreground font-medium',
        actionButton: 'bg-primary text-primary-foreground font-bold rounded-xl',
        cancelButton: 'bg-muted text-muted-foreground font-bold rounded-xl',
        success: 'bg-primary text-primary-foreground border-primary',
        error: 'bg-destructive text-destructive-foreground border-destructive',
      },
    }"
  >
    <template #success-icon>
      <CircleCheckIcon class="size-4" />
    </template>
    <template #info-icon>
      <InfoIcon class="size-4" />
    </template>
    <template #warning-icon>
      <TriangleAlertIcon class="size-4" />
    </template>
    <template #error-icon>
      <OctagonXIcon class="size-4" />
    </template>
    <template #loading-icon>
      <div>
        <Loader2Icon class="size-4 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <XIcon class="size-4" />
    </template>
  </Sonner>
</template>
