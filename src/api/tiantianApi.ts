// [WHY] 天天基金 API 增强版 - 直接调用 Eastmoney API
// [WHAT] 提供基金排行、详情、阶段涨幅、大数据榜单等高级功能
// [DEPS] 使用 JSONP 和 fetch 直接请求天天基金接口

import { cache, CACHE_TTL } from './cache'
import { queueGlobalVarScript } from './fundFast'
import { logger } from '@/utils/logger'
import { http } from '@/utils/http'
import { handleApiError } from '@/utils/errorHandler'
import { persistCache } from '../utils/persistCache'

// ========== 交易时间和持久化缓存工具 ==========

/**
 * 交易时段枚举
 */
export type TradingSession = 'morning' | 'noon_break' | 'afternoon' | 'closed' | 'weekend' | 'holiday' | 'pre_market' | 'post_market'

// ========== 节假日动态获取（替代硬编码） ==========

/**
 * [WHY] A股法定节假日每年不同（含调休），硬编码需每年手动更新。
 * [HOW] 优先从免费节假日 API 获取，失败时使用小兜底集降级。
 *       API 数据在后台异步刷新，不阻塞 getTradingSession() 的同步调用。
 */

/** 硬编码兜底：仅用于首次启动 / API 不可用时的降级 */
const FALLBACK_HOLIDAYS: Record<string, string[]> = {
  '2025': [
    '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-03', '2025-02-04',
    '2025-04-04', '2025-04-07',
    '2025-05-01', '2025-05-02', '2025-05-05',
    '2025-05-30', '2025-06-02',
    '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-06', '2025-10-07', '2025-10-08',
  ],
  '2026': [
    '2026-01-01', '2026-01-02', '2026-01-03',
    '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-23', '2026-02-24',
    '2026-04-06',
    '2026-05-01', '2026-05-04', '2026-05-05',
    '2026-06-19', '2026-06-22',
    '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
  ],
}

/** 运行时节假日集合 */
const holidaySet = new Set<string>()
let holidayInitialized = false

/** 从兜底数据初始化 */
function initFallbackHolidays(): void {
  const thisYear = String(new Date().getFullYear())
  const nextYear = String(new Date().getFullYear() + 1)
  const years = [thisYear, nextYear]
  for (const year of years) {
    FALLBACK_HOLIDAYS[year]?.forEach(d => holidaySet.add(d))
  }
  logger.info(`[holiday] 兜底数据加载完成: ${years.join(', ')}`)
}

/**
 * 从 timor.tech API 获取指定年份的节假日数据
 * [WHY] 免费公开 API，返回结构化节假日数据（含调休安排）
 */
async function fetchYearHolidaysFromApi(year: number): Promise<void> {
  const cacheKey = `holiday_year_${year}`
  const cached = cache.get<string[]>(cacheKey)
  if (cached) {
    cached.forEach(d => holidaySet.add(d))
    logger.info(`[holiday] 缓存命中 ${year} 年`)
    return
  }

  // [WHAT] 备用 API 源列表（按优先级排序）
  const apiSources = [
    `https://timor.tech/api/holiday/year/${year}`,
    `https://api.apihubs.cn/holiday/get?year=${year}`,
    `https://www.mxnz.cn/api/holiday?year=${year}`
  ]

  for (const apiUrl of apiSources) {
    try {
      // [WHY] 多 API 源返回格式不同：timor.tech 用 .holiday，apihubs.cn/mxnz.cn 用 .data
      const data = await http.json<Record<string, any>>(apiUrl)

      // [WHAT] 适配不同 API 返回格式
      let holidayData: Record<string, { holiday: boolean; name: string; date: string }> | null = null
      
      if (apiUrl.includes('timor.tech')) {
        if (data?.code === 0 && data?.holiday) {
          holidayData = data.holiday
        }
      } else if (apiUrl.includes('apihubs.cn')) {
        // apihubs.cn 返回格式：{ code: 200, data: [{ date: '2026-01-01', holiday: 1 }] }
        if (data?.code === 200 && Array.isArray(data?.data)) {
          holidayData = {}
          data.data.forEach((item: any) => {
            if (item.holiday === 1 || item.holiday === true) {
              holidayData![item.date] = { holiday: true, name: item.name || '节假日', date: item.date }
            }
          })
        }
      } else if (apiUrl.includes('mxnz.cn')) {
        // mxnz.cn 返回格式：{ code: 0, data: { holiday: [...] } }
        if (data?.code === 0 && data?.data?.holiday) {
          holidayData = data.data.holiday
        }
      }

      if (!holidayData) {
        logger.warn(`[holiday] API 返回格式异常 ${year}`, { url: apiUrl, data })
        continue  // 尝试下一个备用源
      }

      const holidayDates: string[] = []
      for (const [dateStr, info] of Object.entries(holidayData)) {
        if (info.holiday) {
          holidaySet.add(dateStr)
          holidayDates.push(dateStr)
        }
      }
      
      // 缓存 24 小时（节假日不会每天变化）
      cache.set(cacheKey, holidayDates, 86400000)
      logger.info(`[holiday] API 获取 ${year} 年成功`, { 
        count: holidayDates.length,
        source: apiUrl 
      })
      return  // 成功获取，退出函数
    } catch (err) {
      logger.warn(`[holiday] API 获取 ${year} 年失败`, { 
        url: apiUrl, 
        error: err instanceof Error ? err.message : String(err) 
      })
      // 继续尝试下一个备用源
    }
  }

  logger.warn(`[holiday] 所有 API 源均失败，使用兜底数据 ${year}`)
}

/**
 * 初始化节假日数据
 * [WHY] 优先从 API 获取，失败时使用硬编码兜底
 * [WHEN] 在 app 启动时调用（fire-and-forget，不阻塞 UI）
 */
export async function initHolidayData(): Promise<void> {
  if (holidayInitialized) return
  holidayInitialized = true

  // 1) 先用兜底数据确保立即可用
  initFallbackHolidays()

  // 2) 从 API 获取当年 + 明年数据（覆盖兜底）
  const thisYear = new Date().getFullYear()
  await Promise.all([
    fetchYearHolidaysFromApi(thisYear),
    fetchYearHolidaysFromApi(thisYear + 1),
  ])
}

