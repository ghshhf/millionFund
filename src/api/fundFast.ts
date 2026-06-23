// [WHY] 基金 API 统一入口
// [WHAT] 整合所有拆分后的模块，保持向后兼容
// [NOTE] 所有 API 函数从子模块导出，此文件仅作为统一入口

// ========== 估值相关 ==========
export {
  fetchFundEstimateFast,
  fetchFundEstimatesBatch,
  fetchLatestNetValue,
  fetchFundBasicInfo,
  fetchFundEstimate,
  clearFundEstimateCache
} from './fund/estimate'

// ========== 历史净值相关 ==========
export {
  fetchNetValueHistoryFast,
  fetchSimpleKLineData,
  calculatePeriodReturns,
  fetchHS300History,
  type SimpleKLineData,
  type PeriodReturn
} from './fund/netValue'

// ========== 综合数据 ==========
export {
  fetchFundAccurateData,
  fetchFundAccurateBatch,
  type FundAccurateData
} from './fund/accurateData'

// ========== 分时数据 ==========
export {
  fetchIntradayData,
  type IntradayPoint
} from './fund/intraday'

// ========== 重仓股 ==========
export {
  fetchTopHoldings,
  type HoldingStock
} from './fund/holdings'

// ========== 配置/评级 ==========
export {
  fetchIndustryAllocation,
  fetchAssetAllocation,
  fetchFundRating,
  type IndustryAllocation,
  type AssetAllocation,
  type FundRating,
} from './fund/allocation'

// ========== 基金经理 ==========
export {
  fetchFundManagerInfo,
  fetchManagerProfit,
  type FundManagerInfo,
  type ManagerProfitPoint
} from './fund/manager'

// ========== 市场数据 ==========
export {
  fetchMarketIndicesFast,
  fetchGlobalIndices,
  fetchMarketOverview,
  type MarketIndexSimple,
  type GlobalIndex,
  type FundDistribution,
  type MarketOverview
} from './fund/market'

// ========== 排行榜 ==========
export {
  fetchFundRankingFast,
  fetchETFRank,
  fetchOTCFundRank,
  fetchHotThemes,
  type FundRankItemSimple,
  type ETFItem,
  type OTCFundItem,
  type HotTheme
} from './fund/ranking'

// ========== 搜索 ==========
export {
  fetchFundList,
  searchFund
} from './fund/search'

// ========== 请求工具（供高级用法） ==========
export {
  withConcurrencyControl,
  parseJsVariable,
  parseJsonpResponse,
  fetchJsData,
  fetchJsonpData,
  fetchBatch
} from './fund/request'

// ========== 缓存管理 ==========
export {
  unifiedCache,
  CACHE_KEYS,
  UNIFIED_CACHE_TTL
} from './unifiedCache'

// ========== 兼容旧版缓存函数 ==========
import { unifiedCache } from './unifiedCache'

export function clearFundCache(code: string): void {
  const keys = ['estimate', 'netvalue', 'kline', 'period', 'accurate', 'intraday', 'topholdings', 'manager']
  keys.forEach(prefix => {
    unifiedCache.delete(`${prefix}_${code}`)
    ;[30, 60, 90, 180, 365, 400].forEach(days => {
      unifiedCache.delete(`${prefix}_${code}_${days}`)
    })
  })
  // [WHAT] 同时清除沪深300缓存
  ;[30, 60, 90, 180, 365, 400].forEach(days => {
    unifiedCache.delete(`hs300_history_${days}`)
  })
}

export function clearAllCache(): void {
  unifiedCache.clear()
}