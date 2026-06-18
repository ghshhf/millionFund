// [WHY] 统一日志收集工具 - 便于排查用户反馈的运行问题
// [WHAT] 提供分级日志、环形缓冲、持久化、一键复制/导出
// [USAGE] import { logger } from '@/utils/logger'
//         logger.info('页面加载', { name: 'Home' })
//         logger.warn('请求失败', { code: 500 })
//         const text = logger.exportText()
//         await logger.copyToClipboard()

const STORAGE_KEY = 'app_logs_v1'
const MAX_LOGS = 500

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: string
  time: string
  level: LogLevel
  message: string
  data?: unknown
}

interface LoggerState {
  entries: LogEntry[]
  version: string
  device: string
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function formatTime(d: Date): string {
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function getDeviceInfo(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  return [
    navigator.platform || '?platform',
    navigator.userAgent.match(/Android|iPhone|iPad|Mac|Windows|Linux/)?.[0] || 'Web',
    `${screen?.width || 0}x${screen?.height || 0}`,
  ].join(' / ')
}

class Logger {
  private state: LoggerState
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    const pkg = (import.meta as any).env?.VITE_APP_VERSION || 'dev'
    this.state = {
      entries: [],
      version: pkg,
      device: getDeviceInfo(),
    }
    this.loadFromStorage()
    this.info('=== Logger init ===', {
      version: this.state.version,
      device: this.state.device,
    })
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as LoggerState
      if (parsed && Array.isArray(parsed.entries)) {
        this.state.entries = parsed.entries.slice(-MAX_LOGS)
      }
    } catch {
      // 解析失败则丢弃旧数据，避免污染
      this.state.entries = []
    }
  }

  private scheduleSave(): void {
    if (typeof localStorage === 'undefined') return
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      try {
        const data: LoggerState = {
          entries: this.state.entries,
          version: this.state.version,
          device: this.state.device,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        // localStorage 写入失败（如容量超限）时静默丢弃
      }
    }, 300)
  }

  private push(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      id: genId(),
      time: formatTime(new Date()),
      level,
      message,
      data: data === undefined ? undefined : this.safeClone(data),
    }
    this.state.entries.push(entry)
    if (this.state.entries.length > MAX_LOGS) {
      this.state.entries.splice(0, this.state.entries.length - MAX_LOGS)
    }
    // 同步输出到 console，方便开发者调试
    const consoleArgs = data === undefined ? [`[${level}] ${message}`] : [`[${level}] ${message}`, data]
    if (level === 'error') console.error(...consoleArgs)
    else if (level === 'warn') console.warn(...consoleArgs)
    else console.log(...consoleArgs)
    this.scheduleSave()
  }

  private safeClone<T>(input: T): T | string {
    try {
      // 尝试 JSON 序列化：过滤无法序列化的内容（如 Error / DOM / 循环引用）
      JSON.stringify(input)
      return input
    } catch {
      if (input instanceof Error) return `${input.name}: ${input.message}`
      return String(input)
    }
  }

  info(message: string, data?: unknown): void {
    this.push('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.push('warn', message, data)
  }

  error(message: string, data?: unknown): void {
    this.push('error', message, data)
  }

  debug(message: string, data?: unknown): void {
    this.push('debug', message, data)
  }

  getAll(): LogEntry[] {
    return this.state.entries.slice()
  }

  getVersion(): string {
    return this.state.version
  }

  clear(): void {
    this.state.entries = []
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
    this.info('=== Logs cleared ===')
  }

  exportText(): string {
    const lines: string[] = []
    lines.push('========== APP LOGS ==========')
    lines.push(`Version : ${this.state.version}`)
    lines.push(`Device  : ${this.state.device}`)
    lines.push(`Generated: ${formatTime(new Date())}`)
    lines.push(`Entries : ${this.state.entries.length}`)
    lines.push('')
    for (const e of this.state.entries) {
      const prefix = `[${e.time}] [${e.level.toUpperCase()}]`
      const main = `${prefix} ${e.message}`
      if (e.data === undefined) {
        lines.push(main)
      } else {
        let dataStr: string
        try {
          dataStr = typeof e.data === 'string' ? e.data : JSON.stringify(e.data)
        } catch {
          dataStr = String(e.data)
        }
        if (dataStr.length > 200) dataStr = dataStr.slice(0, 200) + '...(truncated)'
        lines.push(dataStr ? `${main} | ${dataStr}` : main)
      }
    }
    return lines.join('\n')
  }

  async copyToClipboard(): Promise<boolean> {
    const text = this.exportText()
    // Capacitor / 原生环境优先使用 Clipboard API；回退到 textarea
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      // 继续走回退方案
    }
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

// 单例
export const logger = new Logger()

// 便捷导出
export function getLogger(): Logger {
  return logger
}

export function copyLogsToClipboard(): Promise<boolean> {
  return logger.copyToClipboard()
}

export function exportLogsAsText(): string {
  return logger.exportText()
}
