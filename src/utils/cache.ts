// [WHY] 内存缓存工具 - 适配层，统一使用 api/cache
// [WHAT] 提供 get/set 方法，委托到 api/cache 单例，保持接口兼容

import { cache } from '@/api/cache'

export function getCache<T>(key: string): T | undefined {
  return cache.get<T>(key) ?? undefined
}

export function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  // [NOTE] api/cache 使用毫秒为单位，这里做转换
  cache.set(key, data, ttlSeconds * 1000)
}

export function clearCache(): void {
  cache.clear()
}

export function removeCache(key: string): void {
  cache.delete(key)
}
