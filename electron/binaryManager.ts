import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import axios from 'axios'
import { chmodSync } from 'node:fs'
import AdmZip from 'adm-zip'

export class BinaryManager {
  private binPath: string

  constructor() {
    this.binPath = path.join(app.getPath('userData'), 'bin')
    if (!fs.existsSync(this.binPath)) {
      fs.mkdirSync(this.binPath, { recursive: true })
    }
  }

  getYTIDlpPath(): string {
    const fileName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
    return path.join(this.binPath, fileName)
  }

  getFFmpegPath(): string {
    const fileName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    return path.join(this.binPath, fileName)
  }

  getFFprobePath(): string {
    const fileName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
    return path.join(this.binPath, fileName)
  }

  async checkBinaries(): Promise<{ ytDlp: boolean; ffmpeg: boolean; ffprobe: boolean }> {
    return {
      ytDlp: fs.existsSync(this.getYTIDlpPath()),
      ffmpeg: fs.existsSync(this.getFFmpegPath()),
      ffprobe: fs.existsSync(this.getFFprobePath()),
    }
  }

  async downloadYTIDlp(onProgress?: (progress: number) => void): Promise<void> {
    const platform = process.platform
    let url = ''

    if (platform === 'win32') {
      url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    } else if (platform === 'darwin') {
      url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
    } else {
      url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
    }

    await this.downloadFile(url, this.getYTIDlpPath(), onProgress)
    
    if (platform !== 'win32') {
      chmodSync(this.getYTIDlpPath(), 0o755)
    }
  }

  async downloadFFmpeg(onProgress?: (progress: number) => void): Promise<void> {
    const platform = process.platform
    const arch = process.arch
    let url = ''

    if (platform === 'win32') {
      url = arch === 'arm64'
        ? 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-arm64.zip'
        : 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip'
    } else if (platform === 'darwin') {
      url = arch === 'arm64'
        ? 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-osx-64.zip' // ffbinaries might not have arm64 specifically but x64 works via Rosetta
        : 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-osx-64.zip'
    } else {
      url = arch === 'arm64'
        ? 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-arm-64.zip'
        : 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-64.zip'
    }

    const zipPath = path.join(this.binPath, 'ffmpeg.zip')
    await this.downloadFile(url, zipPath, (progress) => {
      if (onProgress) onProgress(Math.round(progress / 2))
    })
    
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(this.binPath, true)
    
    // Remove zip after extraction
    fs.unlinkSync(zipPath)

    // Download ffprobe as well
    let ffprobeUrl = url.replace('ffmpeg', 'ffprobe')
    const probeZipPath = path.join(this.binPath, 'ffprobe.zip')
    await this.downloadFile(ffprobeUrl, probeZipPath, (progress) => {
      if (onProgress) onProgress(Math.round(50 + progress / 2))
    })
    const probeZip = new AdmZip(probeZipPath)
    probeZip.extractAllTo(this.binPath, true)
    fs.unlinkSync(probeZipPath)

    if (platform !== 'win32') {
      chmodSync(this.getFFmpegPath(), 0o755)
      chmodSync(this.getFFprobePath(), 0o755)
    }
  }

  async deleteBinaries(): Promise<void> {
    if (fs.existsSync(this.binPath)) {
      fs.rmSync(this.binPath, { recursive: true, force: true })
      fs.mkdirSync(this.binPath, { recursive: true })
    }
  }

  private async downloadFile(url: string, dest: string, onProgress?: (progress: number) => void): Promise<void> {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
    })

    const contentLength = response.headers['content-length']
    const totalLength = contentLength ? parseInt(contentLength.toString(), 10) : 0
    let downloadedLength = 0

    const writer = fs.createWriteStream(dest)

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        downloadedLength += chunk.length
        if (onProgress && totalLength) {
          onProgress(Math.round((downloadedLength / totalLength) * 100))
        }
      })

      response.data.pipe(writer)
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
  }
}

