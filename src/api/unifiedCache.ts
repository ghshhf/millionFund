// [WHY] 统一缓存管理器 - 整合内存缓存和持久化缓存
// [WHAT] 提供单一接口，自动选择存储层，支持交易时间智能缓存
// [DEPS] 整合 api/cache.ts 和 utils/persistCache.ts

import { cache, CACHE_TTL } from './cache'
import { persistCache } from '@/utils/persistCache'
import { isTradingTime } from './tiantianApi'
import { logger } from '@/utils/logger'

/**
 * 统一缓存配置
 */
export interface UnifiedCacheOptions {
  /** 内存缓存 TTL（毫秒） */
  memoryTTL?: number
  /** 持久化缓存 TTL（毫秒），默认 24 小时 */
  persistTTL?: number
  /** 是否持久化到 localStorage */
  persist?: boolean
  /** 缓存键前缀 */
  prefix?: string
}

/**
 * 交易时间智能缓存配置
 */
export interface TradingTimeCacheOptions {
  /** 交易时间内的 TTL（毫秒） */
  tradingTTL: number
  /** 非交易时间的 TTL（毫秒） */
  nonTradingTTL: number
  /** 是否持久化 */
  persist?: boolean
}

/**
 * 统一缓存管理器
 * [WHAT] 自动选择存储层，提供智能缓存策略
 */
export const unifiedCache = {
  /**
   * 获取缓存数据
   * [HOW] 先检查内存缓存，再检查持久化缓存
   */
  get<T>(key: string, prefix = ''): T | null {
    const fullKey = prefix ? `${prefix}_${key}` : key
    
    // [WHAT] 优先检查内存缓存
    const memCached = cache.get<T>(fullKey)
    if (memCached !== null) {
      return memCached
    }
    
    // [WHAT] 检查持久化缓存
    const persistCached = persistCache.get<T>(fullKey)
    if (persistCached !== null) {
      // [WHAT] 回填到内存缓存（短期）
      cache.set(fullKey, persistCached, CACHE_TTL.ESTIMATE)
      return persistCached
    }
    
    return null
  },

  /**
   * 设置缓存数据
   * [HOW] 同时写入内存和持久化存储
   */
  set<T>(key: string, data: T, options: UnifiedCacheOptions = {}): void {
    const fullKey = options.prefix ? `${options.prefix}_${key}` : key
    const memoryTTL = options.memoryTTL ?? CACHE_TTL.ESTIMATE
    const persistTTL = options.persistTTL ?? 86400000 // 默认 24 小时
    
    // [WHAT] 写入内存缓存
    cache.set(fullKey, data, memoryTTL)
    
    // [WHAT] 可选：持久化到 localStorage
    if (options.persist !== false) {
      persistCache.set(fullKey, data, persistTTL)
    }
  },

  /**
   * 交易时间智能缓存
   * [HOW] 根据是否交易时间自动选择 TTL
   */
  setWithTradingTime<T>(
    key: string,
    data: T,
    options: TradingTimeCacheOptions
  ): void {
    const trading = isTradingTime()
    const ttl = trading ? options.tradingTTL : options.nonTradingTTL
    
    this.set(key, data, {
      memoryTTL: ttl,
      persist: options.persist ?? true,
      persistTTL: options.nonTradingTTL * 10 // 持久化缓存用更长的时间
    })
    
    logger.debug(`[unifiedCache] setWithTradingTime: ${key}`, {
      trading,
      ttl,
      persist: options.persist
    })
  },

  /**
   * 获取缓存（支持交易时间智能 TTL）
   * [HOW] 非交易时间优先使用持久化缓存
   */
  getWithTradingTime<T>(key: string, prefix = ''): T | null {
    const fullKey = prefix ? `${prefix}_${key}` : key
    
    // [WHAT] 交易时间：优先内存缓存
    if (isTradingTime()) {
      const memCached = cache.get<T>(fullKey)
      if (memCached !== null) {
        return memCached
      }
    }
    
    // [WHAT] 非交易时间或内存无数据：检查持久化缓存
    const persistCached = persistCache.get<T>(fullKey)
    if (persistCached !== null) {
      // [WHAT] 回填到内存缓存
      cache.set(fullKey, persistCached, CACHE_TTL.ESTIMATE)
      return persistCached
    }
    
    // [WHAT] 最后尝试内存缓存（可能已过期但数据仍存在）
    return cache.get<T>(fullKey)
  },

  /**
   * 删除缓存
   * [HOW] 同时清除内存和持久化存储
   */
  delete(key: string, prefix = ''): void {
    const fullKey = prefix ? `${prefix}_${key}` : key
    cache.delete(fullKey)
    persistCache.delete(fullKey)
  },

  /**
   * 清除所有缓存
   */
  clear(): void {
    cache.clear()
    persistCache.clear()
  },

  /**
   * 清除指定前缀的所有缓存
   */
  clearPrefix(prefix: string): void {
    // [WHAT] 清除内存缓存
    const memKeys = Array.from((cache as any).cache?.keys() || ([] as string[]))
    memKeys.forEach((k: string) => {
      if (k.startsWith(prefix)) {
        cache.delete(k)
      }
    })
    
    // [WHAT] 清除持久化缓存
    persistCache.clear()
  },

  /**
   * 检查缓存是否存在
   */
  has(key: string, prefix = ''): boolean {
    return this.get(key, prefix) !== null
  },

  /**
   * 获取或设置缓存（常用模式）
   * [HOW] 如果缓存不存在，调用 fetcher 获取数据并缓存
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: UnifiedCacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key, options.prefix)
    if (cached !== null) {
      return cached
    }
    
    const data = await fetcher()
    this.set(key, data, options)
    return data
  },

  /**
   * 获取或设置缓存（支持交易时间智能 TTL）
   */
  async getOrSetWithTradingTime<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: TradingTimeCacheOptions
  ): Promise<T> {
    const cached = this.getWithTradingTime<T>(key, options.persist ? '' : 'temp')
    if (cached !== null) {
      return cached
    }
    
    const data = await fetcher()
    this.setWithTradingTime(key, data, options)
    return data
  }
}

