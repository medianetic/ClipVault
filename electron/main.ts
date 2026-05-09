import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron'

// Align app name with executable name for consistent config paths on Linux
// Set this as early as possible
app.name = 'clipvault'

import { autoUpdater } from 'electron-updater'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import Store from 'electron-store'
import { logger } from './logger'
import { BinaryManager } from './binaryManager'
import { Downloader } from './downloader'
import { ThumbnailManager } from './thumbnailManager'

// Register custom protocols as privileged
protocol.registerSchemesAsPrivileged([
  { scheme: 'thumb', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
])

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const store = new Store({
  schema: {
    checkUpdateOnStartup: {
      type: 'boolean',
      default: true
    },
    language: {
      type: 'string',
      default: 'en'
    },
    theme: {
      type: 'string',
      default: 'system'
    },
    defaultQuality: {
      type: 'string',
      default: 'best'
    },
    defaultAudioLang: {
      type: 'string',
      default: 'default'
    },
    libraryViewMode: {
      type: 'string',
      enum: ['detailed', 'compact'],
      default: 'detailed'
    },
    librarySortBy: {
      type: 'string',
      enum: ['date', 'name', 'size'],
      default: 'date'
    },
    downloadDir: {
      type: 'string',
      default: ''
    }
  }
})

const binaryManager = new BinaryManager()
const downloader = new Downloader(binaryManager)
const thumbnailManager = new ThumbnailManager(binaryManager)

// Global Exception Handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise })
})

// Environment setup
process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null = null

// IPC Handlers
function registerIpcHandlers() {
  ipcMain.handle('window-minimize', () => win?.minimize())
  ipcMain.handle('window-maximize', () => {
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.handle('window-close', () => win?.close())

  ipcMain.handle('check-binaries', () => binaryManager.checkBinaries())
  
  ipcMain.handle('download-yt-dlp', async () => {
    await binaryManager.downloadYTIDlp((progress) => {
      win?.webContents.send('binary-progress', { name: 'yt-dlp', progress })
    })
    return true
  })

  ipcMain.handle('download-ffmpeg', async () => {
    await binaryManager.downloadFFmpeg((progress) => {
      win?.webContents.send('binary-progress', { name: 'ffmpeg', progress })
    })
    return true
  })

  ipcMain.handle('delete-binaries', async () => {
    await binaryManager.deleteBinaries()
    return true
  })

  ipcMain.handle('get-metadata', async (_event, url) => {
    return await downloader.getMetadata(url)
  })

  ipcMain.handle('start-download', async (_event, options) => {
    const downloadOptions = {
      ...options,
      outputDir: options.outputDir || store.get('downloadDir') || app.getPath('downloads'),
      win: win!
    }
    const result = (await downloader.download(downloadOptions)) as any
    if (result.success && result.filePath) {
      const videoUrls = (store.get('videoUrls') || {}) as Record<string, string>
      videoUrls[result.filePath] = options.url
      store.set('videoUrls', videoUrls)
    }
    return result
  })

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    })
    if (!result.canceled) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('get-store-value', (_event, key) => {
    try {
      const value = store.get(key)
      logger.info(`Get store value: ${key} = ${value}`)
      return value
    } catch (e) {
      logger.error(`Failed to get store value for ${key}`, e)
      return null
    }
  })
  
  ipcMain.handle('set-store-value', (_event, key, value) => {
    try {
      logger.info(`Set store value: ${key} = ${value}`)
      store.set(key, value)
      win?.webContents.send('settings-changed', { key, value })
    } catch (e) {
      logger.error(`Failed to set store value for ${key}`, e)
    }
  })
  
  ipcMain.handle('check-for-updates', (_event, manual = false) => {
    if (!app.isPackaged) {
      win?.webContents.send('update-error', { message: 'Update check is only available in the packaged application.' })
      return
    }
    
    // @ts-ignore
    autoUpdater._isManualCheck = manual
    autoUpdater.checkForUpdatesAndNotify()
  })

  ipcMain.handle('restart-and-update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('log-error', (_event, message, error) => logger.error(message, error))
  ipcMain.handle('check-video-exists', (_event, title, format, audioLang) => downloader.checkFileExists(title, store.get('downloadDir') as string, format, audioLang))
  ipcMain.handle('get-suggested-filename', (_event, title, format, audioLang) => downloader.getSuggestedFilename(title, format, audioLang))
  ipcMain.handle('open-external', (_event, url) => shell.openExternal(url))
  ipcMain.handle('open-file', (_event, filePath) => shell.openPath(filePath))
  ipcMain.handle('open-folder', (_event, filePath) => shell.showItemInFolder(filePath))
  
  ipcMain.handle('delete-video', async (_event, filePath) => {
    try {
      await fs.unlink(filePath)
      const videoUrls = (store.get('videoUrls') || {}) as Record<string, string>
      if (videoUrls[filePath]) {
        delete videoUrls[filePath]
        store.set('videoUrls', videoUrls)
      }
      return true
    } catch (e) {
      logger.error('Failed to delete video', e)
      throw e
    }
  })

  ipcMain.handle('list-videos', async (_event, dirPath) => {
    try {
      let folder = dirPath || store.get('downloadDir') as string || app.getPath('downloads')
      
      try {
        await fs.access(folder)
      } catch (e) {
        folder = app.getPath('downloads')
        try {
          await fs.access(folder)
        } catch (e2) {
          return []
        }
      }
      
      const files = await fs.readdir(folder)
      const videoExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov']
      const audioExtensions = ['.m4a', '.mp3', '.wav', '.flac', '.ogg']
      
      const videoPromises = files.map(async (file) => {
        const ext = path.extname(file).toLowerCase()
        const isVideo = videoExtensions.includes(ext)
        const isAudio = audioExtensions.includes(ext)

        if (isVideo || isAudio) {
          const fullPath = path.join(folder, file)
          const stats = await fs.stat(fullPath)
          
          const [thumb, metadata] = await Promise.all([
            thumbnailManager.getThumbnail(fullPath),
            thumbnailManager.getVideoMetadata(fullPath)
          ])

          return {
            name: file,
            path: fullPath,
            size: stats.size,
            mtime: stats.mtime,
            btime: stats.birthtime,
            thumbnail: thumb ? `thumb://${thumb}` : null,
            duration: metadata?.duration || 0,
            url: metadata?.url || (store.get('videoUrls') as any)?.[fullPath] || null,
            type: isVideo ? 'video' : 'audio'
          }
        }
        return null
      })

      const videos = (await Promise.all(videoPromises)).filter((v): v is any => v !== null)
      
      return videos.sort((a, b) => {
        const timeA = a.btime ? a.btime.getTime() : a.mtime.getTime()
        const timeB = b.btime ? b.btime.getTime() : b.mtime.getTime()
        return timeB - timeA
      })
    } catch (e) {
      logger.error('Failed to list videos', e)
      throw e
    }
  })
}

// Auto-updater events
function registerUpdaterEvents() {
  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update...')
  })
  
  autoUpdater.on('update-available', (info) => {
    logger.info(`Update available: ${JSON.stringify(info)}`)
    win?.webContents.send('update-available', info)
  })
  
  autoUpdater.on('update-not-available', (info) => {
    logger.info(`Update not available: ${JSON.stringify(info)}`)
    // @ts-ignore
    const isManual = autoUpdater._isManualCheck
    // @ts-ignore
    autoUpdater._isManualCheck = false
    
    win?.webContents.send('update-not-available', { ...info, manual: isManual })
  })
  
  autoUpdater.on('error', (err) => {
    logger.error('Error in auto-updater:', err)
    win?.webContents.send('update-error', err)
  })
  
  autoUpdater.on('download-progress', (progressObj) => {
    win?.webContents.send('update-download-progress', progressObj)
  })
  
  autoUpdater.on('update-downloaded', (info) => {
    logger.info(`Update downloaded: ${JSON.stringify(info)}`)
    win?.webContents.send('update-downloaded', info)
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: true,
    },
  })

  win.setMenu(null)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
  
  win.on('closed', () => {
    win = null
  })
}

