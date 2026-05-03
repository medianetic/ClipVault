import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('api', {
  checkBinaries: () => ipcRenderer.invoke('check-binaries'),
  downloadYTIDlp: () => ipcRenderer.invoke('download-yt-dlp'),
  downloadFFmpeg: () => ipcRenderer.invoke('download-ffmpeg'),
  getMetadata: (url: string) => ipcRenderer.invoke('get-metadata', url),
  startDownload: (options: any) => ipcRenderer.invoke('start-download', options),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getStoreValue: (key: string) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key: string, value: any) => ipcRenderer.invoke('set-store-value', key, value),
  checkVideoExists: (title: string, format?: string) => ipcRenderer.invoke('check-video-exists', title, format),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  openFolder: (filePath: string) => ipcRenderer.invoke('open-folder', filePath),
  deleteVideo: (filePath: string) => ipcRenderer.invoke('delete-video', filePath),
  deleteBinaries: () => ipcRenderer.invoke('delete-binaries'),
  listVideos: (dirPath?: string) => ipcRenderer.invoke('list-videos', dirPath),
  onBinaryProgress: (callback: any) => {
    const listener = (_event: any, value: any) => callback(value)
    ipcRenderer.on('binary-progress', listener)
    return () => ipcRenderer.removeListener('binary-progress', listener)
  },
  onDownloadProgress: (callback: any) => {
    const listener = (_event: any, value: any) => callback(value)
    ipcRenderer.on('download-progress', listener)
    return () => ipcRenderer.removeListener('download-progress', listener)
  },
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
})
