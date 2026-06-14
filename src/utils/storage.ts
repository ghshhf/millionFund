// [WHY] 封装 localStorage 操作，提供类型安全的数据持久化
// [WHAT] 自选列表、持仓数据等需要在 APP 重启后保留

import { APP_VERSION } from '@/config/version'
import { cache } from '@/api/cache'

const STORAGE_KEYS = {
  WATCHLIST: 'fund_watchlist',
  HOLDINGS: 'fund_holdings',
  APP_VERSION: 'app_version',
  FUND_NET_VALUES: 'fund_net_values',
  SOURCE_FILTER: 'source_filter',
  AI_TRACKING: 'ai-tracking-records',
  // [WHAT] 需要在版本更新时清除的缓存 key 前缀
  CACHE_PREFIXES: ['fund_', 'api_', 'market_', 'estimate_']
} as const

// ========== Schema 版本管理 ==========

// [WHY] 当数据结构发生变化时（如：给 HoldingRecord 新增字段）
//       需要对老用户保存的数据做迁移，避免读取到不完整的数据
// [WHAT] 每次需要数据迁移时，将 SCHEMA_VERSION +1 并新增一个迁移函数

const STORAGE_SCHEMA_VERSION = 1
const SCHEMA_META_KEY = 'storage_schema_meta'

interface SchemaMeta {
  version: number
  lastMigratedAt: number
}

/**
 * [WHAT] 迁移函数注册表：从 fromVersion 迁移到 fromVersion + 1
 *        每次需要迁移数据时，添加一个新的迁移函数
 *        版本号从 1 开始，每新增一个迁移函数就 +1
 */
type Migration = (data: Record<string, any>) => Record<string, any>

const migrations: Record<number, Migration> = {
  // 版本 1 → 2 的迁移（示例，留给未来使用）
  // 1: (data) => {
  //   // 示例：给所有持仓记录添加 createdAt 字段
  //   if (Array.isArray(data.holdings)) {
  //     data.holdings = data.holdings.map((h: any) => ({
  //       createdAt: Date.now(),
  //       ...h
  //     }))
  //   }
  //   return data
  // }
}

/**
 * [WHAT] 检查当前存储的 schema 版本，必要时执行迁移
 */
export function checkSchemaAndMigrate(): void {
  try {
    const rawMeta = localStorage.getItem(SCHEMA_META_KEY)
    const meta: SchemaMeta = rawMeta ? JSON.parse(rawMeta) : { version: 0, lastMigratedAt: 0 }

    if (meta.version >= STORAGE_SCHEMA_VERSION) return

    console.info(`[storage] Schema migration required: v${meta.version} → v${STORAGE_SCHEMA_VERSION}`)

    // 读取所有用户数据到内存
    const allData: Record<string, any> = {
      watchlist: getItem<any[]>(STORAGE_KEYS.WATCHLIST, []),
      holdings: getItem<any[]>(STORAGE_KEYS.HOLDINGS, []),
      aiTracking: getItem<any[]>(STORAGE_KEYS.AI_TRACKING, []),
      netValues: getItem<Record<string, number>>(STORAGE_KEYS.FUND_NET_VALUES, {}),
      sourceFilter: getItem<string>(STORAGE_KEYS.SOURCE_FILTER, '')
    }

    // 按顺序执行迁移（从 meta.version+1 一直到 STORAGE_SCHEMA_VERSION）
    let migratedData = allData
    for (let v = meta.version + 1; v <= STORAGE_SCHEMA_VERSION; v++) {
      if (migrations[v]) {
        migratedData = migrations[v](migratedData)
        console.info(`[storage] Applied migration v${v}`)
      }
    }

    // 确保数据有合理的默认值（对老数据做填充）
    migratedData.holdings = ensureHoldingDefaults(migratedData.holdings)
    migratedData.aiTracking = ensureAITrackingDefaults(migratedData.aiTracking)

    // 写回迁移后的数据
    setItem(STORAGE_KEYS.WATCHLIST, migratedData.watchlist)
    setItem(STORAGE_KEYS.HOLDINGS, migratedData.holdings)
    setItem(STORAGE_KEYS.AI_TRACKING, migratedData.aiTracking)
    setItem(STORAGE_KEYS.FUND_NET_VALUES, migratedData.netValues)
    setItem(STORAGE_KEYS.SOURCE_FILTER, migratedData.sourceFilter)

    // 更新 schema 元信息
    const newMeta: SchemaMeta = {
      version: STORAGE_SCHEMA_VERSION,
      lastMigratedAt: Date.now()
    }
    localStorage.setItem(SCHEMA_META_KEY, JSON.stringify(newMeta))
    console.info(`[storage] Schema migration complete: v${STORAGE_SCHEMA_VERSION}`)
  } catch (e) {
    console.warn('[storage] checkSchemaAndMigrate failed:', (e as Error)?.message)
  }
}

