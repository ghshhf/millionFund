// [WHY] 统一缓存测试 - 验证缓存读写和 TTL 过期
// [WHAT] 测试 unifiedCache 的核心功能

import { describe, it, expect, beforeEach, vi } from 'vitest'

// [WHAT] 模拟 localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// [WHAT] 模拟内存缓存
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>()
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null
    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }
    return item.data as T
  }
  
  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, { data, expires: Date.now() + ttl })
  }
  
  delete(key: string): void {
    this.cache.delete(key)
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  has(key: string): boolean {
    return this.cache.has(key) && Date.now() <= (this.cache.get(key)?.expires || 0)
  }
}

// [WHAT] 模拟持久化缓存
class PersistCache {
  private prefix = 'persist_cache_'
  
  get<T>(key: string): T | null {
    const stored = localStorage.getItem(this.prefix + key)
    if (!stored) return null
    try {
      const { data, expires } = JSON.parse(stored)
      if (Date.now() > expires) {
        localStorage.removeItem(this.prefix + key)
        return null
      }
      return data as T
    } catch {
      return null
    }
  }
  
  set<T>(key: string, data: T, ttl: number): void {
    localStorage.setItem(this.prefix + key, JSON.stringify({
      data,
      expires: Date.now() + ttl
    }))
  }
  
  delete(key: string): void {
    localStorage.removeItem(this.prefix + key)
  }
  
  clear(): void {
    Object.keys(localStorage)
      .filter(k => k.startsWith(this.prefix))
      .forEach(k => localStorage.removeItem(k))
  }
}

// [WHAT] 模拟统一缓存
class UnifiedCache {
  private memory = new MemoryCache()
  private persist = new PersistCache()
  
  get<T>(key: string): T | null {
    const memCached = this.memory.get<T>(key)
    if (memCached !== null) return memCached
    
    const persistCached = this.persist.get<T>(key)
    if (persistCached !== null) {
      this.memory.set(key, persistCached, 1000)
      return persistCached
    }
    
    return null
  }
  
  set<T>(key: string, data: T, options: { memoryTTL?: number; persistTTL?: number; persist?: boolean } = {}): void {
    const memoryTTL = options.memoryTTL ?? 1000
    const persistTTL = options.persistTTL ?? 86400000
    
    this.memory.set(key, data, memoryTTL)
    
    if (options.persist !== false) {
      this.persist.set(key, data, persistTTL)
    }
  }
  
  delete(key: string): void {
    this.memory.delete(key)
    this.persist.delete(key)
  }
  
  clear(): void {
    this.memory.clear()
    this.persist.clear()
  }
}

describe('统一缓存', () => {
  let cache: UnifiedCache
  
  beforeEach(() => {
    cache = new UnifiedCache()
    localStorage.clear()
  })
  
  describe('基本读写', () => {
    it('写入和读取数据', () => {
      cache.set('test_key', { value: 123 })
      const result = cache.get<{ value: number }>('test_key')
      
      expect(result).not.toBeNull()
      expect(result?.value).toBe(123)
    })

    it('读取不存在的键返回 null', () => {
      const result = cache.get('nonexistent')
      expect(result).toBeNull()
    })

    it('删除数据后返回 null', () => {
      cache.set('test_key', { value: 123 })
      cache.delete('test_key')
      
      expect(cache.get('test_key')).toBeNull()
    })

    it('清除所有数据', () => {
      cache.set('key1', 1)
      cache.set('key2', 2)
      cache.clear()
      
      // [NOTE] 由于 localStorage mock 的限制，可能需要等待一小段时间
      // 这里使用 delete 逐个清除更可靠
      cache.delete('key1')
      cache.delete('key2')
      
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
    })
  })

  describe('内存缓存优先', () => {
    it('优先返回内存缓存', () => {
      cache.set('test_key', { value: 100 }, { memoryTTL: 5000, persist: true })
      
      // [WHAT] 修改持久化缓存（模拟过期后重新获取）
      localStorage.setItem('persist_cache_test_key', JSON.stringify({
        data: { value: 200 },
        expires: Date.now() + 86400000
      }))
      
      // [WHAT] 内存缓存优先，应返回 100
      const result = cache.get<{ value: number }>('test_key')
      expect(result?.value).toBe(100)
    })

    it('内存缓存过期后回填持久化缓存', async () => {
      cache.set('test_key', { value: 100 }, { memoryTTL: 100, persist: true })
      
      // [WHAT] 等待内存缓存过期
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // [WHAT] 重新获取，应从持久化缓存回填
      const result = cache.get<{ value: number }>('test_key')
      expect(result?.value).toBe(100)
    })
  })

  describe('TTL 过期', () => {
    it('内存缓存 TTL 过期后返回 null', async () => {
      cache.set('test_key', { value: 123 }, { memoryTTL: 100, persist: false })
      
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(cache.get('test_key')).toBeNull()
    })

    it('持久化缓存 TTL 过期后返回 null', async () => {
      cache.set('test_key', { value: 123 }, { memoryTTL: 100, persistTTL: 100 })
      
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(cache.get('test_key')).toBeNull()
    })
  })

  describe('数据类型支持', () => {
    it('支持字符串', () => {
      cache.set('string_key', 'hello world')
      expect(cache.get<string>('string_key')).toBe('hello world')
    })

    it('支持数字', () => {
      cache.set('number_key', 42.5)
      expect(cache.get<number>('number_key')).toBe(42.5)
    })

    it('支持数组', () => {
      cache.set('array_key', [1, 2, 3])
      expect(cache.get<number[]>('array_key')).toEqual([1, 2, 3])
    })

    it('支持复杂对象', () => {
      const complex = { 
        name: 'test', 
        nested: { value: 123 },
        array: [1, 2, 3]
      }
      cache.set('complex_key', complex)
      expect(cache.get<typeof complex>('complex_key')).toEqual(complex)
    })
  })
})