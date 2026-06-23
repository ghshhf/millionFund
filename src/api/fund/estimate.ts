// [WHY] 基金实时估值 API
// [WHAT] 获取基金实时估值、批量估值、最新净值

import { unifiedCache, CACHE_KEYS, UNIFIED_CACHE_TTL } from '../unifiedCache'
import { persistCache } from '@/utils/persistCache'
import { isTradingTime } from '../tiantianApi'
import { fetchFundEstimateViaHttp, withConcurrencyControl } from './request'
import { http } from '@/utils/http'
import { logger } from '@/utils/logger'
import type { FundEstimate } from '@/types/fund'

/**
 * 清除指定基金的估值缓存
 */
export function clearFundEstimateCache(code: string): void {
  unifiedCache.delete(`${CACHE_KEYS.ESTIMATE}_${code}`)
  unifiedCache.delete(`${CACHE_KEYS.LATEST_NAV}_${code}`)
}

/**
 * 获取基金实时估值（带缓存）
 * [WHAT] 使用 HTTP 请求替代 JSONP script 注入
 */
export async function fetchFundEstimateFast(code: string): Promise<FundEstimate> {
  const cacheKey = `${CACHE_KEYS.ESTIMATE}_${code}`

  // [WHAT] 检查内存缓存
  const cached = unifiedCache.get<FundEstimate>(cacheKey)
  if (cached) return cached

  // [WHAT] 获取持久化缓存
  const persisted = persistCache.get<FundEstimate>(cacheKey)

  // [WHAT] 非交易时间直接返回持久化缓存
  if (!isTradingTime() && persisted) {
    unifiedCache.set(cacheKey, persisted, { memoryTTL: UNIFIED_CACHE_TTL.NON_TRADING_ESTIMATE })
    return persisted
  }

  return withConcurrencyControl(async () => {
    try {
      const data = await fetchFundEstimateViaHttp(code)
      
      if (data && data.fundcode) {
        // [WHAT] 缓存数据
        unifiedCache.setWithTradingTime(cacheKey, data, {
          tradingTTL: UNIFIED_CACHE_TTL.TRADING_ESTIMATE,
          nonTradingTTL: UNIFIED_CACHE_TTL.NON_TRADING_ESTIMATE,
          persist: true
        })
        return data
      }
      
      // [EDGE] 数据无效，使用持久化缓存
      if (persisted) {
        return persisted
      }
      
      throw new Error(`估值数据无效: ${code}`)
    } catch (e) {
      logger.error('[estimate] fetchFundEstimateFast failed', { code, error: e })
      
      // [EDGE] 请求失败，使用持久化缓存
      if (persisted) {
        return persisted
      }
      
      throw e
    }
  })
}

/**
 * 批量获取基金估值
 */
export async function fetchFundEstimatesBatch(codes: string[]): Promise<Map<string, FundEstimate>> {
  const results = new Map<string, FundEstimate>()

  const promises = codes.map(async code => {
    try {
      const data = await fetchFundEstimateFast(code)
      results.set(code, data)
    } catch (err) {
      logger.error('[estimate] 批量获取估值失败', { code, error: err })
    }
  })

  await Promise.all(promises)
  return results
}

/**
 * 获取基金最新公布净值（非估值）
 * [WHAT] 使用估值接口获取最新净值数据
 */
export async function fetchLatestNetValue(code: string): Promise<{
  netValue: number
  date: string
  changeRate: number
} | null> {
  const cacheKey = `${CACHE_KEYS.LATEST_NAV}_${code}`
  const cached = unifiedCache.get<{ netValue: number; date: string; changeRate: number }>(cacheKey)
  if (cached) return cached

  try {
    const data = await fetchFundEstimateViaHttp(code)
    
    if (!data) return null
    
    // [WHAT] 优先使用 dwjz（最新公布净值）
    const result = {
      netValue: parseFloat(data.dwjz || data.gsz || '0') || 0,
      date: data.gztime?.split(' ')[0] || '',
      changeRate: parseFloat(data.gszzl || '0') || 0
    }
    
    unifiedCache.set(cacheKey, result, {
      memoryTTL: UNIFIED_CACHE_TTL.TRADING_ESTIMATE,
      persist: true
    })
    
    return result
  } catch (e) {
    logger.error('[estimate] fetchLatestNetValue failed', { code, error: e })
    return null
  }
}

/**
 * 获取基金基本信息（备用方案）
 * [WHAT] 当天天基金 API 超时时，使用东方财富 API
 */
export async function fetchFundBasicInfo(code: string): Promise<{
  name: string
  netValue: number
  changeRate: number
  updateTime: string
} | null> {
  const cacheKey = `${CACHE_KEYS.FUND_INFO}_${code}`
  const cached = unifiedCache.get<{ name: string; netValue: number; changeRate: number; updateTime: string }>(cacheKey)
  if (cached) return cached

  try {
    const url = `/api/fundmobapi/FundMNewApi/FundMNFInfo?FCODE=${code}&deviceid=wap&plat=Wap&product=EFund&version=2.0.0&_=${Date.now()}`
    const text = await http.text(url, { timeout: 8000 })
    
    // [WHAT] 解析 JSONP 格式响应
    const jsonMatch = text.match(/\((\{[\s\S]*?\})\)/)
    if (!jsonMatch || !jsonMatch[1]) return null
    
    const json = JSON.parse(jsonMatch[1])
    
    if (!json?.Datas) return null
    
    const d = json.Datas
    const result = {
      name: d.SHORTNAME || d.FSHORTNAME || '',
      netValue: parseFloat(d.DWJZ) || 0,
      changeRate: parseFloat(d.RZDF) || 0,
      updateTime: d.FSRQ || ''
    }
    
    if (result.name) {
      unifiedCache.set(cacheKey, result, {
        memoryTTL: UNIFIED_CACHE_TTL.FUND_INFO,
        persist: true
      })
    }
    
    return result
  } catch (e) {
    logger.warn('[estimate] fetchFundBasicInfo failed', { code, error: e })
    return null
  }
}

// [WHAT] 兼容别名
export function fetchFundEstimate(code: string): Promise<FundEstimate> {
  return fetchFundEstimateFast(code)
}