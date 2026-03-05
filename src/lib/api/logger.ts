import { randomUUID } from 'crypto'

interface LogMeta {
  requestId?: string
  route?: string
  userId?: string
  durationMs?: number
  [key: string]: any
}

export class Logger {
  private static formatLog(level: string, message: string, meta: LogMeta = {}) {
    return JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: meta.requestId || randomUUID(),
      route: meta.route,
      userId: meta.userId,
      durationMs: meta.durationMs,
      ...Object.fromEntries(
        Object.entries(meta).filter(([key]) => !['requestId', 'route', 'userId', 'durationMs'].includes(key))
      )
    })
  }

  static info(message: string, meta: LogMeta = {}) {
    console.log(this.formatLog('info', message, meta))
  }

  static error(message: string, error: any, meta: LogMeta = {}) {
    console.error(this.formatLog('error', message, {
      ...meta,
      error: error instanceof Error ? error.stack || error.message : String(error)
    }))
  }
}