/** 判断指定日期是否为 A 股法定节假日休市 */
function isStockHoliday(date: Date): boolean {
  return holidaySet.has(formatDateKey(date))
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 获取当前交易时段（增强版：区分周末/节假日/盘前/盘后）
 * [WHY] 之前在非交易日只会显示"已收盘"，用户不知道是休市还是非交易时间
 * [WHAT] 精确区分 morning / noon_break / afternoon / pre_market / post_market / weekend / holiday / closed
 */
export function getTradingSession(): TradingSession {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const day = now.getDay()
  const timeMinutes = hour * 60 + minute

  // 1) 周末
  if (day === 0 || day === 6) return 'weekend'

  // 2) 法定节假日（动态 API + 兜底降级）
  if (isStockHoliday(now)) return 'holiday'

  // 3) 盘前（0:00 - 9:30）
  if (timeMinutes < 570) return 'pre_market'

  // 4) 上午盘：9:30 - 11:30
  if (timeMinutes >= 570 && timeMinutes < 690) return 'morning'

  // 5) 午休：11:30 - 13:00
  if (timeMinutes >= 690 && timeMinutes < 780) return 'noon_break'

  // 6) 下午盘：13:00 - 15:00
  if (timeMinutes >= 780 && timeMinutes < 900) return 'afternoon'

  // 7) 盘后
  return 'post_market'
}

/**
 * [WHAT] 返回人类友好的交易状态文本，用于 UI 显示
 */
export function getTradingSessionText(): string {
  const session = getTradingSession()
  switch (session) {
    case 'morning': return '上午交易中'
    case 'noon_break': return '午休中'
    case 'afternoon': return '下午交易中'
    case 'pre_market': return '等待开盘'
    case 'post_market': return '已收盘'
    case 'weekend': return '周末休市'
    case 'holiday': return '节假日休市'
    default: return '非交易时段'
  }
}

/**
 * 判断当前是否在交易时间内
 * [WHY] 开盘前使用缓存数据，开盘后获取实时数据
 * [WHAT] 上午盘 9:30-11:30，下午盘 13:00-15:00
 */
export function isTradingTime(): boolean {
  const session = getTradingSession()
  return session === 'morning' || session === 'afternoon'
}

/**
 * 判断当前是否为交易日的交易时段（包括午休）
 * [WHY] 用于判断今天是否已开盘，即使在午休时间也算"今天已开盘"
 */
export function isTradingDay(): boolean {
  const session = getTradingSession()
  return session === 'morning' || session === 'noon_break' || session === 'afternoon' || session === 'post_market' || session === 'pre_market'
}

/**
 * 判断今天是否已经开过盘（用于判断数据是否需要刷新）
 * [WHY] 9:30后即使午休也认为今天已开盘，应该用今天的数据
 */
export function hasMarketOpenedToday(): boolean {
  const session = getTradingSession()
  // 周末 / 节假日永远不算"开过盘"
  if (session === 'weekend' || session === 'holiday') return false
  const now = new Date()
  const timeMinutes = now.getHours() * 60 + now.getMinutes()
  return timeMinutes >= 570
}

/**
 * 持久化缓存工具
 * [WHY] 将数据保存到 localStorage，开盘前可以使用昨天的数据
 *

/**
 * [WHAT] 初始化移动端默认缓存数据
 * [WHY] 移动端首次运行时没有缓存，JSONP 可能受限，提供默认数据
 * [NOTE] 只在缓存为空时设置，不会覆盖已有数据
 */
export function initMobileDefaultCache(): void {
  const cacheKey = 'market_overview_v2'
  const existing = persistCache.get<{totalUp: number}>(cacheKey)
  
  // [WHAT] 已有缓存，不覆盖
  if (existing && existing.totalUp > 0) return
  
  // [WHAT] 设置默认数据（基于历史平均值估算）
  const defaultData = {
    updateTime: '等待更新',
    totalUp: 3000,
    totalDown: 5000,
    distribution: [
      { range: '≤-5', count: 150, min: -Infinity, max: -5 },
      { range: '-5~-3', count: 200, min: -5, max: -3 },
      { range: '-3~-1', count: 1500, min: -3, max: -1 },
      { range: '-1~0', count: 3000, min: -1, max: -0.001 },
      { range: '0~1', count: 4000, min: -0.001, max: 1 },
      { range: '1~3', count: 1000, min: 1, max: 3 },
      { range: '3~5', count: 100, min: 3, max: 5 },
      { range: '≥5', count: 50, min: 5, max: Infinity }
    ]
  }
  
  persistCache.set(cacheKey, defaultData, 3600000)
}

/**
 * 带持久化缓存的数据获取包装器
 * [WHY] 统一处理：开盘前用缓存，开盘后获取新数据
 */
export async function fetchWithPersistCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  validator: (data: T) => boolean = () => true,
  ttlMs: number = 3600000
): Promise<T | null> {
  // [WHAT] 检查内存缓存
  const memCached = cache.get<T>(key)
  if (memCached) return memCached
  
  // [WHAT] 获取持久化缓存
  const persistCached = persistCache.get<T>(key)
  
  // [WHAT] 非交易时间直接返回持久化缓存
  if (!isTradingTime() && persistCached && validator(persistCached)) {
    cache.set(key, persistCached, CACHE_TTL.MARKET_INDEX)
    return persistCached
  }
  
  // [WHAT] 交易时间尝试获取新数据
  try {
    const data = await fetcher()
    if (data && validator(data)) {
      cache.set(key, data, CACHE_TTL.MARKET_INDEX)
      persistCache.set(key, data, ttlMs)
      return data
    }
    // [EDGE] 新数据无效，使用缓存
    return persistCached
  } catch {
    // [EDGE] 请求失败，使用缓存
    return persistCached
  }
}

// ========== 类型定义 ==========

// [WHAT] 基金排行项（增强版）
export interface FundRankItemExt {
  code: string
  name: string
  type: string
  netValue: number
  dayReturn: number
  weekReturn: number
  monthReturn: number
  threeMonthReturn: number
  sixMonthReturn: number
  yearReturn: number
  twoYearReturn: number
  threeYearReturn: number
  totalReturn: number
  scale: number         // 规模(亿)
  manager: string
  buyStatus: string     // 申购状态
}

// [WHAT] 阶段涨幅
export interface PeriodReturnExt {
  period: string
  label: string
  fundReturn: number
  avgReturn: number
  hs300Return: number
  rank: number
  totalCount: number
}

// [WHAT] 热门主题
export interface HotTheme {
  code: string
  name: string
  dayReturn: number
  weekReturn: number
  monthReturn: number
  fundCount: number
}

// [WHAT] 基金评级
export interface FundRating {
  date: string
  shanghai: number      // 上海证券评级
  zhaoshang: number     // 招商证券评级
  jian: number          // 济安金信评级
}

// ========== 基金排行（增强版） ==========

/**
 * 获取基金排行榜（增强版）
 * [WHY] 使用 Eastmoney API 获取丰富的排行数据
 * [HOW] 通过 JSONP 调用 fundeast API
 */
export async function fetchFundRankExt(options: {
  fundType?: string     // gp股票 hh混合 zq债券 zs指数 qdii fof hb货币
  sortBy?: string       // rzdf日 SYL_Z周 SYL_Y月 SYL_3Y季 SYL_6Y半年 SYL_1N年
  sortOrder?: number    // 1降序 0升序
  page?: number
  pageSize?: number
} = {}): Promise<FundRankItemExt[]> {
  const {
    fundType = '',
    sortBy = 'SYL_1N',
    sortOrder = 1,
    page = 1,
    pageSize = 50
  } = options
  
  const cacheKey = `rank_ext_${fundType}_${sortBy}_${sortOrder}_${page}_${pageSize}`
  const cached = cache.get<FundRankItemExt[]>(cacheKey)
  if (cached) return cached
  
  return new Promise((resolve) => {
    // [WHAT] 构建 JSONP 回调名
    const callbackName = `fundRank_${Date.now()}`
    const scriptId = `rank_script_${Date.now()}`
    
    // [WHAT] 设置全局回调
    ;(window as any)[callbackName] = (data: any) => {
      cleanup()
      
      if (!data?.datas) {
        resolve([])
        return
      }
      
      // [WHAT] 解析数据
      // 数据格式: "代码,名称,简称,日期,单位净值,累计净值,日涨幅,周涨幅,月涨幅,3月涨幅,6月涨幅,年涨幅,2年涨幅,3年涨幅,今年涨幅,成立涨幅,手续费,是否可购,基金经理,..."
      const result: FundRankItemExt[] = data.datas.map((row: string) => {
        const cols = row.split(',')
        return {
          code: cols[0] ?? '',
          name: cols[1] ?? '',
          type: fundType || 'mixed',
          netValue: parseFloat(cols[4] ?? '0') || 0,
          dayReturn: parseFloat(cols[6] ?? '0') || 0,
          weekReturn: parseFloat(cols[7] ?? '0') || 0,
          monthReturn: parseFloat(cols[8] ?? '0') || 0,
          threeMonthReturn: parseFloat(cols[9] ?? '0') || 0,
          sixMonthReturn: parseFloat(cols[10] ?? '0') || 0,
          yearReturn: parseFloat(cols[11] ?? '0') || 0,
          twoYearReturn: parseFloat(cols[12] ?? '0') || 0,
          threeYearReturn: parseFloat(cols[13] ?? '0') || 0,
          totalReturn: parseFloat(cols[15] ?? '0') || 0,
          scale: 0,
          manager: cols[18] ?? '',
          buyStatus: cols[17] === '1' ? '可购' : '暂停'
        }
      })
      
      cache.set(cacheKey, result, CACHE_TTL.FUND_LIST)
      resolve(result)
    }
    
    function cleanup() {
      delete (window as any)[callbackName]
      const script = document.getElementById(scriptId)
      if (script) document.body.removeChild(script)
    }
    
    // [WHAT] 构建 URL
    // API: http://fund.eastmoney.com/data/rankhandler.aspx
    const ft = fundType ? `&ft=${fundType}` : ''
    const url = `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&rs=&gs=0&sc=${sortBy}&st=${sortOrder}&pi=${page}&pn=${pageSize}${ft}&dx=1&v=${Date.now()}`
    
    const script = document.createElement('script')
    script.id = scriptId
    script.src = url
    script.onerror = () => {
      cleanup()
      resolve([])
    }
    
    // [EDGE] 超时处理
    setTimeout(() => {
      if ((window as any)[callbackName]) {
        cleanup()
        resolve([])
      }
    }, 10000)
    
    document.body.appendChild(script)
  })
}

