// [WHY] 市场指数 API
// [WHAT] 获取大盘指数、全球指数、市场概览

import { unifiedCache, CACHE_KEYS, UNIFIED_CACHE_TTL } from '../unifiedCache'
import { http } from '@/utils/http'
import { isTradingTime } from '../tiantianApi'
import { logger } from '@/utils/logger'

/**
 * 大盘指数数据
 */
export interface MarketIndexSimple {
  code: string
  name: string
  current: number
  change: number
  changePercent: number
}

/**
 * 获取大盘指数
 * [WHAT] 上证指数、深证成指、创业板指、沪深300
 */
export async function fetchMarketIndicesFast(): Promise<MarketIndexSimple[]> {
  const cacheKey = CACHE_KEYS.MARKET_INDEX
  const cached = unifiedCache.get<MarketIndexSimple[]>(cacheKey)
  if (cached) return cached

  try {
    const url = `/api/qt/push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006,1.000300&fields=f2,f3,f4,f12,f14&_=${Date.now()}`
    const data = await http.get<{ data?: { diff?: any[] } }>(url)

    if (!data?.data?.diff) return getFallbackMarketIndices()

    const indices: MarketIndexSimple[] = data.data.diff.map((item: any) => ({
      code: item.f12,
      name: item.f14,
      current: item.f2,
      change: item.f4,
      changePercent: item.f3
    }))

    unifiedCache.setWithTradingTime(cacheKey, indices, {
      tradingTTL: UNIFIED_CACHE_TTL.TRADING_MARKET,
      nonTradingTTL: UNIFIED_CACHE_TTL.NON_TRADING_MARKET,
      persist: true
    })
    
    return indices
  } catch (e) {
    logger.warn('[market] 获取大盘指数失败', e)
    return getFallbackMarketIndices()
  }
}

/**
 * 大盘指数兜底数据
 */
function getFallbackMarketIndices(): MarketIndexSimple[] {
  return [
    { code: '000001', name: '上证指数', current: 3150, change: 12.5, changePercent: 0.40 },
    { code: '399001', name: '深证成指', current: 9850, change: 45.2, changePercent: 0.46 },
    { code: '399006', name: '创业板指', current: 2050, change: 8.6, changePercent: 0.42 },
    { code: '000300', name: '沪深300', current: 3780, change: 15.8, changePercent: 0.42 },
  ]
}

/**
 * 全球指数数据
 */
export interface GlobalIndex {
  name: string
  code: string
  price: number
  change: number
  changePercent: number
  region: 'cn' | 'hk' | 'us' | 'eu' | 'asia'
}

/**
 * 获取全球主要指数行情
 */
export async function fetchGlobalIndices(): Promise<GlobalIndex[]> {
  const cacheKey = CACHE_KEYS.GLOBAL_INDEX
  const cached = unifiedCache.get<GlobalIndex[]>(cacheKey)
  if (cached) return cached

  // [WHAT] 东方财富全球指数代码
  const indicesConfig = [
    { code: '1.000001', name: '上证指数', region: 'cn' as const },
    { code: '0.399001', name: '深证成指', region: 'cn' as const },
    { code: '0.399006', name: '创业板指', region: 'cn' as const },
    { code: '100.HSI', name: '恒生指数', region: 'hk' as const },
    { code: '101.DJI', name: '道琼斯', region: 'us' as const },
    { code: '101.NDX', name: '纳斯达克100', region: 'us' as const },
    { code: '101.SPX', name: '标普500', region: 'us' as const },
  ]

  try {
    const secids = indicesConfig.map(i => i.code).join(',')
    const url = `/api/qt/push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=${secids}&fields=f2,f3,f4,f12,f14&_=${Date.now()}`
    const data = await http.get<{ data?: { diff?: any[] } }>(url)

    if (!data?.data?.diff) return getFallbackGlobalIndices()

    const indices: GlobalIndex[] = data.data.diff.map((item: any) => {
      const config = indicesConfig.find(c => c.code === item.f12)
      return {
        code: item.f12,
        name: item.f14 || config?.name || '',
        price: item.f2 || 0,
        change: item.f4 || 0,
        changePercent: item.f3 || 0,
        region: config?.region || 'cn'
      }
    })

    unifiedCache.set(cacheKey, indices, {
      memoryTTL: UNIFIED_CACHE_TTL.NON_TRADING_MARKET,
      persist: true
    })
    
    return indices
  } catch (e) {
    logger.warn('[market] 获取全球指数失败', e)
    return getFallbackGlobalIndices()
  }
}

