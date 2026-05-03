import { app, BrowserWindow, ipcMain, dialog, shell, Menu, protocol } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Register custom protocols as privileged
protocol.registerSchemesAsPrivileged([
  { scheme: 'thumb', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
])
import path from 'node:path'
import fs from 'node:fs/promises'
import Store from 'electron-store'
import { BinaryManager } from './binaryManager'
import { Downloader } from './downloader'
import { ThumbnailManager } from './thumbnailManager'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const store = new Store()
const binaryManager = new BinaryManager()
const downloader = new Downloader(binaryManager)
const thumbnailManager = new ThumbnailManager(binaryManager)

// Global Exception Handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Register thumb protocol
app.whenReady().then(() => {
  protocol.handle('thumb', async (request) => {
    try {
      const encodedPath = request.url.replace('thumb://', '')
      let filePath = decodeURIComponent(encodedPath)
      
      // On Linux/macOS, ensure the path starts with / if it was lost
      if (process.platform !== 'win32' && !filePath.startsWith('/')) {
        filePath = '/' + filePath
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
})

// ... rest of env setup
process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

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

  // Hide the menu bar on Windows and Linux
  win.setMenu(null)

  // IPC Handlers
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
  
  ipcMain.handle('download-yt-dlp', async (_event) => {
    await binaryManager.downloadYTIDlp((progress) => {
      win?.webContents.send('binary-progress', { name: 'yt-dlp', progress })
    })
    return true
  })

  ipcMain.handle('download-ffmpeg', async (_event) => {
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
    return await downloader.download(downloadOptions)
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

  ipcMain.handle('get-store-value', (_event, key) => store.get(key))
  ipcMain.handle('set-store-value', (_event, key, value) => store.set(key, value))
  ipcMain.handle('check-video-exists', (_event, title, format) => downloader.checkFileExists(title, store.get('downloadDir') as string, format))
  ipcMain.handle('open-external', (_event, url) => shell.openExternal(url))
  ipcMain.handle('open-file', (_event, filePath) => shell.openPath(filePath))
  ipcMain.handle('open-folder', (_event, filePath) => shell.showItemInFolder(filePath))
  ipcMain.handle('delete-video', async (_event, filePath) => {
    try {
      await fs.unlink(filePath)
      return true
    } catch (e) {
      console.error('Failed to delete video:', e)
      throw e
    }
  })

  ipcMain.handle('list-videos', async (_event, dirPath) => {
    try {
      const folder = dirPath || store.get('downloadDir') || app.getPath('downloads')
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
            thumbnail: thumb ? `thumb://${thumb}` : null,
            duration: metadata?.duration || 0,
            type: isVideo ? 'video' : 'audio'
          }
        }
        return null
      })

      const videos = (await Promise.all(videoPromises)).filter((v): v is any => v !== null)
      
      // Sort by modified time descending
      return videos.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    } catch (e) {
      console.error('Failed to list videos:', e)
      throw e
    }
  })

  // ... rest of window logic
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
})