// ========== 阶段涨幅（详细版） ==========

/**
 * 获取基金阶段涨幅（带排名）
 * [WHY] 从 pingzhongdata 获取详细的阶段数据
 */
export async function fetchPeriodReturnExt(code: string): Promise<PeriodReturnExt[]> {
  const cacheKey = `period_ext_${code}`
  const cached = cache.get<PeriodReturnExt[]>(cacheKey)
  if (cached) return cached

  const result = await queueGlobalVarScript<PeriodReturnExt[]>(
    `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`,
    () => {
      const periodData = (window as any).Data_rateInSimilarPers498 || []
      const periodConfig: Record<string, { period: string, label: string }> = {
        'Z': { period: '1w', label: '近1周' },
        'Y': { period: '1m', label: '近1月' },
        '3Y': { period: '3m', label: '近3月' },
        '6Y': { period: '6m', label: '近6月' },
        '1N': { period: '1y', label: '近1年' },
        '2N': { period: '2y', label: '近2年' },
        '3N': { period: '3y', label: '近3年' },
        '5N': { period: '5y', label: '近5年' },
        'JN': { period: 'ytd', label: '今年来' },
        'LN': { period: 'all', label: '成立来' }
      }
      const items: PeriodReturnExt[] = []
      if (Array.isArray(periodData)) {
        periodData.forEach((item: any) => {
          const config = periodConfig[item.title]
          if (config) {
            items.push({
              period: config.period,
              label: config.label,
              fundReturn: parseFloat(item.syl) || 0,
              avgReturn: parseFloat(item.avg) || 0,
              hs300Return: parseFloat(item.hs300) || 0,
              rank: parseInt(item.rank) || 0,
              totalCount: parseInt(item.sc) || 0
            })
          }
        })
      }
      return items
    },
    ['Data_rateInSimilarPers498'],
    []
  )

  cache.set(cacheKey, result, CACHE_TTL.NET_VALUE)
  return result
}

// ========== 热门主题/板块 ==========

/**
 * 获取热门主题板块
 * [WHY] 展示行业板块涨跌情况
 */
