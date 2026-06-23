// [WHY] 基金历史净值 API
// [WHAT] 获取历史净值、K线数据、阶段涨幅

import { unifiedCache, CACHE_KEYS, UNIFIED_CACHE_TTL } from '../unifiedCache'
import { fetchPingzhongData, parseJsVariable } from './request'
import { http } from '@/utils/http'
import { logger } from '@/utils/logger'
import type { NetValueRecord } from '@/types/fund'

/**
 * 获取历史净值（使用 pingzhongdata 接口）
 * [WHAT] HTTP 请求替代 queueGlobalVarScript
 */
export async function fetchNetValueHistoryFast(
  code: string,
  days = 30
): Promise<{ records: NetValueRecord[], fundName: string }> {
  const cacheKey = `${CACHE_KEYS.NET_VALUE}_${code}_${days}`
  const cached = unifiedCache.get<{ records: NetValueRecord[], fundName: string }>(cacheKey)
  if (cached) return cached

  const result = await fetchPingzhongData(
    code,
    ['Data_netWorthTrend', 'fS_name'],
    (vars) => {
      const trend = vars['Data_netWorthTrend'] || []
      const fundName = vars['fS_name'] || ''
      
      if (trend.length === 0) {
        return { records: [] as NetValueRecord[], fundName }
      }

      const recentData = trend.slice(-days)
      const records: NetValueRecord[] = recentData.map((item: any) => {
        const date = new Date(item.x)
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        return {
          date: dateStr,
          netValue: item.y || 0,
          totalValue: item.y || 0,
          changeRate: item.equityReturn || 0
        }
      })
      records.reverse()
      return { records, fundName }
    },
    { records: [], fundName: '' }
  )

  unifiedCache.set(cacheKey, result, {
    memoryTTL: UNIFIED_CACHE_TTL.NET_VALUE_HISTORY,
    persist: true
  })
  
  return result
}

/**
 * 获取简化 K 线数据
 */
export interface SimpleKLineData {
  time: string
  value: number
  change: number
  volume?: number
}

export async function fetchSimpleKLineData(
  code: string,
  days = 60
): Promise<SimpleKLineData[]> {
  const cacheKey = `${CACHE_KEYS.KLINE}_${code}_${days}`
  const cached = unifiedCache.get<SimpleKLineData[]>(cacheKey)
  if (cached) return cached

  const historyResult = await fetchNetValueHistoryFast(code, days)
  const history = historyResult.records || []

  // [WHAT] 转换为 K 线格式（按时间正序）
  const klineData = history
    .map(item => ({
      time: item.date,
      value: item.netValue,
      change: item.changeRate
    }))
    .reverse()

  unifiedCache.set(cacheKey, klineData, {
    memoryTTL: UNIFIED_CACHE_TTL.NET_VALUE_HISTORY,
    persist: true
  })
  
  return klineData
}

/**
 * 计算阶段涨幅
 */
export interface PeriodReturn {
  period: string
  label: string
  days: number
  change: number
}

export async function calculatePeriodReturns(code: string): Promise<PeriodReturn[]> {
  const cacheKey = `${CACHE_KEYS.PERIOD}_${code}`
  const cached = unifiedCache.get<PeriodReturn[]>(cacheKey)
  if (cached) return cached

  // [WHAT] 获取足够长的历史数据
  const historyResult = await fetchNetValueHistoryFast(code, 400)
  const history = historyResult.records || []
  if (history.length < 2) return []

  const latest = history[0]

  // [EDGE] 如果最新净值为 0 或无效，跳过计算
  if (!latest || latest.netValue <= 0) {
    return []
  }

  const results: PeriodReturn[] = []

  const periods = [
    { period: 'Z', label: '近1周', days: 7 },
    { period: 'Y', label: '近1月', days: 30 },
    { period: '3Y', label: '近3月', days: 90 },
    { period: '6Y', label: '近6月', days: 180 },
    { period: '1N', label: '近1年', days: 365 },
  ]

  for (const p of periods) {
    // [WHAT] 找到对应日期的净值
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - p.days)

    // [WHAT] 找最接近的历史记录
    let found: NetValueRecord | null = null
    for (const record of history) {
      const recordDate = new Date(record.date)
      if (recordDate <= targetDate) {
        found = record
        break
      }
    }

    if (found && found.netValue > 0) {
      const change = ((latest.netValue - found.netValue) / found.netValue) * 100
      results.push({
        period: p.period,
        label: p.label,
        days: p.days,
        change: parseFloat(change.toFixed(2))
      })
    }
  }

  unifiedCache.set(cacheKey, results, {
    memoryTTL: UNIFIED_CACHE_TTL.NET_VALUE_HISTORY,
    persist: true
  })
  
  return results
}

/**
 * 获取沪深 300 指数历史数据
 */
export async function fetchHS300History(days = 90): Promise<NetValueRecord[]> {
  const cacheKey = `hs300_history_${days}`
  const cached = unifiedCache.get<NetValueRecord[]>(cacheKey)
  if (cached) return cached

  const hs300Code = '510300'

  const records = await fetchPingzhongData(
    hs300Code,
    ['Data_netWorthTrend'],
    (vars) => {
      const trend = vars['Data_netWorthTrend'] || []
      if (trend.length === 0) return []

      const recentData = trend.slice(-days)
      const result: NetValueRecord[] = recentData.map((item: any) => {
        const date = new Date(item.x)
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        return {
          date: dateStr,
          netValue: item.y || 0,
          totalValue: item.y || 0,
          changeRate: item.equityReturn || 0
        }
      })
      result.reverse()
      return result
    },
    []
  )

  unifiedCache.set(cacheKey, records, {
    memoryTTL: UNIFIED_CACHE_TTL.NET_VALUE_HISTORY,
    persist: true
  })
  
  return records
}