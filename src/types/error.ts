// [WHY] 统一 API 错误类型定义
// [WHAT] 所有 API 失败时抛出一致的 ApiError 类型，便于统一处理和用户提示

/**
 * API 错误码枚举
 */
export type ApiErrorCode =
  | 'TIMEOUT'           // 请求超时
  | 'NETWORK'           // 网络异常
  | 'PARSE'             // 数据解析失败
  | 'INVALID_DATA'      // 返回数据无效
  | 'NOT_FOUND'         // 基金不存在
  | 'RATE_LIMIT'        // 请求频率限制
  | 'SERVER_ERROR'      // 服务端错误
  | 'CORS'              // 跨域限制
  | 'SCRIPT_INJECT'     // 脚本注入失败（JSONP）
  | 'UNKNOWN'           // 未知错误

/**
 * API 错误接口
 * [WHAT] 继承 Error，增加 API 专用字段
 */
export interface ApiError extends Error {
  /** 错误码 */
  code: ApiErrorCode
  /** 请求的 API 端点 */
  endpoint: string
  /** 相关基金代码（可选） */
  fundCode?: string
  /** 是否可恢复（如使用缓存） */
  recoverable: boolean
  /** 降级数据（可选） */
  fallbackData?: unknown
  /** 错误发生时间 */
  timestamp: number
  /** 用户友好提示 */
  userMessage: string
}

/**
 * 创建 API 错误的工厂函数
 */
export function createApiError(
  code: ApiErrorCode,
  message: string,
  options: {
    endpoint?: string
    fundCode?: string
    recoverable?: boolean
    fallbackData?: unknown
    userMessage?: string
    originalError?: unknown
  } = {}
): ApiError {
  const error = new Error(message) as ApiError
  error.code = code
  error.endpoint = options.endpoint || ''
  error.fundCode = options.fundCode
  error.recoverable = options.recoverable ?? true
  error.fallbackData = options.fallbackData
  error.timestamp = Date.now()
  error.userMessage = options.userMessage ?? getDefaultUserMessage(code)
  if (options.originalError) {
    error.cause = options.originalError
  }
  return error
}

/**
 * 根据错误码获取默认用户提示
 */
function getDefaultUserMessage(code: ApiErrorCode): string {
  switch (code) {
    case 'TIMEOUT':
      return '请求超时，正在使用缓存数据'
    case 'NETWORK':
      return '网络连接异常，请检查网络'
    case 'PARSE':
      return '数据解析失败'
    case 'INVALID_DATA':
      return '数据格式异常'
    case 'NOT_FOUND':
      return '未找到该基金'
    case 'RATE_LIMIT':
      return '请求过于频繁，请稍后重试'
    case 'SERVER_ERROR':
      return '服务暂时不可用'
    case 'CORS':
      return '跨域请求受限'
    case 'SCRIPT_INJECT':
      return '数据加载失败'
    default:
      return '操作失败，请重试'
  }
}

/**
 * 判断是否为 ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'code' in error && 'endpoint' in error
}

/**
 * 从原始错误推断 ApiErrorCode
 */
export function inferErrorCode(error: unknown): ApiErrorCode {
  if (error instanceof DOMException) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return 'TIMEOUT'
    }
  }
  if (error instanceof TypeError) {
    if (String(error).includes('fetch') || String(error).includes('network')) {
      return 'NETWORK'
    }
    if (String(error).includes('JSON') || String(error).includes('parse')) {
      return 'PARSE'
    }
  }
  if (error instanceof SyntaxError) {
    return 'PARSE'
  }
  return 'UNKNOWN'
}

/**
 * 错误上下文类型（兼容现有 errorHandler.ts）
 */
export type ErrorContext = 
  | 'api'       // API 请求失败
  | 'network'   // 网络异常
  | 'storage'   // 本地存储读写失败
  | 'parse'     // 数据解析失败
  | 'unknown'   // 未知错误

/**
 * 将 ApiErrorCode 映射到 ErrorContext
 */
export function mapCodeToContext(code: ApiErrorCode): ErrorContext {
  switch (code) {
    case 'TIMEOUT':
    case 'NETWORK':
    case 'CORS':
      return 'network'
    case 'PARSE':
    case 'INVALID_DATA':
    case 'SCRIPT_INJECT':
      return 'parse'
    case 'NOT_FOUND':
    case 'RATE_LIMIT':
    case 'SERVER_ERROR':
      return 'api'
    default:
      return 'unknown'
  }
}