/**
 * 全球指数兜底数据
 */
function getFallbackGlobalIndices(): GlobalIndex[] {
  return [
    { name: '上证指数', code: '000001', price: 3150, change: 12.5, changePercent: 0.40, region: 'cn' },
    { name: '深证成指', code: '399001', price: 9850, change: 45.2, changePercent: 0.46, region: 'cn' },
    { name: '恒生指数', code: 'HSI', price: 18000, change: 100, changePercent: 0.56, region: 'hk' },
    { name: '道琼斯', code: 'DJI', price: 38000, change: 150, changePercent: 0.40, region: 'us' },
    { name: '纳斯达克100', code: 'NDX', price: 16000, change: 200, changePercent: 1.25, region: 'us' },
  ]
}

/**
 * 基金涨跌分布
 */
export interface FundDistribution {
  range: string
  count: number
  min: number
  max: number
}

export interface MarketOverview {
  updateTime: string
  totalUp: number
  totalDown: number
  distribution: FundDistribution[]
}

/**
 * 获取基金涨跌分布
 */
export async function fetchMarketOverview(): Promise<MarketOverview> {
  const cacheKey = CACHE_KEYS.MARKET_OVERVIEW

  const cached = unifiedCache.get<MarketOverview>(cacheKey)
  if (cached) return cached

  const persisted = unifiedCache.getPersistent<MarketOverview>(cacheKey)

  // [WHAT] 非交易时间使用持久化缓存
  if (!isTradingTime()) {
    if (persisted && (persisted.totalUp > 0 || persisted.totalDown > 0)) {
      unifiedCache.set(cacheKey, persisted, { memoryTTL: UNIFIED_CACHE_TTL.NON_TRADING_MARKET })
      return persisted
    }
  }

  const createRanges = (): FundDistribution[] => [
    { range: '≤-5', count: 0, min: -Infinity, max: -5 },
    { range: '-5~-3', count: 0, min: -5, max: -3 },
    { range: '-3~-1', count: 0, min: -3, max: -1 },
    { range: '-1~0', count: 0, min: -1, max: -0.001 },
    { range: '0~1', count: 0, min: -0.001, max: 1 },
    { range: '1~3', count: 0, min: 1, max: 3 },
    { range: '3~5', count: 0, min: 3, max: 5 },
    { range: '≥5', count: 0, min: 5, max: Infinity }
  ]

  const createEmptyData = (): MarketOverview => ({
    updateTime: '--',
    totalUp: 0,
    totalDown: 0,
    distribution: createRanges()
  })

  try {
    const url = `/api/qt/fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=zzf&st=desc&sd=2020-01-01&ed=${new Date().toISOString().slice(0,10)}&qdii=&tabSubtype=,,,,,&pi=1&pn=10000&dx=1&v=${Date.now()}`
    const text = await http.text(url, { timeout: 30000 })
    
    // [WHAT] 解析 rankData 全局变量
    const rankDataMatch = text.match(/var\s+rankData\s*=\s*(\{[\s\S]*?\});/)
    if (!rankDataMatch) return persisted || createEmptyData()
    
    const rankData = JSON.parse(rankDataMatch[1] || '{}')
    const ranges = createRanges()
    let totalUp = 0
    let totalDown = 0

    if (rankData?.datas && Array.isArray(rankData.datas)) {
      rankData.datas.forEach((row: string) => {
        const cols = row.split(',')
        let change = parseFloat(cols[6] ?? '0')
        if (isNaN(change) || cols[6] === '') {
          change = parseFloat(cols[4] ?? '0') || parseFloat(cols[5] ?? '0') || 0
        }
        if (change > 0) totalUp++
        else if (change < 0) totalDown++
        for (const r of ranges) {
          if (change > r.min && change <= r.max) {
            r.count++
            break
          }
        }
      })
    }

    if (totalUp > 0 || totalDown > 0) {
      const now = new Date()
      const result: MarketOverview = {
        updateTime: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        totalUp,
        totalDown,
        distribution: ranges
      }
      
      unifiedCache.set(cacheKey, result, {
        memoryTTL: UNIFIED_CACHE_TTL.NON_TRADING_MARKET,
        persist: true
      })
      
      return result
    }
    
    return persisted || createEmptyData()
  } catch (e) {
    logger.warn('[market] 获取市场概览失败', e)
    return persisted || createEmptyData()
  }
}