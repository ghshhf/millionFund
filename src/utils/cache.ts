// [WHY] 内存缓存工具 - 用于临时存储 API 响应数据
// [WHAT] 提供 get/set 方法，支持过期时间

interface CacheItem<T> {
  data: T
  expires: number
}

const cacheStorage = new Map<string, CacheItem<any>>()

export function getCache<T>(key: string): T | undefined {
  const item = cacheStorage.get(key)
  if (!item) return undefined
  if (Date.now() > item.expires) {
    cacheStorage.delete(key)
    return undefined
  }
  return item.data
}

export function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  cacheStorage.set(key, {
    data,
    expires: Date.now() + ttlSeconds * 1000,
  })
}

export function clearCache(): void {
  cacheStorage.clear()
}

export function removeCache(key: string): void {
  cacheStorage.delete(key)
}
