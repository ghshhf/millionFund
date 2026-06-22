// [WHY] 统一错误处理 - 避免各 API 函数中重复的 try/catch + toast 逻辑
// [WHAT] 提供统一的 API 错误、网络错误、存储错误处理

import { showToast } from 'vant'
import { logger } from './logger'

export type ErrorContext = 
  | 'api'       // API 请求失败
  | 'network'   // 网络异常
  | 'storage'   // 本地存储读写失败
  | 'parse'     // 数据解析失败
  | 'unknown'   // 未知错误

export interface AppError extends Error {
  context: ErrorContext
  recoverable: boolean  // 是否可自动恢复（如缓存降级）
  userMessage: string    // 展示给用户的提示
}

// [WHAT] 创建标准错误对象
export function createAppError(
  message: string,
  context: ErrorContext,
  options: {
    recoverable?: boolean
    userMessage?: string
    originalError?: unknown
  } = {}
): AppError {
  const error = new Error(message) as AppError
  error.context = context
  error.recoverable = options.recoverable ?? true
  error.userMessage = options.userMessage ?? getDefaultUserMessage(context)
  if (options.originalError) {
    error.cause = options.originalError
  }
  return error
}

// [WHAT] 默认用户提示
function getDefaultUserMessage(context: ErrorContext): string {
  switch (context) {
    case 'api': return '数据获取失败，将使用缓存'
    case 'network': return '网络连接异常，请检查网络'
    case 'storage': return '本地存储异常'
    case 'parse': return '数据解析失败'
    default: return '操作失败，请重试'
  }
}

// [WHAT] 统一错误处理函数 - 日志 + 用户提示
export function handleError(
  error: unknown,
  context: ErrorContext,
  options: {
    silent?: boolean      // 不展示 toast
    fallback?: () => void  // 降级处理
    logExtra?: Record<string, unknown>
  } = {}
): void {
  const appError = error instanceof Error 
    ? error as AppError 
    : createAppError(String(error), context)

  // 日志记录（含上下文）
  logger.error(`[${context}] ${appError.message}`, {
    error: appError.message,
    stack: appError.stack,
    ...options.logExtra,
  })

  // 用户提示（非静默模式）
  if (!options.silent) {
    showToast({
      message: appError.userMessage || getDefaultUserMessage(context),
      duration: 2000,
    })
  }

  // 降级处理
  if (options.fallback) {
    try {
      options.fallback()
    } catch (fallbackError) {
      logger.error('[errorHandler] 降级处理失败', fallbackError)
    }
  }
}

// [WHAT] 包装异步函数，自动捕获错误
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: ErrorContext,
  options: {
    silent?: boolean
    fallback?: () => T | Promise<T>
  } = {}
): Promise<T | undefined> {
  return fn().catch((error) => {
    handleError(error, context, {
      silent: options.silent,
      fallback: options.fallback as () => void,
    })
    return undefined
  })
}

// [WHAT] API 请求错误专用处理（含 HTTP 状态码判断）
export function handleApiError(
  error: unknown,
  endpoint: string,
  options: { silent?: boolean; fallback?: () => void } = {}
): void {
  const context: ErrorContext = 'api'
  let userMessage = getDefaultUserMessage('api')

  // 根据错误类型定制提示
  if (error instanceof TypeError && String(error).includes('fetch')) {
    userMessage = '网络连接失败，请检查网络'
  } else if (error instanceof DOMException && error.name === 'AbortError') {
    userMessage = '请求已取消'
  }

  handleError(error, context, {
    ...options,
    logExtra: { endpoint },
  })
}