/**
 * 缓存键常量（统一管理）
 */
export const CACHE_KEYS = {
  // 估值相关
  ESTIMATE: 'estimate',
  NET_VALUE: 'netvalue',
  LATEST_NAV: 'latest_nav',
  ACCURATE_DATA: 'accurate',
  
  // 基金信息
  FUND_INFO: 'fund_info',
  FUND_LIST: 'fund_list',
  FUND_DETAIL: 'fund_detail',
  
  // 市场数据
  MARKET_INDEX: 'market_indices',
  GLOBAL_INDEX: 'global_indices',
  MARKET_OVERVIEW: 'market_overview_v2',
  
  // 持仓相关
  TOP_HOLDINGS: 'topholdings',
  HOLDING_CHANGE: 'holding_change',
  
  // 经理相关
  MANAGER: 'manager',
  MANAGER_PROFIT: 'manager_profit',
  
  // 其他
  INTRADAY: 'intraday',
  KLINE: 'kline',
  PERIOD: 'period',
  RANKING: 'ranking',
  DIVIDEND: 'dividend',
  FEES: 'fees',
  SCALE: 'scale',
  STYLE: 'style',
  SIMILAR: 'similar',
  NEWS: 'finance_news',
  HOT_THEMES: 'hot_themes',
  SECTOR_FUNDS: 'sector_funds',
  ETF_RANK: 'etf_rank',
  OTC_RANK: 'otc_rank',
} as const

/**
 * 缓存 TTL 常量（扩展版）
 */
export const UNIFIED_CACHE_TTL = {
  // 交易时间内
  TRADING_ESTIMATE: 15000,       // 15 秒（估值）
  TRADING_MARKET: 3000,          // 3 秒（大盘指数）
  TRADING_INTRADAY: 30000,       // 30 秒（分时数据）
  
  // 非交易时间
  NON_TRADING_ESTIMATE: 300000,  // 5 分钟
  NON_TRADING_MARKET: 300000,    // 5 分钟
  NON_TRADING_INTRADAY: 600000,  // 10 分钟
  
  // 长期缓存
  FUND_INFO: 3600000,            // 1 小时
  FUND_LIST: 86400000,           // 24 小时
  NET_VALUE_HISTORY: 3600000,    // 1 小时
  DIVIDEND: 86400000,            // 24 小时
  FEES: 86400000,                // 24 小时
  MANAGER: 3600000,              // 1 小时
} as const