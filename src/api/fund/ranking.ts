// [WHY] 基金排行榜 API
// [WHAT] 获取基金排行、ETF排行、场外基金排行

import { unifiedCache, CACHE_KEYS, UNIFIED_CACHE_TTL } from '../unifiedCache'
import { http } from '@/utils/http'
import { logger } from '@/utils/logger'

/**
 * 基金排行项
 */
export interface FundRankItemSimple {
  code: string
  name: string
  netValue: number
  dayChange: number
}

/**
 * 获取基金排行榜
 */
export async function fetchFundRankingFast(
  order: 1 | 0 = 1,
  pageSize = 30
): Promise<FundRankItemSimple[]> {
  const cacheKey = `${CACHE_KEYS.RANKING}_${order}_${pageSize}`
  const cached = unifiedCache.get<FundRankItemSimple[]>(cacheKey)
  if (cached) return cached

  try {
    const url = `/api/qt/push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pageSize}&po=${order}&np=1&fltt=2&invt=2&fid=f3&fs=b:MK0021&fields=f2,f3,f4,f12,f14&_=${Date.now()}`
    const data = await http.get<{ data?: { diff?: any[] } }>(url)

    if (!data?.data?.diff) return []

    const items: FundRankItemSimple[] = data.data.diff.map((item: any) => ({
      code: item.f12,
      name: item.f14,
      netValue: item.f2 || 0,
      dayChange: item.f3 || 0
    }))

    unifiedCache.set(cacheKey, items, { memoryTTL: 30000 })
    return items
  } catch (err) {
    logger.error('[ranking] 获取基金排行失败', err)
    return []
  }
}

/**
 * ETF 排行项
 */
export interface ETFItem {
  code: string
  name: string
  price: number
  dayReturn: number
}

/**
 * 获取场内 ETF 涨幅榜
 */
export async function fetchETFRank(pageSize = 10): Promise<ETFItem[]> {
  const cacheKey = `${CACHE_KEYS.ETF_RANK}_${pageSize}`
  const cached = unifiedCache.get<ETFItem[]>(cacheKey)
  if (cached) return cached

  try {
    const url = `/api/qt/push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=b:MK0021,b:MK0022&fields=f2,f3,f4,f12,f14&_=${Date.now()}`
    const data = await http.get<{ data?: { diff?: any[] } }>(url)

    if (!data?.data?.diff) return []

    const result: ETFItem[] = data.data.diff.map((item: any) => ({
      code: item.f12 || '',
      name: item.f14 || '',
      price: item.f2 || 0,
      dayReturn: item.f3 || 0
    }))

    unifiedCache.set(cacheKey, result, { memoryTTL: 60000 })
    return result
  } catch {
    return []
  }
}

/**
 * 场外基金排行项
 */
export interface OTCFundItem {
  code: string
  name: string
  netValue: number
  dayReturn: number
  updateStatus: string
}

/**
 * 获取场外基金涨幅榜
 */
export async function fetchOTCFundRank(order: 'desc' | 'asc' = 'desc', pageSize = 10): Promise<OTCFundItem[]> {
  const cacheKey = `${CACHE_KEYS.OTC_RANK}_${order}_${pageSize}`
  const cached = unifiedCache.get<OTCFundItem[]>(cacheKey)
  if (cached) return cached

  try {
    const st = order === 'desc' ? 'desc' : 'asc'
    const url = `/api/qt/fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=rzdf&st=${st}&pi=1&pn=${pageSize}&dx=1&v=${Date.now()}`
    const text = await http.text(url, { timeout: 10000 })
    
    // [WHAT] 解析 rankData
    const rankDataMatch = text.match(/var\s+rankData\s*=\s*(\{[\s\S]*?\});/)
    if (!rankDataMatch) return []
    
    const rankData = JSON.parse(rankDataMatch[1] || '{}')
    if (!rankData?.datas || !Array.isArray(rankData.datas)) return []
    
    const result: OTCFundItem[] = rankData.datas.slice(0, pageSize).map((row: string) => {
      const cols = row.split(',')
      return {
        code: cols[0] ?? '',
        name: cols[1] ?? '',
        netValue: parseFloat(cols[4] ?? '0') || 0,
        dayReturn: parseFloat(cols[6] ?? '0') || 0,
        updateStatus: '已更新'
      }
    })
    
    unifiedCache.set(cacheKey, result, { memoryTTL: 60000 })
    return result
  } catch (e) {
    logger.warn('[ranking] 获取场外基金排行失败', e)
    return []
  }
}

/**
 * 热门主题
 */
export interface HotTheme {
  code: string
  name: string
  dayReturn: number
  weekReturn: number
  monthReturn: number
  fundCount: number
}

/**
 * 获取热门主题板块
 */
export async function fetchHotThemes(): Promise<HotTheme[]> {
  const cacheKey = CACHE_KEYS.HOT_THEMES
  const cached = unifiedCache.get<HotTheme[]>(cacheKey)
  if (cached) return cached

  try {
    const url = `/api/qt/push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f12,f14&_=${Date.now()}`
    const data = await http.get<{ data?: { diff?: any[] } }>(url)

    if (!data?.data?.diff) return []

    const result: HotTheme[] = data.data.diff.map((item: any) => ({
      code: item.f12 || '',
      name: item.f14 || '',
      dayReturn: item.f3 || 0,
      weekReturn: 0,
      monthReturn: 0,
      fundCount: 0
    }))

    unifiedCache.set(cacheKey, result, { memoryTTL: UNIFIED_CACHE_TTL.NON_TRADING_MARKET })
    return result
  } catch {
    return []
  }
}