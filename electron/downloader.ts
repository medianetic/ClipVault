import { spawn } from 'node:child_process'
import { app } from 'electron'
import fs from 'node:fs/promises'
import Store from 'electron-store'
import type { BrowserWindow } from 'electron'
import type { BinaryManager } from './binaryManager'

export class Downloader {
  constructor(private binaryManager: BinaryManager) {}

  async getMetadata(url: string) {
    return new Promise((resolve, reject) => {
      const ytDlpPath = this.binaryManager.getYTIDlpPath()
      const process = spawn(ytDlpPath, ['--dump-json', '--flat-playlist', url])
      
      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout))
          } catch (e) {
            reject(new Error('Failed to parse metadata'))
          }
        } else {
          reject(new Error(stderr || `yt-dlp exited with code ${code}`))
        }
      })
    })
  }

  async download(options: {
    url: string,
    title?: string,
    format: string,
    outputDir: string,
    subtitles?: boolean,
    subtitleLang?: string,
    win: BrowserWindow
  }) {
    const { url, title, format, outputDir, subtitles, subtitleLang, win } = options
    const ytDlpPath = this.binaryManager.getYTIDlpPath()
    const ffmpegPath = this.binaryManager.getFFmpegPath()

    let displayTitle = title
    if (!displayTitle) {
      try {
        const metadata = await this.getMetadata(url) as any
        displayTitle = metadata.title || 'video'
      } catch (e) {
        displayTitle = 'video'
      }
    }

    let sanitizedTitle = this.sanitizeFilename(displayTitle!)
    if (format === 'bestaudio') {
      sanitizedTitle += '-audio-only'
    }
    const outputTemplate = `${outputDir}/${sanitizedTitle}.%(ext)s`

    const args = [
      '--ffmpeg-location', ffmpegPath,
      '--output', outputTemplate,
      '--progress',
      '--newline'
    ]

    if (format !== 'best') {
      if (format === 'bestaudio') {
        args.push('--extract-audio', '--audio-format', 'mp3')
      } else {
        args.unshift('--format', format)
      }
    }

    if (subtitles) {
      args.push('--write-subs')
      if (subtitleLang) {
        args.push('--sub-langs', subtitleLang)
      }
    }

    args.push(url)

    // Capture the final filename
    let finalPath = ''
    try {
      const getFilenameArgs = [
        '--output', outputTemplate,
        '--get-filename',
        url
      ]
      if (format !== 'best') {
        if (format === 'bestaudio') {
          getFilenameArgs.push('--extract-audio', '--audio-format', 'mp3')
        } else {
          getFilenameArgs.unshift('--format', format)
        }
      }
      
      const getFilenameProcess = spawn(ytDlpPath, getFilenameArgs)
      
      let filenameOutput = ''
      getFilenameProcess.stdout.on('data', (data) => {
        filenameOutput += data.toString()
      })

      await new Promise((resolve) => {
        getFilenameProcess.on('close', () => {
          finalPath = filenameOutput.trim()
          resolve(true)
        })
      })
    } catch (e) {
      console.error('Failed to get filename:', e)
    }

    const downloadProcess = spawn(ytDlpPath, args)
    let stderr = ''

    downloadProcess.stdout.on('data', (data) => {
      const line = data.toString()
      // Parse progress from yt-dlp output
      // Example: [download]  10.0% of 100.00MiB at 10.00MiB/s ETA 00:10
      const match = line.match(/\[download\]\s+(\d+\.\d+)%/)
      if (match) {
        const progress = parseFloat(match[1])
        win.webContents.send('download-progress', { url, progress })
      }
    })

    downloadProcess.stderr.on('data', (data) => {
      stderr += data.toString()
      console.error(`yt-dlp stderr: ${data}`)
    })

    return new Promise((resolve, reject) => {
      downloadProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, filePath: finalPath })
        } else {
          reject(new Error(`Download failed with code ${code}: ${stderr}`))
        }
      })
    })
  }

  private sanitizeFilename(text: string): string {
    // Map common German characters and others to ASCII equivalents
    const map: Record<string, string> = {
      'ä': 'ae', 'ö': 'oe', 'ü': 'ue',
      'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue',
      'ß': 'ss', '&': 'and'
    };
    
    let sanitized = text;
    for (const [key, value] of Object.entries(map)) {
      sanitized = sanitized.replace(new RegExp(key, 'g'), value);
    }

    return sanitized
      .normalize('NFD') // Decompose combined characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-zA-Z0-9]/g, '_') // Replace non-alphanumeric with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores
  }

  async checkFileExists(title: string, outputDir: string, format?: string): Promise<boolean> {
    try {
      let sanitizedTitle = this.sanitizeFilename(title)
      if (format === 'bestaudio') {
        sanitizedTitle += '-audio-only'
      }
      const folder = outputDir || (new Store()).get('downloadDir') as string || app.getPath('downloads')
      const files = await fs.readdir(folder)
      // Check if any file starts with the sanitized title (ignoring extension for simplicity/safety)
      return files.some(f => f.startsWith(sanitizedTitle + '.'))
    } catch (e) {
      return false
    }
  }
}