export async function fetchHotThemes(): Promise<HotTheme[]> {
  const cacheKey = 'hot_themes'
  const cached = cache.get<HotTheme[]>(cacheKey)
  if (cached) return cached
  
  try {
    // [WHAT] 使用 Eastmoney 板块接口
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f12,f14&_=${Date.now()}`

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
    
    cache.set(cacheKey, result, CACHE_TTL.MARKET_INDEX)
    return result
  } catch {
    return []
  }
}

// ========== 基金评级 ==========

/**
 * 获取基金评级信息
 * [WHY] 展示各机构对基金的评级
 */
export async function fetchFundRatingFromEval(code: string): Promise<FundRating | null> {
  const cacheKey = `rating_${code}`
  const cached = cache.get<FundRating>(cacheKey)
  if (cached) return cached

  const result = await queueGlobalVarScript<FundRating | null>(
    `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`,
    () => {
      const evalData = (window as any).Data_performanceEvaluation
      if (!evalData) return null
      return {
        date: new Date().toISOString().split('T')[0] ?? '',
        shanghai: 0,
        zhaoshang: 0,
        jian: Math.round(parseFloat(evalData.avr) / 20) || 0
      }
    },
    ['Data_performanceEvaluation'],
    null
  )

  if (result) cache.set(cacheKey, result, CACHE_TTL.FUND_INFO)
  return result
}

// ========== 基金持仓变动 ==========

export interface HoldingChange {
  stockCode: string
  stockName: string
  ratio: number         // 持仓比例%
  change: number        // 较上期变动%
  marketValue: number   // 持仓市值(万)
}

/**
 * 获取基金持仓变动
 * [WHY] 展示重仓股变动情况
 */
export async function fetchHoldingChanges(code: string): Promise<HoldingChange[]> {
  const cacheKey = `holding_change_${code}`
  const cached = cache.get<HoldingChange[]>(cacheKey)
  if (cached) return cached

  const result = await queueGlobalVarScript<HoldingChange[]>(
    `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`,
    () => {
      const stockPositions = (window as any).Data_investPosition?.fundStocks || []
      return stockPositions.slice(0, 10).map((item: any) => ({
        stockCode: item.GPDM || '',
        stockName: item.GPJC || '',
        ratio: parseFloat(item.JZBL) || 0,
        change: parseFloat(item.PCTNVCHG) || 0,
        marketValue: parseFloat(item.GPJC) || 0
      }))
    },
    ['Data_investPosition'],
    []
  )

  cache.set(cacheKey, result, CACHE_TTL.FUND_INFO)
  return result
}

// ========== 同类基金对比 ==========

export interface SimilarFund {
  code: string
  name: string
  yearReturn: number
  threeYearReturn: number
  scale: number
  manager: string
}

/**
 * 获取同类基金（用于对比）
 * [WHY] 帮助用户了解同类基金表现
 */
export async function fetchSimilarFunds(code: string): Promise<SimilarFund[]> {
  const cacheKey = `similar_${code}`
  const cached = cache.get<SimilarFund[]>(cacheKey)
  if (cached) return cached

  const result = await queueGlobalVarScript<SimilarFund[]>(
    `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`,
    () => {
      const sameType = (window as any).swithSameType || []
      const items: SimilarFund[] = []
      if (sameType[3]) {
        sameType[3].slice(0, 5).forEach((item: string) => {
          const parts = item.split('_')
          if (parts.length >= 3) {
            items.push({
              code: parts[0] ?? '',
              name: parts[1] ?? '',
              yearReturn: parseFloat(parts[2] ?? '0') || 0,
              threeYearReturn: 0,
              scale: 0,
              manager: ''
            })
          }
        })
      }
      return items
    },
    ['swithSameType'],
    []
  )

  cache.set(cacheKey, result, CACHE_TTL.FUND_INFO)
  return result
}

// ========== 基金经理排行榜 ==========

export interface ManagerRankItem {
  managerId: string
  name: string
  company: string
  workTime: string        // 从业年限
  fundCount: number       // 管理基金数
  scale: string           // 管理规模
  bestReturn: number      // 最佳回报
  avgReturn: number       // 平均年化
}

/**
 * 获取基金经理排行榜
 * [WHY] 帮助用户发现优秀的基金经理
 * [HOW] 从基金排行数据中提取经理信息并去重汇总
 */
export async function fetchManagerRank(options: {
  sortBy?: string
  sortOrder?: string
  page?: number
  pageSize?: number
} = {}): Promise<ManagerRankItem[]> {
  const {
    sortBy = 'penavgrowth',
    pageSize = 30
  } = options

  const cacheKey = `manager_rank_${sortBy}_${pageSize}`
  const cached = cache.get<ManagerRankItem[]>(cacheKey)
  if (cached) return cached

  const result = await queueGlobalVarScript<ManagerRankItem[]>(
    `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=1nzf&st=desc&pi=1&pn=500&dx=1&v=${Date.now()}`,
    () => {
      const rankData = (window as any).rankData
      if (!rankData?.datas) return []

      const managerMap = new Map<string, {
        name: string
        company: string
        funds: { name: string, return: number }[]
        totalReturn: number
      }>()

      rankData.datas.forEach((row: string) => {
        const cols = row.split(',')

        let managerName = ''
        for (const idx of [18, 24, 19, 23]) {
          const val = cols[idx]
          if (val && val !== '--' && val.length > 0 && val.length < 20 && !/^\d+(\.\d+)?%?$/.test(val)) {
            managerName = val
            break
          }
        }

        const fundName = cols[1] ?? ''
        const yearReturn = parseFloat(cols[11] ?? '0') || 0

        if (managerName) {
          const managers = managerName.split(/[\s、]+/)
          managers.forEach(mgr => {
            const name = mgr.trim()
            if (!name || name.length > 10) return

            if (managerMap.has(name)) {
              const data = managerMap.get(name)!
              data.funds.push({ name: fundName, return: yearReturn })
              data.totalReturn += yearReturn
            } else {
              managerMap.set(name, {
                name,
                company: '--',
                funds: [{ name: fundName, return: yearReturn }],
                totalReturn: yearReturn
              })
            }
          })
        }
      })

      const items: ManagerRankItem[] = Array.from(managerMap.values()).map(m => ({
        managerId: m.name,
        name: m.name,
        company: m.company,
        workTime: '--',
        fundCount: m.funds.length,
        scale: '--',
        bestReturn: Math.max(...m.funds.map(f => f.return)),
        avgReturn: m.totalReturn / m.funds.length
      }))

      if (sortBy === 'workyear') {
        items.sort((a, b) => b.fundCount - a.fundCount)
      } else {
        items.sort((a, b) => b.avgReturn - a.avgReturn)
      }

      return items.slice(0, pageSize)
    },
    ['rankData'],
    []
  )

  cache.set(cacheKey, result, CACHE_TTL.FUND_LIST)
  return result
}

// ========== 基金涨跌分布 ==========

export interface FundDistribution {
  range: string        // 区间标签
  count: number        // 基金数量
  min: number          // 最小涨幅
  max: number          // 最大涨幅
}

export interface MarketOverview {
  updateTime: string
  totalUp: number      // 上涨数
  totalDown: number    // 下跌数
  distribution: FundDistribution[]
}

/**
 * 获取基金涨跌分布
 * [WHY] 展示市场整体涨跌情况
 * [HOW] 天天基金 rankhandler 会设置全局变量 rankData
 * [NOTE] 开盘前使用昨天的缓存数据，开盘后更新
 */
export async function fetchMarketOverview(): Promise<MarketOverview> {
  const cacheKey = 'market_overview_v2'

  const cached = cache.get<MarketOverview>(cacheKey)
  if (cached) return cached

  const persisted = persistCache.get<MarketOverview>(cacheKey)
  const isNativeApp = !!(window as any).Capacitor?.isNativePlatform?.()

  if (!isTradingTime()) {
    if (persisted && (persisted.totalUp > 0 || persisted.totalDown > 0)) {
      cache.set(cacheKey, persisted, CACHE_TTL.MARKET_INDEX)
      return persisted
    }
    initMobileDefaultCache()
    const defaultData = persistCache.get<MarketOverview>(cacheKey)
    if (defaultData) {
      cache.set(cacheKey, defaultData, CACHE_TTL.MARKET_INDEX)
      return defaultData
    }
  }

  if (isNativeApp && persisted && persisted.totalUp > 0) {
    cache.set(cacheKey, persisted, CACHE_TTL.MARKET_INDEX)
    fetchMarketOverviewInBackground(persisted)
    return persisted
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

  const result = await queueGlobalVarScript<MarketOverview>(
    `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=zzf&st=desc&sd=2020-01-01&ed=${new Date().toISOString().slice(0,10)}&qdii=&tabSubtype=,,,,,&pi=1&pn=10000&dx=1&v=${Date.now()}`,
    () => {
      const rankData = (window as any).rankData
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
        return {
          updateTime: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          totalUp,
          totalDown,
          distribution: ranges
        }
      }
      return persisted || createEmptyData()
    },
    ['rankData'],
    persisted || createEmptyData()
  )

  if (result.totalUp > 0 || result.totalDown > 0) {
    cache.set(cacheKey, result, CACHE_TTL.MARKET_INDEX)
    persistCache.set(cacheKey, result)
  }
  return result
}

function fetchMarketOverviewInBackground(currentData: MarketOverview): void {
  const cacheKey = 'market_overview_v2'
  queueGlobalVarScript<MarketOverview>(
    `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=zzf&st=desc&sd=2020-01-01&ed=${new Date().toISOString().slice(0,10)}&qdii=&tabSubtype=,,,,,&pi=1&pn=10000&dx=1&v=${Date.now()}`,
    () => {
      const rankData = (window as any).rankData
      if (!rankData?.datas || !Array.isArray(rankData.datas)) return currentData

      const ranges: FundDistribution[] = [
        { range: '≤-5', count: 0, min: -Infinity, max: -5 },
        { range: '-5~-3', count: 0, min: -5, max: -3 },
        { range: '-3~-1', count: 0, min: -3, max: -1 },
        { range: '-1~0', count: 0, min: -1, max: -0.001 },
        { range: '0~1', count: 0, min: -0.001, max: 1 },
        { range: '1~3', count: 0, min: 1, max: 3 },
        { range: '3~5', count: 0, min: 3, max: 5 },
        { range: '≥5', count: 0, min: 5, max: Infinity }
      ]

      let totalUp = 0
      let totalDown = 0

      rankData.datas.forEach((row: string) => {
        const cols = row.split(',')
        let change = parseFloat(cols[6] ?? '0')
        if (isNaN(change) || cols[6] === '') {
          change = parseFloat(cols[4] ?? '0') || 0
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

      if (totalUp > 0 || totalDown > 0) {
        const now = new Date()
        const result: MarketOverview = {
          updateTime: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          totalUp,
          totalDown,
          distribution: ranges
        }
        cache.set(cacheKey, result, CACHE_TTL.MARKET_INDEX)
        persistCache.set(cacheKey, result)
        return result
      }
      return currentData
    },
    ['rankData'],
    currentData
  ).catch(() => {})
}

// ========== 场外基金涨幅榜 ==========

export interface OTCFundItem {
  code: string
  name: string
  netValue: number
  dayReturn: number
  updateStatus: string  // 已更新/待更新
}

/**
 * 获取场外基金涨幅榜
 * [HOW] 天天基金 rankhandler 会设置全局变量 rankData
 */
export async function fetchOTCFundRank(order: 'desc' | 'asc' = 'desc', pageSize = 10): Promise<OTCFundItem[]> {
  const cacheKey = `otc_rank_${order}_${pageSize}`
  const cached = cache.get<OTCFundItem[]>(cacheKey)
  if (cached) return cached

  const st = order === 'desc' ? 'desc' : 'asc'
  const result = await queueGlobalVarScript<OTCFundItem[]>(
    `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=rzdf&st=${st}&pi=1&pn=${pageSize}&dx=1&v=${Date.now()}`,
    () => {
      const rankData = (window as any).rankData
      if (!rankData?.datas || !Array.isArray(rankData.datas)) return []
      return rankData.datas.slice(0, pageSize).map((row: string) => {
        const cols = row.split(',')
        return {
          code: cols[0] ?? '',
          name: cols[1] ?? '',
          netValue: parseFloat(cols[4] ?? '0') || 0,
          dayReturn: parseFloat(cols[6] ?? '0') || 0,
          updateStatus: '已更新'
        }
      })
    },
    ['rankData'],
    []
  )

  cache.set(cacheKey, result, 60000)
  return result
}

// ========== 板块及基金 ==========

export interface SectorFund {
  code: string
  name: string
  netValue: number
  dayReturn: number
}

export interface SectorInfo {
  code: string        // 板块代码
  name: string
  streak: string      // 连涨X天
  dayReturn: number
  funds: SectorFund[]
}

/**
 * 获取热门板块及基金列表
 */
export async function fetchSectorFunds(): Promise<SectorInfo[]> {
  const cacheKey = 'sector_funds'
  const cached = cache.get<SectorInfo[]>(cacheKey)
  if (cached) return cached
  
  try {
    // [WHAT] 获取行业板块
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f12,f14&_=${Date.now()}`

    const data = await http.get<{ data?: { diff?: any[] } }>(url)

    if (!data?.data?.diff) return []
    
    const sectors: SectorInfo[] = data.data.diff.slice(0, 6).map((item: any) => {
      // [WHAT] 确保 dayReturn 是数字类型
      const dayReturn = parseFloat(item.f3) || 0
      return {
        code: item.f12 || '',  // 板块代码
        name: item.f14 || '',
        streak: dayReturn > 0 ? '连涨1天' : (dayReturn < 0 ? '连跌1天' : ''),
        dayReturn,
        funds: [] // 先留空，后续可扩展
      }
    })
    
    cache.set(cacheKey, sectors, CACHE_TTL.MARKET_INDEX)
    return sectors
  } catch {
    return []
  }
}

