import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

export class Logger {
  private logPath: string

  constructor() {
    this.logPath = path.join(app.getPath('userData'), 'error.log')
  }

  error(message: string, error?: any) {
    const timestamp = new Date().toISOString()
    let logMessage = `[${timestamp}] ERROR: ${message}\n`
    
    if (error) {
      if (error instanceof Error) {
        logMessage += `Stack: ${error.stack}\n`
      } else {
        logMessage += `Details: ${JSON.stringify(error)}\n`
      }
    }
    
    logMessage += '--------------------------------------------------\n'

    console.error(message, error)
    
    try {
      fs.appendFileSync(this.logPath, logMessage)
    } catch (e) {
      console.error('Failed to write to log file:', e)
    }
  }

  info(message: string) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] INFO: ${message}\n`
    
    console.log(message)
    
    try {
      fs.appendFileSync(this.logPath, logMessage)
    } catch (e) {
      console.error('Failed to write to log file:', e)
    }
  }
}

export const logger = new Logger()
