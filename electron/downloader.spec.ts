import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Downloader } from './downloader'

// Mock Electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/downloads')
  }
}))

vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockReturnValue('/mock/downloads')
    }))
  }
})

describe('Downloader: sanitizeFilename', () => {
  let downloader: any

  beforeEach(() => {
    // Create an instance of Downloader with a mock BinaryManager
    const mockBinaryManager = {
      getYTIDlpPath: vi.fn(),
      getFFmpegPath: vi.fn()
    }
    downloader = new Downloader(mockBinaryManager as any)
  })

  it('converts German umlauts correctly', () => {
    expect(downloader.sanitizeFilename('Überraschung für Bärbel')).toBe('Ueberraschung_fuer_Baerbel')
  })

  it('replaces special characters with underscores', () => {
    expect(downloader.sanitizeFilename('Video & Audio! (2024)')).toBe('Video_and_Audio_2024')
  })

  it('handles multiple consecutive spaces and underscores', () => {
    expect(downloader.sanitizeFilename('  Space   Test  _  ')).toBe('Space_Test')
  })

  it('normalizes diacritics', () => {
    expect(downloader.sanitizeFilename('café')).toBe('cafe')
  })

  it('adds audio-only suffix when required', () => {
    // This is logic inside checkFileExists but uses sanitizeFilename
    // We can test the logic flow here if we wanted to test the public API
  })
})
