// [WHY] 统一错误处理 - 避免各 API 函数中重复的 try/catch + toast 逻辑
// [WHAT] 提供统一的 API 错误、网络错误、存储错误处理

import { showToast } from 'vant'
import { logger } from './logger'
import {
  createApiError,
  isApiError,
  inferErrorCode,
  mapCodeToContext,
  type ApiError,
  type ApiErrorCode,
  type ErrorContext
} from '@/types/error'

// [WHAT] 兼容旧版 AppError 类型（实际使用 ApiError）
export type AppError = ApiError

// [WHAT] 创建标准错误对象（使用新的 ApiError 类型）
export function createAppError(
  message: string,
  context: ErrorContext,
  options: {
    recoverable?: boolean
    userMessage?: string
    originalError?: unknown
    endpoint?: string
    fundCode?: string
    fallbackData?: unknown
  } = {}
): AppError {
  // [WHAT] 将 ErrorContext 映射到 ApiErrorCode
  const code = contextToCode(context)
  return createApiError(code, message, {
    endpoint: options.endpoint,
    fundCode: options.fundCode,
    recoverable: options.recoverable ?? true,
    userMessage: options.userMessage ?? getDefaultUserMessage(context),
    fallbackData: options.fallbackData,
    originalError: options.originalError
  })
}

// [WHAT] ErrorContext 映射到 ApiErrorCode
function contextToCode(context: ErrorContext): ApiErrorCode {
  switch (context) {
    case 'api': return 'SERVER_ERROR'
    case 'network': return 'NETWORK'
    case 'storage': return 'UNKNOWN'
    case 'parse': return 'PARSE'
    default: return 'UNKNOWN'
  }
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
  // [WHAT] 优先使用 ApiError，否则创建新的
  let appError: AppError
  if (isApiError(error)) {
    appError = error
  } else if (error instanceof Error) {
    const code = inferErrorCode(error)
    appError = createApiError(code, error.message, {
      userMessage: getDefaultUserMessage(mapCodeToContext(code)),
      originalError: error
    })
  } else {
    appError = createAppError(String(error), context)
  }

  // 日志记录（含上下文）
  logger.error(`[${context}] ${appError.message}`, {
    error: appError.message,
    code: appError.code,
    endpoint: appError.endpoint,
    fundCode: appError.fundCode,
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
  options: {
    silent?: boolean
    fallback?: () => void
    fundCode?: string
  } = {}
): void {
  const context: ErrorContext = 'api'

  // [WHAT] 根据错误类型创建 ApiError
  let appError: AppError
  if (isApiError(error)) {
    appError = error
  } else if (error instanceof TypeError && String(error).includes('fetch')) {
    appError = createApiError('NETWORK', String(error), {
      endpoint,
      fundCode: options.fundCode,
      userMessage: '网络连接失败，请检查网络'
    })
  } else if (error instanceof DOMException && error.name === 'AbortError') {
    appError = createApiError('TIMEOUT', String(error), {
      endpoint,
      fundCode: options.fundCode,
      userMessage: '请求已取消'
    })
  } else if (error instanceof SyntaxError) {
    appError = createApiError('PARSE', String(error), {
      endpoint,
      fundCode: options.fundCode,
      userMessage: '数据解析失败'
    })
  } else if (error instanceof Error) {
    const code = inferErrorCode(error)
    appError = createApiError(code, error.message, {
      endpoint,
      fundCode: options.fundCode,
      originalError: error
    })
  } else {
    appError = createApiError('UNKNOWN', String(error), {
      endpoint,
      fundCode: options.fundCode
    })
  }

  handleError(appError, context, {
    ...options,
    logExtra: { endpoint, fundCode: options.fundCode },
  })
}

// [WHAT] View 层专用：统一处理 Promise 错误（日志 + Toast + 降级值）
//        页面内 catch 块里直接调，不用再写 showToast + logger.error 重复代码
export async function handleViewError<T>(
  promise: Promise<T>,
  options: {
    fallback?: T
    context?: ErrorContext
    endpoint?: string
    silent?: boolean
    customMessage?: string
  } = {}
): Promise<T | undefined> {
  try {
    return await promise
  } catch (error) {
    handleApiError(error, options.endpoint || 'view', {
      silent: options.silent,
    })
    return options.fallback
  }
}

// [WHAT] 导出新的 ApiError 相关函数供外部使用
export { createApiError, isApiError, inferErrorCode } from '@/types/error'
