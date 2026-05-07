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
      '--add-metadata'
    ]

    // Construct format string with language priority if specified
    let formatStr = format
    if (audioLang && audioLang !== 'default') {
      if (format === 'best' || format === 'bestvideo+bestaudio') {
        formatStr = `bestvideo+bestaudio[language=${audioLang}]/bestvideo+bestaudio/best`
      } else if (format === 'mp4') {
        formatStr = `bestvideo[ext=mp4]+bestaudio[ext=m4a][language=${audioLang}]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`
      } else if (format === 'bestaudio') {
        formatStr = `bestaudio[language=${audioLang}]/bestaudio/best`
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
      const line = data.toString()
      const match = line.match(/\[download\]\s+(\d+\.\d+)%/)
      if (match) {
        const progress = parseFloat(match[1])
        win.webContents.send('download-progress', { url, progress })
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