// ========== 场内ETF ==========

export interface ETFItem {
  code: string
  name: string
  price: number
  dayReturn: number
}

/**
 * 获取场内ETF涨幅榜
 */
export async function fetchETFRank(pageSize = 10): Promise<ETFItem[]> {
  const cacheKey = `etf_rank_${pageSize}`
  const cached = cache.get<ETFItem[]>(cacheKey)
  if (cached) return cached
  
  try {
    // [WHAT] 获取ETF排行
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=b:MK0021,b:MK0022&fields=f2,f3,f4,f12,f14&_=${Date.now()}`

    const data = await http.get<{ data?: { diff?: any[] } }>(url)

    if (!data?.data?.diff) return []
    
    const result: ETFItem[] = data.data.diff.map((item: any) => ({
      code: item.f12 || '',
      name: item.f14 || '',
      price: item.f2 || 0,
      dayReturn: item.f3 || 0
    }))
    
    cache.set(cacheKey, result, 60000)
    return result
  } catch {
    return []
  }
}

// ========== 检查 API 可用性 ==========

/**
 * 检查 API 是否可用
 */
export async function checkApiAvailability(): Promise<boolean> {
  try {
    await http.get(
      `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=1&fid=f3&fs=b:MK0021&fields=f12&_=${Date.now()}`,
      { timeout: 5000 }
    )
    return true
  } catch {
    return false
  }
}

// ========== 财经资讯 ==========

export interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  time: string
  url: string
}

/**
 * 获取财经资讯列表
 * [WHY] 从多个数据源获取基金/财经相关新闻
 * [HOW] 尝试多个API，第一个成功就返回
 */
export async function fetchFinanceNews(pageSize = 10): Promise<NewsItem[]> {
  const cacheKey = `finance_news_${pageSize}`
  const cached = cache.get<NewsItem[]>(cacheKey)
  if (cached) return cached
  
  // [WHAT] 尝试东方财富7x24快讯（更活跃）
  try {
    const news = await fetchEastmoney7x24(pageSize)
    if (news.length > 0) {
      cache.set(cacheKey, news, 180000) // 3分钟缓存
      return news
    }
  } catch { /* 继续尝试下一个源 */ }
  
  // [WHAT] 备用：东方财富基金资讯
  try {
    const news = await fetchEastmoneyFundNews(pageSize)
    if (news.length > 0) {
      cache.set(cacheKey, news, 300000)
      return news
    }
  } catch { /* 继续 */ }
  
  return getDefaultNews()
}

// [WHAT] 东方财富7x24快讯（实时性强）
// [FIX] 改用代理 + fetch，避免 JSONP 脚本注入
async function fetchEastmoney7x24(pageSize: number): Promise<NewsItem[]> {
  const url = `/api/nplistapi/comm/web/getStockNews?type=0&pageSize=${pageSize}`

  try {
    const text = await http.text(url + '&_=' + Date.now())
    // [WHAT] JSONP 响应格式：callbackName({...})，用正则提取 JSON 部分
    const match = text.match(/^[a-zA-Z0-9_]+\(([\s\S]*)\)$/)
    if (!match || !match[1]) return []

    const data = JSON.parse(match[1])

    if (!data?.data?.list) return []

    return data.data.list.map((item: any) => ({
      id: String(item.art_id || Date.now() + Math.random()),
      title: item.title || '',
      summary: (item.digest || item.title || '').slice(0, 80),
      source: item.source || '7x24快讯',
      time: formatNewsTime(item.showtime || ''),
      url: item.url_unique || ''
    })).filter((n: NewsItem) => n.title)
  } catch (e) {
    handleApiError(e, 'fetchEastmoney7x24', { silent: true })
    return []
  }
}

// [WHAT] 东方财富基金资讯
// [FIX] 改用代理 + fetch，避免 JSONP 脚本注入
async function fetchEastmoneyFundNews(pageSize: number): Promise<NewsItem[]> {
  const url = `/api/nplistapi/comm/wap/getListInfo?client=wap&type=5&pageSize=${pageSize}&pageIndex=0`

  try {
    const text = await http.text(url + '&_=' + Date.now())
    // [WHAT] JSONP 响应格式：callbackName({...})，用正则提取 JSON 部分
    const match = text.match(/^[a-zA-Z0-9_]+\(([\s\S]*)\)$/)
    if (!match || !match[1]) return []

    const data = JSON.parse(match[1])

    if (!data?.data?.list) return []

    return data.data.list.map((item: any) => ({
      id: item.art_uniqueUrl || String(Date.now() + Math.random()),
      title: item.title || '',
      summary: (item.digest || item.title || '').slice(0, 80),
      source: item.source || '东方财富',
      time: formatNewsTime(item.showtime || item.time || ''),
      url: item.url || item.art_uniqueUrl || ''
    })).filter((n: NewsItem) => n.title)
  } catch (e) {
    handleApiError(e, 'fetchEastmoneyFundNews', { silent: true })
    return []
  }
}

// [WHAT] 格式化资讯时间
function formatNewsTime(timeStr: string): string {
  if (!timeStr) return ''
  try {
    const date = new Date(timeStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    return (date.getMonth() + 1) + '-' + date.getDate()
  } catch {
    return timeStr
  }
}

// [WHAT] 默认资讯（API 失败时使用）
function getDefaultNews(): NewsItem[] {
  return [
    { 
      id: '1', 
      title: '基金投资需关注长期价值', 
      summary: '在市场波动中保持理性，坚持长期投资理念。分散投资降低风险，定期定额投资可平滑市场波动带来的影响。选择基金时应关注基金经理的投资能力和基金的历史业绩稳定性。', 
      source: '投资提示', 
      time: '今日', 
      url: '' 
    },
    { 
      id: '2', 
      title: 'A股市场投资策略分析', 
      summary: '当前市场呈现结构性行情，建议关注业绩确定性强的优质标的。科技创新、消费升级、绿色发展等主线值得重点关注。同时注意控制仓位，做好风险管理。', 
      source: '市场动态', 
      time: '今日', 
      url: '' 
    },
    { 
      id: '3', 
      title: '新能源行业投资机遇', 
      summary: '在"双碳"目标推动下，新能源产业迎来快速发展期。光伏、风电、储能、新能源汽车等细分领域均有较好的投资机会。建议通过相关主题基金参与投资。', 
      source: '行业资讯', 
      time: '今日', 
      url: '' 
    },
    { 
      id: '4', 
      title: '债券基金配置建议', 
      summary: '在当前利率环境下，债券基金可作为资产配置的重要组成部分。纯债基金风险较低，适合稳健型投资者；二级债基可获取一定的权益收益增强。', 
      source: '配置建议', 
      time: '今日', 
      url: '' 
    },
    { 
      id: '5', 
      title: '基金定投策略解读', 
      summary: '定投是一种简单有效的投资方式，通过分批买入平摊成本。建议选择波动较大的偏股型基金进行定投，长期坚持可获得较好的平均成本优势。', 
      source: '投资技巧', 
      time: '今日', 
      url: '' 
    },
    { 
      id: '6', 
      title: '基金交易注意事项', 
      summary: '基金交易时间为工作日9:30-15:00，15:00后提交的申购赎回按下一交易日净值计算。节假日前需提前规划资金安排，注意赎回到账时间。', 
      source: '交易提醒', 
      time: '今日', 
      url: '' 
    }
  ]
}

// ========== 分红记录 API ==========

/**
 * 分红记录类型
 * [WHAT] 每笔分红的详细信息
 */
export interface DividendRecord {
  date: string        // 权益登记日
  exDate: string      // 除息日  
  payDate: string     // 红利发放日
  amount: number      // 每份分红金额（元）
  type: '红利再投' | '现金分红'  // 分红方式
}

/**
 * 获取基金分红记录
 * [WHY] 投资者关心历史分红情况，评估基金收益分配能力
 * [HOW] 使用 JSONP 方式从天天基金 API 获取数据，避免 CORS 限制
 */
// [FIX] 改用代理 + fetch，避免 JSONP 脚本注入
export async function fetchDividendRecords(fundCode: string): Promise<DividendRecord[]> {
  const cacheKey = `dividend_${fundCode}`
  const cached = cache.get<DividendRecord[]>(cacheKey)
  if (cached) return cached

  try {
    // [WHAT] 走代理，保留 callback 参数让服务端返回 JSONP 格式
    const cbName = `de_cb_${Date.now()}`
    const url = `/api/apifund/f10/fhsp?fundcode=${fundCode}&callback=${cbName}&_=${Date.now()}`
    const text = await http.text(url)

    // [WHAT] 解析 callbackName({...}) 格式，提取 JSON
    const jsonStart = text.indexOf('({') + 1
    const jsonEnd = text.lastIndexOf('})')
    if (jsonStart < 0 || jsonEnd < 0) return []

    const jsonStr = text.substring(jsonStart, jsonEnd + 1)
    const jsonResp = JSON.parse(jsonStr)

    const records: DividendRecord[] = []

    if (jsonResp?.Datas?.fhspList) {
      for (const item of jsonResp.Datas.fhspList) {
        records.push({
          date: item.DJRQ || '',
          exDate: item.CXRQ || '',
          payDate: item.FFRQ || '',
          amount: item.FHFCZ || 0,
          type: '现金分红'
        })
      }
    }

    cache.set(cacheKey, records, CACHE_TTL.LONG)
    return records
  } catch (e) {
    handleApiError(e, `fetchDividendRecords(${fundCode})`, { silent: true })
    return []
  }
}

// ========== 费率查询 API ==========

/**
 * 基金费率信息
 * [WHAT] 申购、赎回、管理等各类费率
 */
export interface FundFeeInfo {
  // 申购费率（按金额分档）
  purchaseFees: Array<{ 
    minAmount: number   // 最小金额（万元）
    maxAmount: number   // 最大金额（万元）
    rate: number        // 原费率 (%)
    discountRate: number // 折扣后费率 (%)
  }>
  // 赎回费率（按持有天数分档）
  redemptionFees: Array<{
    minDays: number     // 最少持有天数
    maxDays: number     // 最多持有天数
    rate: number        // 费率 (%)
  }>
  // 管理费率（年化）
  managementFee: number
  // 托管费率（年化）
  custodianFee: number
  // 销售服务费（年化，C类基金）
  salesServiceFee: number
}

/**
 * 获取基金费率信息
 * [WHY] 投资者在买入/卖出前需要了解交易成本
 * [TODO] 需接入真实API获取准确费率，当前数据为行业通用估算值
 * [NOTE] A类/C类判断基于基金代码末尾字母（C/E 判断为 C 类），不保证完全准确
 */
export async function fetchFundFees(fundCode: string): Promise<FundFeeInfo> {
  const cacheKey = `fees_${fundCode}`
  const cached = cache.get<FundFeeInfo>(cacheKey)
  if (cached) return cached
  
  // [WHAT] 判断基金类型（A类前端收费，C类销售服务费）
  // [NOTE] 简易判断：根据基金代码末尾字母（C/E = C类，其他 = A类）
  // [WARNING] 此方法不保证完全准确！因为：
  //   1. 部分 C 类基金代码末尾不是 C/E（如某些特殊命名规则）
  //   2. 部分 A 类基金代码末尾可能是其他字母
  //   3. 最佳方案是通过天天基金 API 获取 fundType 字段
  // [TODO] 接入真实API获取准确费率，当前数据为行业通用估算值
  const lastChar = fundCode.slice(-1).toUpperCase()
  // [FIX] 更全面的 C 类判断：C/E/Y（Y 代表易方达 C 类）
  const isClassC = lastChar === 'C' || lastChar === 'E' || lastChar === 'Y'
  
  // [WHAT] A类基金费率（前端收费，无销售服务费）
  const classAFees: FundFeeInfo = {
    purchaseFees: [
      { minAmount: 0, maxAmount: 100, rate: 1.5, discountRate: 0.15 },
      { minAmount: 100, maxAmount: 300, rate: 1.2, discountRate: 0.12 },
      { minAmount: 300, maxAmount: 500, rate: 0.8, discountRate: 0.08 },
      { minAmount: 500, maxAmount: Infinity, rate: 1000, discountRate: 1000 }
    ],
    redemptionFees: [
      { minDays: 0, maxDays: 7, rate: 1.5 },
      { minDays: 7, maxDays: 30, rate: 0.5 },
      { minDays: 30, maxDays: 365, rate: 0.5 },
      { minDays: 365, maxDays: 730, rate: 0.25 },
      { minDays: 730, maxDays: Infinity, rate: 0 }
    ],
    managementFee: 1.5,
    custodianFee: 0.25,
    salesServiceFee: 0
  }
  
  // [WHAT] C类基金费率（无申购费，有销售服务费）
  const classCFees: FundFeeInfo = {
    purchaseFees: [
      { minAmount: 0, maxAmount: Infinity, rate: 0, discountRate: 0 }
    ],
    redemptionFees: [
      { minDays: 0, maxDays: 7, rate: 1.5 },
      { minDays: 7, maxDays: 30, rate: 0.5 },
      { minDays: 30, maxDays: Infinity, rate: 0 }
    ],
    managementFee: 1.5,
    custodianFee: 0.25,
    salesServiceFee: 0.4
  }
  
  const result = isClassC ? classCFees : classAFees
  cache.set(cacheKey, result, CACHE_TTL.LONG)
  return result
}

/**
 * 计算赎回费
 * [WHY] 根据持有天数和赎回金额计算实际赎回费用
 */
export function calculateRedemptionFee(
  holdingDays: number, 
  redemptionAmount: number,
  fees: FundFeeInfo['redemptionFees']
): { rate: number; fee: number } {
  // [WHAT] 找到对应的费率档位
  const tier = fees.find(f => holdingDays >= f.minDays && holdingDays < f.maxDays)
  const rate = tier?.rate || 0
  const fee = redemptionAmount * (rate / 100)
  
  return { rate, fee }
}

// ========== 基金公告 API ==========

/**
 * 基金公告类型
 */
export interface FundAnnouncement {
  id: string
  title: string
  date: string
  type: '分红公告' | '定期报告' | '人事变动' | '其他公告'
  url: string
}

/**
 * 获取基金公告列表
 * [WHY] 投资者需要了解基金的重大事项，如分红、换经理、持仓变化
 * [HOW] 由于CORS限制，直接返回默认公告数据
 */
export async function fetchFundAnnouncements(fundCode: string, _pageSize = 10): Promise<FundAnnouncement[]> {
  const cacheKey = `announcements_${fundCode}`
  const cached = cache.get<FundAnnouncement[]>(cacheKey)
  if (cached) return cached
  
  // [WHAT] 由于CORS限制，直接使用默认公告数据
  const announcements = getDefaultAnnouncements(fundCode)
  cache.set(cacheKey, announcements, CACHE_TTL.SHORT)
  return announcements
}

/**
 * 默认公告数据
 * [WHAT] 免责声明和风险提示
 */
function getDefaultAnnouncements(_fundCode: string): FundAnnouncement[] {
  const now = new Date()
  const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return [
    {
      id: '1',
      title: '投资有风险，理财需谨慎',
      date: formatDate(now),
      type: '其他公告',
      url: ''
    },
    {
      id: '2',
      title: '数据刷新有延迟，仅供学习和参考',
      date: formatDate(now),
      type: '其他公告',
      url: ''
    }
  ]
}

// ========== 基金规模 API ==========

/**
 * 基金规模信息
 */
export interface FundScale {
  scale: number         // 基金规模（亿元）
  scaleDate: string     // 规模日期
  shareTotal: number    // 总份额（亿份）
  holderCount: number   // 持有人户数
  institutionRatio: number  // 机构持有占比 (%)
  personalRatio: number     // 个人持有占比 (%)
}

/**
 * 获取基金规模信息
 * [WHY] 规模影响基金运作效率，过大过小都有风险
 * [HOW] 使用JSONP从天天基金API获取数据
 */
export async function fetchFundScale(fundCode: string): Promise<FundScale> {
  const cacheKey = `scale_${fundCode}`
  const cached = cache.get<FundScale>(cacheKey)
  if (cached) return cached
  
  const defaultScale: FundScale = {
    scale: 0,
    scaleDate: '--',
    shareTotal: 0,
    holderCount: 0,
    institutionRatio: 0,
    personalRatio: 100
  }
  
  try {
    // [WHAT] 使用JSONP获取基金基本信息（包含规模）
    const url = `https://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}`

    // [WHAT] 尝试从估值接口获取规模信息
    // 该接口返回的是js变量赋值，不是标准JSONP，需要特殊处理
    try {
      const text = await http.text(url)
      // [WHAT] 解析 jsonpgz({...}) 格式
      const match = text.match(/jsonpgz\(([\s\S]*)\)/)
      if (match) {
        const data = JSON.parse(match[1]!)
        // 但可以确认基金存在
        if (data.fundcode) {
          cache.set(cacheKey, defaultScale, CACHE_TTL.LONG)
          return defaultScale
        }
      }
    } catch {
      // 忽略错误
    }

    return defaultScale
  } catch (error) {
    logger.error('[API] 获取基金规模失败', error)
    return defaultScale
  }
}