/**
 * [WHAT] 给持仓记录填充默认值，避免老版本数据缺少字段
 */
function ensureHoldingDefaults(records: any[]): any[] {
  if (!Array.isArray(records)) return []

  return records.map((h) => ({
    code: h.code || '',
    name: h.name || '',
    buyNetValue: h.buyNetValue ?? 0,
    shares: h.shares ?? 0,
    buyDate: h.buyDate || '',
    holdingDays: h.holdingDays ?? 0,
    // 下面这些是后来新增的，老数据可能缺失
    industrySectors: h.industrySectors ?? undefined,
    source: h.source ?? '其他',
    isQDII: h.isQDII ?? false,
    createdAt: h.createdAt ?? Date.now(),
    currentValue: h.currentValue ?? undefined,
    addedGain: h.addedGain ?? undefined,
    marketValue: h.marketValue ?? undefined,
    profit: h.profit ?? undefined
  }))
}

/**
 * [WHAT] 给 AI 追踪记录填充默认值
 */
function ensureAITrackingDefaults(records: any[]): any[] {
  if (!Array.isArray(records)) return []

  return records.map((r) => ({
    id: r.id || Date.now().toString(),
    sellCode: r.sellCode || '',
    sellName: r.sellName || '',
    sellNav: r.sellNav ?? 0,
    sellNavEstimated: r.sellNavEstimated ?? undefined,
    buyCode: r.buyCode || '',
    buyName: r.buyName || '',
    buyNav: r.buyNav ?? 0,
    buyNavEstimated: r.buyNavEstimated ?? undefined,
    date: r.date || '',
    createdAt: r.createdAt ?? Date.now()
  }))
}

/**
 * 检查版本并清除旧缓存
 * [WHY] APP 更新后需要清除旧缓存，确保使用最新数据
 * [WHAT] 比较存储的版本与当前版本，不同则清除 API 缓存
 */
export function checkVersionAndClearCache(): void {
  try {
    const storedVersion = localStorage.getItem(STORAGE_KEYS.APP_VERSION)

    if (storedVersion !== APP_VERSION) {
      cache.clear()

      // [WHAT] 清除 localStorage 中的 API 缓存（保留用户数据）
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && STORAGE_KEYS.CACHE_PREFIXES.some(prefix => key.startsWith(prefix))) {
          if (key !== STORAGE_KEYS.WATCHLIST && key !== STORAGE_KEYS.HOLDINGS) {
            keysToRemove.push(key)
          }
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))

      // [WHAT] 更新版本号
      localStorage.setItem(STORAGE_KEYS.APP_VERSION, APP_VERSION)
    }
  } catch (e) {
    console.warn('[storage] checkVersionAndClearCache failed:', (e as Error)?.message)
  }
}

/**
 * 通用存储读取函数
 * [WHY] 统一处理 JSON 解析和错误处理
 * [EDGE] 数据不存在或解析失败时返回默认值
 */
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

/**
 * 通用存储写入函数
 * [WHY] 存储满/禁用/序列化失败时不应让应用崩溃
 * [EDGE] QuotaExceededError / SecurityError / JSON 循环引用
 */
function setItem<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    const errorName = (e as Error)?.name || 'Error'
    console.warn(`[storage] setItem failed for key "${key}": ${errorName}`)
    return false
  }
}

