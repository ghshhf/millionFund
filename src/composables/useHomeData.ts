// [WHY] 首页数据 composable - 分离数据获取逻辑与 UI 渲染
// [WHAT] 集中管理大盘指数、全球指数、交易状态等数据的获取和缓存
// [USAGE] const { indices, globalIndices, tradingSession, refreshAll, loadIndices, loadGlobalIndices } = useHomeData()

import { ref, onMounted, onUnmounted } from 'vue'
import { fetchMarketIndicesFast, fetchGlobalIndices, type MarketIndexSimple, type GlobalIndex } from '@/api/fundFast'
import { getTradingSession, type TradingSession } from '@/api/tiantianApi'
import { logger } from '@/utils/logger'

export function useHomeData() {
  // 大盘指数
  const indices = ref<MarketIndexSimple[]>([])
  
  // 全球指数
  const globalIndices = ref<GlobalIndex[]>([])
  
  // 当前交易时段
  const tradingSession = ref<TradingSession>('closed')
  
  // 当前时间（每秒更新）
  const currentTime = ref(new Date())
  
  // 刷新状态
  const isRefreshing = ref(false)
  
  // 交易状态定时器
  let tradingSessionInterval: number | undefined
  
  // [WHAT] 加载大盘指数
  async function loadIndices() {
    try {
      logger.debug('loadIndices start')
      indices.value = await fetchMarketIndicesFast()
      logger.info('loadIndices ok', { count: indices.value.length })
    } catch (err) {
      logger.error('loadIndices failed', err)
    }
  }
  
  // [WHAT] 加载全球指数
  async function loadGlobalIndices() {
    try {
      logger.debug('loadGlobalIndices start')
      globalIndices.value = await fetchGlobalIndices()
      logger.info('loadGlobalIndices ok', { count: globalIndices.value.length })
    } catch (err) {
      logger.error('loadGlobalIndices failed', err)
    }
  }
  
  // [WHAT] 更新交易状态
  function updateTradingSession() {
    tradingSession.value = getTradingSession()
    currentTime.value = new Date()
  }
  
  // [WHAT] 刷新所有市场数据
  async function refreshAll() {
    if (isRefreshing.value) return
    isRefreshing.value = true
    logger.info('refreshData start')
    try {
      await Promise.all([
        loadIndices(),
        loadGlobalIndices(),
      ])
      logger.info('refreshData ok', {
        indicesCount: indices.value.length,
        globalCount: globalIndices.value.length,
      })
    } catch (err) {
      logger.error('refreshData failed', err)
    } finally {
      isRefreshing.value = false
    }
  }
  
  // [WHAT] 初始化数据
  function init() {
    updateTradingSession()
    // 每秒更新交易状态，确保秒钟显示准确
    tradingSessionInterval = window.setInterval(updateTradingSession, 1000)
  }
  
  // [WHAT] 清理定时器
  function cleanup() {
    if (tradingSessionInterval) {
      clearInterval(tradingSessionInterval)
      tradingSessionInterval = undefined
    }
  }
  
  onMounted(init)
  onUnmounted(cleanup)
  
  return {
    // 状态
    indices,
    globalIndices,
    tradingSession,
    currentTime,
    isRefreshing,
    // 方法
    loadIndices,
    loadGlobalIndices,
    updateTradingSession,
    refreshAll,
    cleanup,
  }
}
