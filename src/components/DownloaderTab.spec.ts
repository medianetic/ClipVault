import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DownloaderTab from './DownloaderTab.vue'
import TooltipProvider from '@/components/ui/tooltip/TooltipProvider.vue'
import { h } from 'vue'

// Mock the window.api
const mockApi = {
  listVideos: vi.fn().mockResolvedValue([]),
  getMetadata: vi.fn(),
  checkVideoExists: vi.fn().mockResolvedValue(false),
  startDownload: vi.fn().mockResolvedValue({ success: true, filePath: '/path/video.mp4' }),
  onDownloadProgress: vi.fn(),
  getStoreValue: vi.fn().mockResolvedValue('en'),
}

vi.stubGlobal('window', {
  api: mockApi,
  confirm: vi.fn().mockReturnValue(true)
})

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  Search: () => h('div', 'Search'),
  Download: () => h('div', 'Download'),
  Loader2: () => h('div', 'Loader2'),
  CheckCircle2: () => h('div', 'CheckCircle2'),
  AlertCircle: () => h('div', 'AlertCircle'),
  Youtube: () => h('div', 'Youtube'),
  Languages: () => h('div', 'Languages'),
  Settings2: () => h('div', 'Settings2'),
  PlayCircle: () => h('div', 'PlayCircle'),
  Folder: () => h('div', 'Folder'),
  LayoutGrid: () => h('div', 'LayoutGrid'),
  List: () => h('div', 'List'),
  Trash2: () => h('div', 'Trash2'),
  ArrowUpDown: () => h('div', 'ArrowUpDown'),
  Clock: () => h('div', 'Clock'),
  HardDrive: () => h('div', 'HardDrive'),
  Filter: () => h('div', 'Filter'),
  X: () => h('div', 'X'),
  Music: () => h('div', 'Music'),
  Film: () => h('div', 'Film')
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('DownloaderTab component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the URL input field', () => {
    const wrapper = mount(TooltipProvider, {
      global: {
        mocks: {
          $t: (key: string) => key
        }
      },
      slots: {
        default: () => h(DownloaderTab)
      }
    })
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
  })

  it('loads local videos on mount', async () => {
    mockApi.listVideos.mockResolvedValueOnce([
      { name: 'test.mp4', path: '/path/test.mp4', size: 100, mtime: new Date(), type: 'video' }
    ])

    mount(TooltipProvider, {
      global: {
        mocks: {
          $t: (key: string) => key
        }
      },
      slots: {
        default: () => h(DownloaderTab)
      }
    })

    expect(mockApi.listVideos).toHaveBeenCalled()
  })
})