// Register thumb protocol
app.whenReady().then(() => {
  protocol.handle('thumb', async (request) => {
    try {
      const url = new URL(request.url)
      const encodedPath = request.url.replace(`${url.protocol}//`, '')
      let filePath = decodeURIComponent(encodedPath)
      
      if (process.platform === 'win32') {
        if (filePath.startsWith('/')) {
          filePath = filePath.substring(1)
        }
        filePath = path.normalize(filePath)
      } else {
        if (!filePath.startsWith('/')) {
          filePath = '/' + filePath
        }
      }
      
      const data = await fs.readFile(filePath)
      return new Response(data, {
        headers: { 'Content-Type': 'image/jpeg' }
      })
    } catch (e) {
      console.error('Failed to serve thumbnail:', e)
      return new Response(null, { status: 404 })
    }
  })

  registerIpcHandlers()
  registerUpdaterEvents()
  createWindow()

  // Start checking for updates if packaged and enabled
  if (app.isPackaged) {
    const autoCheckUpdates = store.get('checkUpdateOnStartup')
    logger.info(`Production startup: autoUpdateCheck=${autoCheckUpdates} (type: ${typeof autoCheckUpdates})`)
    
    if (autoCheckUpdates === true) {
      logger.info('Auto-update check is enabled, starting check...')
      autoUpdater.checkForUpdatesAndNotify()
    } else {
      logger.info('Auto-update check is disabled by user setting.')
    }
  } else {
    logger.info('Not packaged, skipping auto-update check.')
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