// ========== 基金风格分析 API ==========

/**
 * 基金风格类型
 * [WHAT] 九宫格风格分类：大盘/中盘/小盘 × 价值/平衡/成长
 */
export interface FundStyle {
  /** 市值风格：大盘/中盘/小盘 */
  marketCap: 'large' | 'mid' | 'small' | 'unknown'
  /** 投资风格：价值/平衡/成长 */
  investStyle: 'value' | 'blend' | 'growth' | 'unknown'
  /** 风格标签文字 */
  styleLabel: string
  /** 股票仓位 */
  stockRatio: number
  /** 债券仓位 */
  bondRatio: number
  /** 现金仓位 */
  cashRatio: number
}

/**
 * 获取基金风格分析
 * [WHY] 了解基金的投资风格，辅助资产配置决策
 */
export async function fetchFundStyle(fundCode: string): Promise<FundStyle> {
  const cacheKey = `style_${fundCode}`
  const cached = cache.get<FundStyle>(cacheKey)
  if (cached) return cached
  
  const defaultStyle: FundStyle = {
    marketCap: 'unknown',
    investStyle: 'unknown',
    styleLabel: '未知',
    stockRatio: 0,
    bondRatio: 0,
    cashRatio: 0
  }
  
  try {
    // [WHAT] 从天天基金获取基金风格数据
    const url = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js?v=${Date.now()}`
    const text = await http.text(url)
    
    // [WHAT] 解析资产配置数据
    // 格式：var Data_assetAllocation = {...}
    const assetMatch = text.match(/var\s+Data_assetAllocation\s*=\s*(\{[\s\S]*?\});/)
    if (assetMatch) {
      const assetData = JSON.parse(assetMatch[1]!)
      // [WHAT] 获取最新一期的资产配置
      if (assetData.categories && assetData.series) {
        const latest = assetData.series.length - 1
        if (latest >= 0) {
          defaultStyle.stockRatio = assetData.series[0]?.data?.[latest] || 0
          defaultStyle.bondRatio = assetData.series[1]?.data?.[latest] || 0
          defaultStyle.cashRatio = assetData.series[2]?.data?.[latest] || 0
        }
      }
    }
    
    // [WHAT] 解析风格数据
    // 格式：var swithSameType = [...]
    const styleMatch = text.match(/var\s+swithSameType\s*=\s*(\[[\s\S]*?\]);/)
    if (styleMatch) {
      try {
        const styleData = JSON.parse(styleMatch[1]!)
        // [WHAT] 根据同类基金分类判断风格
        for (const item of styleData) {
          if (item[0] && typeof item[0] === 'string') {
            const name = item[0]
            // 判断市值风格
            if (name.includes('大盘')) defaultStyle.marketCap = 'large'
            else if (name.includes('中盘')) defaultStyle.marketCap = 'mid'
            else if (name.includes('小盘')) defaultStyle.marketCap = 'small'
            // 判断投资风格
            if (name.includes('价值')) defaultStyle.investStyle = 'value'
            else if (name.includes('成长')) defaultStyle.investStyle = 'growth'
            else if (name.includes('平衡')) defaultStyle.investStyle = 'blend'
          }
        }
      } catch {}
    }
    
    // [WHAT] 生成风格标签
    const capLabels = { large: '大盘', mid: '中盘', small: '小盘', unknown: '' }
    const investLabels = { value: '价值', blend: '平衡', growth: '成长', unknown: '' }
    defaultStyle.styleLabel = `${capLabels[defaultStyle.marketCap]}${investLabels[defaultStyle.investStyle]}`.trim() || '综合'
    
    cache.set(cacheKey, defaultStyle, CACHE_TTL.LONG)
    return defaultStyle
  } catch (error) {
    logger.error('[API] 获取基金风格失败', error)
    return defaultStyle
  }
}

// ========== 指数估值 API ==========

/**
 * 指数估值信息
 */
export interface IndexValuation {
  /** 指数代码 */
  code: string
  /** 指数名称 */
  name: string
  /** 当前PE */
  pe: number
  /** PE百分位（历史分位数） */
  pePercentile: number
  /** 当前PB */
  pb: number
  /** PB百分位 */
  pbPercentile: number
  /** 股息率 */
  dividendYield: number
  /** 估值状态：低估/正常/高估 */
  status: 'undervalued' | 'normal' | 'overvalued'
  /** 更新日期 */
  updateDate: string
}

/**
 * 获取主要指数估值
 * [WHY] 指数估值是判断市场位置的重要参考
 */
export async function fetchIndexValuations(): Promise<IndexValuation[]> {
  const cacheKey = 'index_valuations'
  const cached = cache.get<IndexValuation[]>(cacheKey)
  if (cached) return cached
  
  // [WHAT] 常见指数的默认估值数据（作为兜底）
  const defaultData: IndexValuation[] = [
    { code: '000300', name: '沪深300', pe: 12.5, pePercentile: 35, pb: 1.4, pbPercentile: 25, dividendYield: 2.8, status: 'normal', updateDate: '--' },
    { code: '000905', name: '中证500', pe: 22.0, pePercentile: 40, pb: 1.8, pbPercentile: 30, dividendYield: 1.5, status: 'normal', updateDate: '--' },
    { code: '000016', name: '上证50', pe: 10.5, pePercentile: 30, pb: 1.2, pbPercentile: 20, dividendYield: 3.2, status: 'undervalued', updateDate: '--' },
    { code: '399006', name: '创业板指', pe: 35.0, pePercentile: 45, pb: 4.5, pbPercentile: 40, dividendYield: 0.5, status: 'normal', updateDate: '--' },
    { code: '000922', name: '中证红利', pe: 6.5, pePercentile: 15, pb: 0.8, pbPercentile: 10, dividendYield: 5.5, status: 'undervalued', updateDate: '--' },
  ]
  
  try {
    // [WHAT] 尝试从乐估API获取实时估值数据
    const url = 'https://legulegu.com/api/stockdata/index-valuations'
    const data = await http.get<any[]>(url).catch(() => null)

    if (data && Array.isArray(data) && data.length > 0) {
      const result = data.map((item: Record<string, unknown>) => ({
        code: String(item.code || ''),
        name: String(item.name || ''),
        pe: Number(item.pe) || 0,
        pePercentile: Number(item.pe_percentile) || 50,
        pb: Number(item.pb) || 0,
        pbPercentile: Number(item.pb_percentile) || 50,
        dividendYield: Number(item.dividend_yield) || 0,
        status: getValuationStatus(Number(item.pe_percentile) || 50),
        updateDate: String(item.date || new Date().toISOString().split('T')[0])
      }))
      cache.set(cacheKey, result, CACHE_TTL.LONG)
      return result
    }

    // [EDGE] API不可用时返回默认数据
    cache.set(cacheKey, defaultData, CACHE_TTL.LONG)
    return defaultData
  } catch (error) {
    logger.error('[API] 获取指数估值失败', error)
    return defaultData
  }
}

/**
 * 根据百分位判断估值状态
 */
function getValuationStatus(percentile: number): 'undervalued' | 'normal' | 'overvalued' {
  if (percentile <= 30) return 'undervalued'
  if (percentile >= 70) return 'overvalued'
  return 'normal'
}

// ========== 持有人结构 API ==========

/**
 * 持有人结构信息
 */
export interface HolderStructure {
  /** 机构持有比例(%) */
  institutionRatio: number
  /** 个人持有比例(%) */
  personalRatio: number
  /** 内部持有比例(%) */
  internalRatio: number
  /** 持有人户数 */
  holderCount: number
  /** 户均持有金额(元) */
  avgHolding: number
  /** 报告日期 */
  reportDate: string
}

/**
 * 获取基金持有人结构
 * [WHY] 机构持有比例高可能说明基金受专业投资者认可
 */
export async function fetchHolderStructure(fundCode: string): Promise<HolderStructure> {
  const cacheKey = `holder_${fundCode}`
  const cached = cache.get<HolderStructure>(cacheKey)
  if (cached) return cached
  
  const defaultData: HolderStructure = {
    institutionRatio: 0,
    personalRatio: 100,
    internalRatio: 0,
    holderCount: 0,
    avgHolding: 0,
    reportDate: '--'
  }
  
  try {
    // [WHAT] 从天天基金获取持有人结构
    const url = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js?v=${Date.now()}`
    const text = await http.text(url)
    
    // [WHAT] 解析持有人结构数据
    // 格式：var Data_holderStructure = {...}
    const match = text.match(/var\s+Data_holderStructure\s*=\s*(\{[\s\S]*?\});/)
    if (match) {
      const data = JSON.parse(match[1]!)
      const latestIdx = data.categories.length - 1
      if (latestIdx >= 0) {
        defaultData.reportDate = data.categories[latestIdx] || '--'
        // series[0] 机构, series[1] 个人, series[2] 内部
        defaultData.institutionRatio = data.series[0]?.data?.[latestIdx] || 0
        defaultData.personalRatio = data.series[1]?.data?.[latestIdx] || 100
        defaultData.internalRatio = data.series[2]?.data?.[latestIdx] || 0
      }
    }
    
    cache.set(cacheKey, defaultData, CACHE_TTL.LONG)
    return defaultData
  } catch (error) {
    logger.error('[API] 获取持有人结构失败', error)
    return defaultData
  }
}

