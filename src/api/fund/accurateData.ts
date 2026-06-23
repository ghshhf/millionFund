// [WHY] 基金综合数据 API
// [WHAT] 多源验证后的准确数据，智能选择净值或估值

import { unifiedCache, CACHE_KEYS, UNIFIED_CACHE_TTL } from '../unifiedCache'
import { fetchFundEstimateFast, fetchLatestNetValue, fetchFundBasicInfo } from './estimate'
import { fetchNetValueHistoryFast } from './netValue'
import { isTradingTime } from '../tiantianApi'
import { logger } from '@/utils/logger'

/**
 * 基金综合数据（多源验证）
 */
export interface FundAccurateData {
  code: string
  name: string
  // 公布净值（基金公司官方）
  nav: number
  navDate: string
  navChange: number
  // 估算净值（交易时间内参考）
  estimate: number
  estimateTime: string
  estimateChange: number
  // 推荐使用值（自动选择最准确的）
  currentValue: number
  dayChange: number
  // 数据源状态
  dataSource: 'nav' | 'estimate' | 'fallback'
  updateTime: string
}

/**
 * 获取基金准确数据（多源验证）
 * [WHAT] 同时从估值和净值接口获取，交叉验证
 */
export async function fetchFundAccurateData(
  code: string,
  isQDII: boolean = false
): Promise<FundAccurateData> {
  const cacheKey = `${CACHE_KEYS.ACCURATE_DATA}_${code}`
  
  // [WHAT] QDII 基金不使用缓存（交易时间不同）
  if (!isQDII) {
    const cached = unifiedCache.get<FundAccurateData>(cacheKey)
    if (cached) return cached
  }

  // [WHAT] 获取估值数据和历史净值数据
  const [estimateData, historyResult] = await Promise.all([
    fetchFundEstimateFast(code).catch(() => null),
    fetchNetValueHistoryFast(code, 2).catch(() => ({ records: [], fundName: '' }))
  ])

  const now = new Date()
  const today = now.toISOString().split('T')[0]!
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  // [WHAT] 判断是否在交易时间
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5
  const isTradingHours = (currentHour === 9 && currentMinute >= 30) ||
    (currentHour > 9 && currentHour < 11) ||
    (currentHour === 11 && currentMinute <= 30) ||
    (currentHour >= 13 && currentHour < 15)
  const inTradingTime = isWeekday && isTradingHours

  // [WHAT] 从历史净值中提取最新净值
  const historyData = historyResult.records || []
  const latestNav = historyData.length > 0 ? historyData[0] : null
  const navData = latestNav ? {
    netValue: latestNav.netValue,
    date: latestNav.date,
    changeRate: latestNav.changeRate
  } : null

  // [WHAT] 构建结果
  const result: FundAccurateData = {
    code,
    name: estimateData?.name || historyResult.fundName || '',
    nav: navData?.netValue || 0,
    navDate: navData?.date || '',
    navChange: navData?.changeRate || 0,
    estimate: parseFloat(estimateData?.gsz || '0') || 0,
    estimateTime: estimateData?.gztime || '',
    estimateChange: parseFloat(estimateData?.gszzl || '0') || 0,
    currentValue: 0,
    dayChange: 0,
    dataSource: 'fallback',
    updateTime: now.toISOString()
  }

  // [WHAT] 智能选择最准确的数据
  const isNavFromToday = navData?.date === today
  const isEstimateFromToday = estimateData?.gztime?.startsWith(today.replace(/-/g, '-'))

  // [WHAT] QDII 基金特殊处理
  if (isQDII) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const isNavFromYesterday = navData?.date === yesterday

    if (isNavFromYesterday && result.nav > 0) {
      result.currentValue = result.nav
      result.dayChange = result.navChange
      result.dataSource = 'nav'
    } else if (isNavFromToday && result.nav > 0) {
      result.currentValue = result.nav
      result.dayChange = result.navChange
      result.dataSource = 'nav'
    } else if (result.estimate > 0 && isEstimateFromToday) {
      result.currentValue = result.estimate
      result.dayChange = result.estimateChange
      result.dataSource = 'estimate'
    } else if (result.estimate > 0) {
      result.currentValue = result.estimate
      result.dayChange = result.estimateChange
      result.dataSource = 'estimate'
    } else {
      const dwjz = parseFloat(estimateData?.dwjz || '0')
      if (dwjz > 0) {
        result.currentValue = dwjz
        result.dayChange = 0
        result.dataSource = 'fallback'
      }
    }
  } else {
    // [WHAT] 非 QDII 基金正常处理
    if (isNavFromToday && result.nav > 0) {
      result.currentValue = result.nav
      result.dayChange = result.navChange
      result.dataSource = 'nav'
    } else if (inTradingTime && result.estimate > 0) {
      result.currentValue = result.estimate
      result.dayChange = result.estimateChange
      result.dataSource = 'estimate'
    } else if (result.estimate > 0 && isEstimateFromToday) {
      result.currentValue = result.estimate
      result.dayChange = result.estimateChange
      result.dataSource = 'estimate'
    } else if (result.nav > 0) {
      result.currentValue = result.nav
      result.dayChange = result.navChange
      result.dataSource = 'nav'
    } else if (result.estimate > 0) {
      result.currentValue = result.estimate
      result.dayChange = result.estimateChange
      result.dataSource = 'estimate'
    } else {
      const dwjz = parseFloat(estimateData?.dwjz || '0')
      if (dwjz > 0) {
        result.currentValue = dwjz
        result.dayChange = 0
        result.dataSource = 'fallback'
      }
    }
  }

  // [WHAT] 缓存（交易时间内短缓存，非交易时间长缓存）
  const ttl = isQDII ? 10000 : (inTradingTime ? 30000 : 300000)
  unifiedCache.set(cacheKey, result, {
    memoryTTL: ttl,
    persist: !isQDII
  })

  return result
}

/**
 * 批量获取准确数据
 */
export async function fetchFundAccurateBatch(codes: string[]): Promise<Map<string, FundAccurateData>> {
  const results = new Map<string, FundAccurateData>()

  await Promise.all(codes.map(async code => {
    try {
      const data = await fetchFundAccurateData(code)
      results.set(code, data)
    } catch (err) {
      logger.error('[accurateData] 批量获取准确数据失败', { code, error: err })
    }
  }))

  return results
}