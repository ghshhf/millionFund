// [WHY] 基金经理 API
// [WHAT] 获取基金经理信息、任职业绩走势

import { unifiedCache, CACHE_KEYS, UNIFIED_CACHE_TTL } from '../unifiedCache'
import { fetchPingzhongData } from './request'
import { logger } from '@/utils/logger'

/**
 * 基金经理信息
 */
export interface FundManagerInfo {
  name: string
  photo: string
  workTime: string
  fundSize: string
  bestReturn: string
  experience: string
  funds: {
    code: string
    name: string
    type: string
    size: string
    returnRate: string
    startDate: string
  }[]
}

/**
 * 获取基金经理信息
 */
export async function fetchFundManagerInfo(fundCode: string): Promise<FundManagerInfo | null> {
  const cacheKey = `${CACHE_KEYS.MANAGER}_${fundCode}`
  const cached = unifiedCache.get<FundManagerInfo>(cacheKey)
  if (cached) return cached

  const manager = await fetchPingzhongData<FundManagerInfo | null>(
    fundCode,
    ['Data_currentFundManager'],
    (vars) => {
      const managerData = vars['Data_currentFundManager'] || []
      if (managerData.length === 0) return null

      const main = managerData[0]

      let bestReturn = '--'
      if (main.profit && typeof main.profit === 'object') {
        const val = main.profit.series?.[0]?.data?.[0]?.y
        if (val !== undefined && val !== null) bestReturn = `${val.toFixed(2)}%`
      }

      let experience = ''
      if (main.power?.categories && main.power?.data) {
        const abilities = main.power.categories.map((cat: string, i: number) =>
          `${cat}: ${main.power.data[i]?.toFixed?.(1) || main.power.data[i] || '--'}分`
        ).join('、')
        experience = `综合能力评分 ${main.power.avr || '--'}。${abilities}`
      }

      return {
        name: main.name || '未知',
        photo: main.pic || '',
        workTime: main.workTime || '--',
        fundSize: main.fundSize || '--',
        bestReturn,
        experience,
        funds: []
      }
    },
    null
  )

  if (manager) {
    unifiedCache.set(cacheKey, manager, {
      memoryTTL: UNIFIED_CACHE_TTL.MANAGER,
      persist: true
    })
  }
  
  return manager
}

/**
 * 经理业绩走势数据点
 */
export interface ManagerProfitPoint {
  date: string
  profit: number
}

/**
 * 获取经理任职期间业绩走势
 */
export async function fetchManagerProfit(fundCode: string): Promise<ManagerProfitPoint[]> {
  const cacheKey = `${CACHE_KEYS.MANAGER_PROFIT}_${fundCode}`
  const cached = unifiedCache.get<ManagerProfitPoint[]>(cacheKey)
  if (cached) return cached

  const result = await fetchPingzhongData<ManagerProfitPoint[]>(
    fundCode,
    ['Data_grandTotal'],
    (vars) => {
      const grandTotal = vars['Data_grandTotal'] || []
      if (!Array.isArray(grandTotal) || grandTotal.length === 0) return []

      const step = Math.max(1, Math.floor(grandTotal.length / 200))
      const points: ManagerProfitPoint[] = []

      for (let i = 0; i < grandTotal.length; i += step) {
        const item = grandTotal[i]
        if (Array.isArray(item) && item.length >= 2) {
          const date = new Date(item[0])
          points.push({
            date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
            profit: item[1] || 0
          })
        }
      }

      // [WHAT] 确保包含最后一个点
      const last = grandTotal[grandTotal.length - 1]
      const lastResult = points[points.length - 1]
      if (last && lastResult && lastResult.date !== new Date(last[0]).toISOString().split('T')[0]) {
        const date = new Date(last[0])
        points.push({
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          profit: last[1] || 0
        })
      }
      
      return points
    },
    []
  )

  unifiedCache.set(cacheKey, result, {
    memoryTTL: UNIFIED_CACHE_TTL.NET_VALUE_HISTORY,
    persist: true
  })
  
  return result
}