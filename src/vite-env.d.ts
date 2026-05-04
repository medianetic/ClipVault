/// <reference types="vite/client" />

interface Window {
  api: {
    checkBinaries: () => Promise<{ ytDlp: boolean; ffmpeg: boolean; ffprobe: boolean }>
    downloadYTIDlp: () => Promise<boolean>
    downloadFFmpeg: () => Promise<boolean>
    deleteBinaries: () => Promise<boolean>
    getMetadata: (url: string) => Promise<any>
    startDownload: (options: any) => Promise<boolean>
    selectDirectory: () => Promise<string | null>
    getStoreValue: (key: string) => Promise<any>
    setStoreValue: (key: string, value: any) => Promise<void>
    checkVideoExists: (title: string, format?: string) => Promise<boolean>
    openExternal: (url: string) => Promise<void>
    openFile: (filePath: string) => Promise<void>
    openFolder: (filePath: string) => Promise<void>
    deleteVideo: (filePath: string) => Promise<boolean>
    listVideos: (dirPath?: string) => Promise<Array<{ 
      name: string, 
      path: string, 
      size: number, 
      mtime: Date, 
      thumbnail?: string | null, 
      duration?: number,
      type: 'video' | 'audio'
    }>>
    onBinaryProgress: (callback: (data: { name: string, progress: number }) => void) => () => void
    onDownloadProgress: (callback: (data: { url: string; progress: number }) => void) => () => void
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
}
