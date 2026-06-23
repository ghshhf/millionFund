// [WHY] 基金配置/评级 API
// [WHAT] 行业配置、资产配置、基金评级（替代原 JSONP/queueGlobalVarScript 调用）
// [DEPS] HTTP 请求 + 正则解析 + unifiedCache

import { unifiedCache, CACHE_KEYS, UNIFIED_CACHE_TTL } from '../unifiedCache'
import { fetchPingzhongData } from './request'
import { handleApiError } from '@/utils/errorHandler'

/**
 * 行业配置项
 */
export interface IndustryAllocation {
  name: string
  ratio: number
  color?: string
}

/**
 * 资产配置
 */
export interface AssetAllocation {
  stock: number
  bond: number
  cash: number
  other: number
}

/**
 * 基金评级
 */
export interface FundRating {
  rating: number
  riskLevel?: string
  sharpeRatio?: number
  maxDrawdown?: number
  volatility?: number
  rankInSimilar?: string | number
}

/**
 * 获取基金行业配置
 * [WHAT] 通过 HTTP 请求 pingzhongdata 页面，正则解析行业分布数据
 */
export async function fetchIndustryAllocation(code: string): Promise<IndustryAllocation[]> {
  const cacheKey = `${CACHE_KEYS.HOLDING_CHANGE}_industry_${code}`
  const cached = unifiedCache.get<IndustryAllocation[]>(cacheKey)
  if (cached) return cached

  try {
    const result = await fetchPingzhongData(
      code,
      ['Data_fundIndustry'],
      (vars): IndustryAllocation[] => {
        const data = vars['Data_fundIndustry']
        if (!data) return []

        const items: IndustryAllocation[] = []

        // [WHAT] 兼容多种格式: [{ name, ratio }] / [{ title, percent }] / array
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            if (!item) return
            const name = String(item.name ?? item.title ?? item.hy ?? '').trim()
            const ratioRaw = item.ratio ?? item.percent ?? item.pct ?? item.szzbl
            const ratio = parseFloat(String(ratioRaw || '0')) || 0
            if (name && ratio > 0) items.push({ name, ratio })
          })
        } else if (typeof data === 'object' && data !== null) {
          // { series: [...] } 格式
          const series = (data as any).series ?? (data as any).data ?? (data as any).industries ?? []
          if (Array.isArray(series)) {
            series.forEach((item: any) => {
              const name = String(item?.name ?? item?.title ?? item?.hy ?? '').trim()
              const ratio = parseFloat(String(item?.ratio ?? item?.percent ?? item?.pct ?? item?.szzbl ?? item?.value ?? '0')) || 0
              if (name && ratio > 0) items.push({ name, ratio })
            })
          }
        }

        // [WHAT] 按比例排序（高到低）
        items.sort((a, b) => b.ratio - a.ratio)
        return items.slice(0, 10)
      },
      [] as IndustryAllocation[]
    )

    unifiedCache.set(cacheKey, result, {
      memoryTTL: UNIFIED_CACHE_TTL.FUND_INFO,
      persist: true
    })
    return result
  } catch (e) {
    handleApiError(e, `fetchIndustryAllocation(${code})`, { silent: true })
    return []
  }
}

/**
 * 获取基金资产配置
 * [WHAT] 股票/债券/现金/其他 的比例分布
 */
export async function fetchAssetAllocation(code: string): Promise<AssetAllocation | null> {
  const cacheKey = `${CACHE_KEYS.HOLDING_CHANGE}_asset_${code}`
  const cached = unifiedCache.get<AssetAllocation>(cacheKey)
  if (cached) return cached

  try {
    const result = await fetchPingzhongData(
      code,
      ['Data_assetAllocation'],
      (vars): AssetAllocation | null => {
        const data = vars['Data_assetAllocation']

        // [WHAT] 尝试多种可能的字段命名
        const extract = (obj: any, keys: string[]): number => {
          for (const k of keys) {
            if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
              const v = parseFloat(String(obj[k]))
              if (!isNaN(v)) return v
            }
          }
          return 0
        }

        if (Array.isArray(data) && data.length > 0) {
          const latest = data[0] || {}
          const stock = extract(latest, ['gp', 'stock', 'gupiao'])
          const bond = extract(latest, ['zq', 'bond', 'zhaiquan'])
          const cash = extract(latest, ['xj', 'cash', 'xianjin'])
          const other = extract(latest, ['qt', 'other', 'qita'])
          return { stock, bond, cash, other: other || 0 }
        } else if (typeof data === 'object' && data !== null) {
          const obj = data as any
          // 直接对象字段
          const stock = extract(obj, ['gp', 'stock', 'gupiao'])
          const bond = extract(obj, ['zq', 'bond', 'zhaiquan'])
          const cash = extract(obj, ['xj', 'cash', 'xianjin'])
          const other = extract(obj, ['qt', 'other', 'qita'])
          if (stock > 0 || bond > 0 || cash > 0) {
            return { stock, bond, cash, other: other || 0 }
          }
        }

        // [WHAT] 默认空配置（不抛错，不影响其他数据展示）
        return null
      },
      null as AssetAllocation | null
    )

    if (result) {
      unifiedCache.set(cacheKey, result, {
        memoryTTL: UNIFIED_CACHE_TTL.FUND_INFO,
        persist: true
      })
    }
    return result
  } catch (e) {
    handleApiError(e, `fetchAssetAllocation(${code})`, { silent: true })
    return null
  }
}

