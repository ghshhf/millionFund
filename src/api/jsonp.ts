// [WHY] 统一 JSONP 回调管理
// [WHAT] fund.ts 和 fundFast.ts 各自注册了 window.jsonpgz，后注册的覆盖先注册的
//        导致先注册那一方的请求永远得不到响应。本模块提供共享回调 + 多 handler 分发。
// [HOW] 两个 API 模块分别注册自己的 handler，window.jsonpgz 只注册一次，响应分发给所有 handler。

import { logger } from '@/utils/logger'

type JsonpHandler = (data: any) => void

const handlers = new Set<JsonpHandler>()
let initialized = false

/**
 * 注册 JSONP 响应处理器。
 * 每个 handler 在自己的 pending 队列中查找匹配的请求并 resolve。
 */
export function registerJsonpHandler(handler: JsonpHandler) {
  handlers.add(handler)
}

/**
 * 初始化全局 window.jsonpgz 回调（仅一次）
 */
export function initJsonpCallback() {
  if (initialized) return
  initialized = true

  ;(window as any).jsonpgz = (data: any) => {
    for (const handler of handlers) {
      try {
        handler(data)
      } catch (e) {
        logger.error('[jsonp] handler error', e)
      }
    }
  }
}

/**
 * [JSONP] 通用 JSONP 请求封装
 * [WHY] 封装 (window as any)[callbackName] 模式，减少全局变量污染和重复代码
 * [HOW] 生成唯一回调名 → 设置 window 回调 → 创建 script 标签 → 超时/成功后清理
 * 
 * @param url - JSONP 请求链接（不含 callback 参数）
 * @param callbackParam - URL 中的回调参数名，如 'callback'
 * @param callbackPrefix - 回调函数名前缀，如 'rankData'
 * @param timeoutMs - 超时时间（默认 15s）
 * @returns Promise<T> - 解析后的数据
 */
export function jsonpRequest<T = any>(
  url: string,
  callbackParam: string,
  callbackPrefix: string,
  timeoutMs = 15000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const callbackName = `${callbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const scriptId = `jsonp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    let cleanedUp = false

    function cleanup() {
      if (cleanedUp) return
      cleanedUp = true
      clearTimeout(timeoutId)
      try { delete (window as any)[callbackName] } catch { /* ignore */ }
      const el = document.getElementById(scriptId)
      if (el) el.remove()
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error(`[jsonp] timeout after ${timeoutMs}ms: ${url}`))
    }, timeoutMs)

    // 设置全局回调
    ;(window as any)[callbackName] = (data: T) => {
      cleanup()
      resolve(data)
    }

    // 创建 script 标签
    const sep = url.includes('?') ? '&' : '?'
    const fullUrl = `${url}${sep}${callbackParam}=${callbackName}&_=${Date.now()}`
    const script = document.createElement('script')
    script.id = scriptId
    script.src = fullUrl
    script.onerror = () => {
      cleanup()
      reject(new Error(`[jsonp] script load error: ${url}`))
    }
    document.body.appendChild(script)
  })
}