// ========== 自选列表 ==========

/**
 * 获取自选基金代码列表
 */
export function getWatchlist(): string[] {
  return getItem<string[]>(STORAGE_KEYS.WATCHLIST, [])
}

/**
 * 保存自选基金代码列表
 */
export function saveWatchlist(codes: string[]): void {
  setItem(STORAGE_KEYS.WATCHLIST, codes)
}

/**
 * 添加基金到自选
 * [EDGE] 已存在则不重复添加
 */
export function addToWatchlist(code: string): void {
  const list = getWatchlist()
  if (!list.includes(code)) {
    list.unshift(code) // 新添加的排在前面
    saveWatchlist(list)
  }
}

/**
 * 从自选中移除基金
 */
export function removeFromWatchlist(code: string): void {
  const list = getWatchlist()
  const index = list.indexOf(code)
  if (index > -1) {
    list.splice(index, 1)
    saveWatchlist(list)
  }
}

/**
 * 检查基金是否在自选中
 */
export function isInWatchlist(code: string): boolean {
  return getWatchlist().includes(code)
}

// ========== 持仓数据 ==========

import type { HoldingRecord } from '@/types/fund'

/**
 * 获取持仓列表
 */
export function getHoldings(): HoldingRecord[] {
  return getItem<HoldingRecord[]>(STORAGE_KEYS.HOLDINGS, [])
}

/**
 * 保存持仓列表
 */
export function saveHoldings(holdings: HoldingRecord[]): void {
  setItem(STORAGE_KEYS.HOLDINGS, holdings)
}

/**
 * 添加或更新持仓
 * [WHAT] 如果已存在同代码持仓，则更新；否则新增
 */
export function upsertHolding(holding: HoldingRecord): void {
  const list = getHoldings()
  const index = list.findIndex((h) => h.code === holding.code)
  if (index > -1) {
    list[index] = holding
  } else {
    list.push(holding)
  }
  saveHoldings(list)
}

/**
 * 删除持仓
 */
export function removeHolding(code: string): void {
  const list = getHoldings()
  const filtered = list.filter((h) => h.code !== code)
  saveHoldings(filtered)
}

/**
 * 获取单个持仓
 */
export function getHolding(code: string): HoldingRecord | undefined {
  return getHoldings().find((h) => h.code === code)
}

// ========== 基金净值存储 ==========

/**
 * 获取基金净值映射
 */
export function getFundNetValues(): Record<string, number> {
  return getItem<Record<string, number>>(STORAGE_KEYS.FUND_NET_VALUES, {})
}

/**
 * 保存基金净值映射
 */
export function saveFundNetValues(netValues: Record<string, number>): void {
  setItem(STORAGE_KEYS.FUND_NET_VALUES, netValues)
}

/**
 * 保存来源筛选状态
 */
export function saveSourceFilter(filter: string): void {
  setItem(STORAGE_KEYS.SOURCE_FILTER, filter)
}

/**
 * 获取来源筛选状态
 */
export function getSourceFilter(): string {
  return getItem<string>(STORAGE_KEYS.SOURCE_FILTER, '')
}

/**
 * 更新单个基金净值
 */
export function updateFundNetValue(code: string, netValue: number): void {
  const netValues = getFundNetValues()
  netValues[code] = netValue
  saveFundNetValues(netValues)
}

/**
 * 获取单个基金净值
 */
export function getFundNetValue(code: string): number | undefined {
  return getFundNetValues()[code]
}

// ========== AI 调仓追踪 ==========

/**
 * [WHY] 原来的 aiTracking.ts 直接用裸 localStorage 调用，绕过了统一的存储模块
 *       导致数据格式不一致、错误处理不统一，也无法在数据迁移时统一处理
 * [WHAT] 通过 storage 模块统一管理 AI 追踪记录
 */
export function getAITrackingRecords<T>(): T[] {
  return getItem<T[]>(STORAGE_KEYS.AI_TRACKING, [])
}

export function saveAITrackingRecords<T>(records: T[]): void {
  setItem(STORAGE_KEYS.AI_TRACKING, records)
}