/**
 * 获取基金评级（晨星/济安金信评级）
 * [WHAT] 返回评级星级（1-5）和相关风险指标
 */
export async function fetchFundRating(code: string): Promise<FundRating | null> {
  const cacheKey = `${CACHE_KEYS.MANAGER}_rating_${code}`
  const cached = unifiedCache.get<FundRating>(cacheKey)
  if (cached) return cached

  try {
    const result = await fetchPingzhongData(
      code,
      ['Data_performanceEvaluation', 'Data_currentFundManager', 'Data_rateInSimilarPers', 'Data_rateInSimilarType'],
      (vars): FundRating | null => {
        // [WHAT] 从业绩评估中提取星级（0-100 的评分映射到 1-5 星）
        const perfEval = vars['Data_performanceEvaluation']

        let rating = 0
        let rankInSimilar: string | number = '--'
        let sharpeRatio: number | undefined
        let maxDrawdown: number | undefined
        let volatility: number | undefined
        let riskLevel: string | undefined

        if (perfEval && typeof perfEval === 'object') {
          const avr = parseFloat(String((perfEval as any).avr ?? (perfEval as any).rating ?? (perfEval as any).score ?? '0')) || 0
          rating = Math.min(5, Math.max(1, Math.round(avr / 20)))

          // [WHAT] 从评估数据中提取风险指标
          const jl = parseFloat(String((perfEval as any).jl ?? (perfEval as any).jianxin ?? '0')) || 0
          if (jl > 0) rating = Math.max(rating, Math.round(jl / 20))

          // 夏普
          const sp = parseFloat(String((perfEval as any).sharpe ?? (perfEval as any).sharpeRatio ?? '0')) || 0
          if (sp > 0) sharpeRatio = sp

          // 最大回撤
          const md = parseFloat(String((perfEval as any).maxDrawdown ?? (perfEval as any).maxdrawdown ?? '0')) || 0
          if (md !== 0) maxDrawdown = md

          // 波动率
          const vol = parseFloat(String((perfEval as any).volatility ?? (perfEval as any).vol ?? '0')) || 0
          if (vol > 0) volatility = vol
        }

        // [WHAT] 同类排名（Data_rateInSimilarPers/Data_rateInSimilarType）
        const ratePers = vars['Data_rateInSimilarPers']
        const rateType = vars['Data_rateInSimilarType']

        if (typeof ratePers === 'number' || (typeof ratePers === 'string' && ratePers !== '')) {
          rankInSimilar = ratePers
        } else if (Array.isArray(rateType) && rateType.length > 0) {
          const lastRate = rateType[rateType.length - 1]
          rankInSimilar = typeof lastRate === 'object' && lastRate !== null
            ? ((lastRate as any).rank ?? (lastRate as any).title ?? '--')
            : (lastRate ?? '--')
        } else if (Array.isArray(ratePers) && ratePers.length > 0) {
          const last = ratePers[ratePers.length - 1]
          rankInSimilar = typeof last === 'object' && last !== null
            ? ((last as any).rank ?? (last as any).title ?? '--')
            : (last ?? '--')
        }

        // [WHAT] 基金经理的风险等级/从业年限
        const manager = vars['Data_currentFundManager']
        if (manager && typeof manager === 'object' && manager !== null) {
          const m = manager as any
          const riskLevelRaw = m.riskLevel ?? m.risk ?? m.riskLevel ?? ''
          if (riskLevelRaw) riskLevel = String(riskLevelRaw)

          // 如果没评级但有基金经理从业数据，给个默认评级
          if (rating === 0) {
            const workTimeYears = parseFloat(String(m.workTime ?? m.years ?? '0')) || 0
            if (workTimeYears > 10) rating = 4
            else if (workTimeYears > 5) rating = 3
            else if (workTimeYears > 2) rating = 2
          }
        }

        // [WHAT] 至少给一个默认评级（不影响其他数据展示）
        if (rating === 0) rating = 3

        return {
          rating,
          riskLevel,
          sharpeRatio,
          maxDrawdown,
          volatility,
          rankInSimilar,
        }
      },
      null as FundRating | null
    )

    if (result) {
      unifiedCache.set(cacheKey, result, {
        memoryTTL: UNIFIED_CACHE_TTL.FUND_INFO,
        persist: true
      })
    }
    return result
  } catch (e) {
    handleApiError(e, `fetchFundRating(${code})`, { silent: true })
    return null
  }
}