// ========== 基金业绩排名 API ==========

/**
 * 同类排名信息
 */
export interface FundRankInfo {
  /** 近1周排名 */
  rank1w: { rank: number; total: number; percentile: number }
  /** 近1月排名 */
  rank1m: { rank: number; total: number; percentile: number }
  /** 近3月排名 */
  rank3m: { rank: number; total: number; percentile: number }
  /** 近6月排名 */
  rank6m: { rank: number; total: number; percentile: number }
  /** 近1年排名 */
  rank1y: { rank: number; total: number; percentile: number }
  /** 成立以来排名 */
  rankTotal: { rank: number; total: number; percentile: number }
}

/**
 * 获取基金同类排名
 * [WHY] 排名是评估基金业绩的重要指标
 */
export async function fetchFundRankInfo(fundCode: string): Promise<FundRankInfo | null> {
  const cacheKey = `rankinfo_${fundCode}`
  const cached = cache.get<FundRankInfo>(cacheKey)
  if (cached) return cached
  
  try {
    const url = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js?v=${Date.now()}`
    const text = await http.text(url)
    
    // [WHAT] 解析同类排名数据
    // 格式：var Data_rateInSimilarType = [...]
    const match = text.match(/var\s+Data_rateInSimilarType\s*=\s*(\[[\s\S]*?\]);/)
    if (!match) return null
    
    const data = JSON.parse(match[1]!)
    
    const parseRank = (item: [string, number, number] | undefined) => {
      if (!item) return { rank: 0, total: 0, percentile: 0 }
      const rank = item[1] || 0
      const total = item[2] || 1
      const percentile = Math.round((1 - rank / total) * 100)
      return { rank, total, percentile }
    }
    
    const result: FundRankInfo = {
      rank1w: parseRank(data[0]),
      rank1m: parseRank(data[1]),
      rank3m: parseRank(data[2]),
      rank6m: parseRank(data[3]),
      rank1y: parseRank(data[4]),
      rankTotal: parseRank(data[5])
    }
    
    cache.set(cacheKey, result, CACHE_TTL.FUND_INFO)
    return result
  } catch (error) {
    logger.error('[API] 获取基金排名失败', error)
    return null
  }
}
