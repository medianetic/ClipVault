import { spawn } from 'node:child_process'
import { app } from 'electron'
import fs from 'node:fs/promises'
import Store from 'electron-store'
import type { BrowserWindow } from 'electron'
import type { BinaryManager } from './binaryManager'
import { logger } from './logger'

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
            logger.error(`Failed to parse metadata for URL: ${url}`, e)
            reject(new Error('Failed to parse metadata'))
          }
          } else {
          logger.error(`yt-dlp metadata fetch failed for URL: ${url} with code ${code}`, { stderr })
          reject(new Error(stderr || `yt-dlp exited with code ${code}`))
        }
      })
    })
  }

  getSuggestedFilename(title: string, format?: string, audioLang?: string): string {
    const safeFilename = this.sanitizeFilename(title)
    let finalTitle = safeFilename
    if (format === 'bestaudio') {
      finalTitle += '_audio'
    }
    if (audioLang && audioLang !== 'default') {
      finalTitle += `_${audioLang}`
    }
    return finalTitle
  }

  async download(options: {
    url: string,
    title?: string,
    overrideTitle?: string,
    format: string,
    outputDir: string,
    audioLang?: string,
    win: BrowserWindow
  }) {
    const { url, title, overrideTitle, format, outputDir, audioLang, win } = options
    const ytDlpPath = this.binaryManager.getYTIDlpPath()
    const ffmpegPath = this.binaryManager.getFFmpegPath()

    let displayTitle = title
    if (!displayTitle && !overrideTitle) {
      try {
        const metadata = await this.getMetadata(url) as any
        displayTitle = metadata.title || 'video'
      } catch (e) {
        displayTitle = 'video'
      }
    }

    const finalTitle = overrideTitle || this.getSuggestedFilename(displayTitle!, format, audioLang)
    const outputTemplate = `${outputDir}/${finalTitle}.%(ext)s`

    const args = [
      '--ffmpeg-location', ffmpegPath,
      '--output', outputTemplate,
      '--progress',
      '--newline',
      '--add-metadata',
      '--no-mtime'
    ]

    // Construct format string with language priority if specified
    let formatStr = format
    if (audioLang && audioLang !== 'default') {
      const langs = [audioLang]
      if (audioLang !== 'en') {
        langs.push('en')
      }

      if (format === 'best' || format === 'bestvideo+bestaudio') {
        const priority = langs.map(l => `bestvideo+bestaudio[language^=${l}]/best[language^=${l}]`).join('/')
        formatStr = `${priority}/bestvideo+bestaudio/best`
      } else if (format === 'mp4') {
        const priority = langs.map(l => `bestvideo[ext=mp4]+bestaudio[ext=m4a][language^=${l}]/best[ext=mp4][language^=${l}]`).join('/')
        formatStr = `${priority}/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`
      } else if (format === 'bestaudio') {
        const priority = langs.map(l => `bestaudio[language^=${l}]/best[language^=${l}]`).join('/')
        formatStr = `${priority}/bestaudio/best`
      }
    }

    if (formatStr !== 'best') {
      if (format === 'bestaudio') {
        args.push('--format', formatStr, '--extract-audio', '--audio-format', 'mp3')
      } else {
        args.push('--format', formatStr)
      }
    }

    args.push(url)

    // Capture the final filename
    let finalPath = ''
    try {
      const getFilenameArgs = [
        '--output', outputTemplate,
        '--get-filename',
        '--format', formatStr,
        url
      ]
      
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
      logger.error('Failed to get filename', e)
    }

    const downloadProcess = spawn(ytDlpPath, args)
    let stderr = ''

    downloadProcess.stdout.on('data', (data) => {
      const output = data.toString()
      const lines = output.split(/[\r\n]+/)
      
      for (const line of lines) {
        if (!line.trim()) continue

        // 1. Match percentage: [download]  10.5% or [download] 100% or [download] ~10.5%
        const percentMatch = line.match(/\[download\]\s+~?([0-9.]+)%/)
        if (percentMatch) {
          const progress = parseFloat(percentMatch[1])
          win.webContents.send('download-progress', { url, progress })
          continue
        }

        // 2. Match fragments: [download] Fragment 10/100
        const fragMatch = line.match(/Fragment\s+(\d+)\/(\d+)/i)
        if (fragMatch) {
          const current = parseInt(fragMatch[1])
          const total = parseInt(fragMatch[2])
          if (total > 0) {
            const progress = (current / total) * 100
            win.webContents.send('download-progress', { url, progress })
          }
          continue
        }

        // 3. Match post-processing phases
        if (line.includes('[merger]') || line.includes('[ffmpeg]') || line.includes('[Fixup')) {
          win.webContents.send('download-progress', { url, progress: 100, status: 'processing' })
        }
      }
    })

    downloadProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    return new Promise((resolve, reject) => {
      downloadProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, filePath: finalPath })
        } else {
          logger.error(`yt-dlp download failed for URL: ${url} with code ${code}`, { stderr, args })
          reject(new Error(stderr || `yt-dlp exited with code ${code}`))
        }
      })

      downloadProcess.on('error', (err) => {
        logger.error('yt-dlp process error', err)
        reject(err)
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
      .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace EVERYTHING ELSE with underscore (added hyphen)
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores
  }

  async checkFileExists(title: string, outputDir: string, format?: string, audioLang?: string): Promise<boolean> {
    try {
      const finalTitle = this.getSuggestedFilename(title, format, audioLang)
      const folder = outputDir || (new Store()).get('downloadDir') as string || app.getPath('downloads')
      const files = await fs.readdir(folder)
      // Check if any file starts with the final title (ignoring extension for simplicity/safety)
      return files.some(f => f.startsWith(finalTitle + '.'))
    } catch (e) {
      logger.error(`Failed to check if file exists for title: ${title}, outputDir: ${outputDir}`, e)
      return false
    }
  }
}
