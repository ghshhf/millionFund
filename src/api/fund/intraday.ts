// [WHY] 基金分时数据 API
// [WHAT] 获取当日分时估值数据，用于绘制分时图

import { unifiedCache, CACHE_KEYS, UNIFIED_CACHE_TTL } from '../unifiedCache'
import { http } from '@/utils/http'
import { isTradingTime } from '../tiantianApi'
import { logger } from '@/utils/logger'

/**
 * 分时数据点
 */
export interface IntradayPoint {
  time: string
  value: number
  growth: number
}

/**
 * 获取基金当日分时估值数据
 * [WHAT] 使用腾讯财经接口
 */
export async function fetchIntradayData(
  code: string,
  forceRefresh = false
): Promise<IntradayPoint[] | null> {
  // [WHAT] 分时数据实时性要求高，交易时间不做缓存
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const isTrading = (hour === 9 && minute >= 30) ||
    (hour === 10) ||
    (hour === 11 && minute <= 30) ||
    (hour === 13) ||
    (hour === 14)

  const cacheKey = `${CACHE_KEYS.INTRADAY}_${code}`
  
  // [WHAT] 强制刷新或非交易时间检查缓存
  if (!forceRefresh && !isTrading) {
    const cached = unifiedCache.get<IntradayPoint[]>(cacheKey)
    if (cached) return cached
  }

  try {
    // [WHAT] 使用腾讯财经接口
    const url = `/api/qt/web.ifzq.gtimg.cn/fund/newfund/fundSsgz/getSsgz?app=web&symbol=jj${code}&_=${Date.now()}`
    const result = await http.get<{ code: number; data?: { data?: any[]; yesterdayDwjz?: string } }>(url)
    
    if (result.code === 0 && result.data && Array.isArray(result.data.data)) {
      const { data: list, yesterdayDwjz } = result.data
      const yDwjz = parseFloat(yesterdayDwjz || '0')
      if (!yDwjz) return null

      const points = list.map((item: any[]) => {
        const timeStr = item[0] as string
        const value = Number(item[1])
        const growth = ((value - yDwjz) / yDwjz * 100)

        return {
          time: `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`,
          value,
          growth: parseFloat(growth.toFixed(2))
        }
      })

      // [WHAT] 交易时间缓存 30 秒，非交易时间缓存 5 分钟
      unifiedCache.set(cacheKey, points, {
        memoryTTL: isTrading ? UNIFIED_CACHE_TTL.TRADING_INTRADAY : UNIFIED_CACHE_TTL.NON_TRADING_INTRADAY,
        persist: !isTrading
      })
      
      return points
    }
    
    return null
  } catch (e) {
    logger.error('[intraday] 获取分时数据失败', { code, error: e })
    return null
  }
}