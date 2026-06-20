<template>
  <div class="market-page">
    <!-- 导航栏 -->
    <div class="page-header">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="header-title">市场概览</span>
      <van-icon name="replay" size="20" :class="{ refreshing: isRefreshing }" @click="refreshData" />
    </div>

    <div class="scroll-content">
      <!-- 交易状态 -->
      <div class="trading-status-bar">
        <span class="status-dot" :class="tradingSession"></span>
        <span class="status-text">{{ sessionLabel }}</span>
        <span class="status-time">{{ currentTimeText }}</span>
      </div>

      <!-- A股指数 -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">A股指数</span>
        </div>
        <div class="index-grid">
          <div
            v-for="idx in indices"
            :key="idx.code"
            class="index-card"
            :class="[idx.changePercent >= 0 ? 'up' : 'down']"
          >
            <div class="index-name">{{ idx.name }}</div>
            <div class="index-price">{{ idx.current.toFixed(2) }}</div>
            <div class="index-change">
              <span>{{ idx.changePercent >= 0 ? '+' : '' }}{{ idx.changePercent.toFixed(2) }}%</span>
              <span class="index-points">{{ idx.change >= 0 ? '+' : '' }}{{ idx.change.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 全球指数 -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">全球指数</span>
          <span class="section-tip" v-if="globalIndices.length > 0">{{ globalIndices.length }}个市场</span>
        </div>
        <div class="index-grid">
          <div
            v-for="idx in globalIndices"
            :key="idx.code"
            class="index-card"
            :class="[idx.changePercent >= 0 ? 'up' : 'down']"
          >
            <div class="index-name">{{ idx.name }}</div>
            <div class="index-region" v-if="idx.region">{{ idx.region }}</div>
            <div class="index-price">{{ idx.price.toFixed(2) }}</div>
            <div class="index-change">
              <span>{{ idx.changePercent >= 0 ? '+' : '' }}{{ idx.changePercent.toFixed(2) }}%</span>
              <span class="index-points">{{ idx.change >= 0 ? '+' : '' }}{{ idx.change.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载/错误状态 -->
      <div v-if="isLoading" class="loading-state">
        <van-loading size="24">加载市场数据...</van-loading>
      </div>
      <div v-else-if="indices.length === 0 && globalIndices.length === 0" class="empty-state">
        <van-icon name="info-o" size="48" :style="{ color: 'var(--van-text-color-3)' }" />
        <p class="empty-text">暂无数据，请稍后重试</p>
        <van-button type="primary" size="small" round @click="refreshData">重新加载</van-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchMarketIndicesFast, fetchGlobalIndices, type MarketIndexSimple, type GlobalIndex } from '@/api/fundFast'
import { getTradingSession, type TradingSession } from '@/api/tiantianApi'
import { logger } from '@/utils/logger'

const router = useRouter()

const indices = ref<MarketIndexSimple[]>([])
const globalIndices = ref<GlobalIndex[]>([])
const isLoading = ref(true)
const isRefreshing = ref(false)
const tradingSession = ref<TradingSession>('closed')
const currentTime = ref(new Date())

let timer: number | undefined

const sessionLabel = computed(() => {
  const map: Record<string, string> = {
    morning: '⏳ 上午交易中 (09:30-11:30)',
    afternoon: '⏳ 下午交易中 (13:00-15:00)',
    noon_break: '☕ 午间休市 (11:30-13:00)',
    pre_market: '🔔 等待开盘',
    post_market: '🔒 已收盘',
    closed: '🔒 非交易日',
  }
  return map[tradingSession.value] || '未知'
})

const currentTimeText = computed(() => {
  return currentTime.value.toLocaleTimeString('zh-CN', { hour12: false })
})

function updateSession() {
  tradingSession.value = getTradingSession()
  currentTime.value = new Date()
}

async function refreshData() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    const [idxRes, globalRes] = await Promise.all([
      fetchMarketIndicesFast(),
      fetchGlobalIndices(),
    ])
    indices.value = idxRes
    globalIndices.value = globalRes
    logger.info('[Market] 数据刷新成功', { indices: idxRes.length, global: globalRes.length })
  } catch (err) {
    logger.error('[Market] 刷新失败', err)
  } finally {
    isRefreshing.value = false
    isLoading.value = false
  }
}

onMounted(() => {
  updateSession()
  timer = window.setInterval(updateSession, 1000)
  refreshData()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.market-page {
  min-height: 100vh;
  background: var(--bg-primary, #f5f5f5);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--van-background-2, #fff);
  border-bottom: 1px solid var(--van-border-color, #eee);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--van-text-color, #333);
}

.refreshing {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.scroll-content {
  padding: 12px 16px;
  padding-bottom: 40px;
}

.trading-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--van-background-2, #fff);
  border-radius: 10px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--van-text-color-2, #666);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.morning,
.status-dot.afternoon {
  background: #07c160;
  box-shadow: 0 0 6px rgba(7, 193, 96, 0.5);
}

.status-dot.noon_break {
  background: #ff9800;
}

.status-dot.pre_market {
  background: #1989fa;
}

.status-dot.post_market,
.status-dot.closed {
  background: #999;
}

.status-time {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--van-text-color, #333);
}

.section-tip {
  font-size: 12px;
  color: var(--van-text-color-3, #999);
}

.index-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.index-card {
  background: var(--van-background-2, #fff);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: transform 0.15s;
}

.index-card:active {
  transform: scale(0.97);
}

.index-card.up {
  border-left: 3px solid #e4393c;
}

.index-card.down {
  border-left: 3px solid #1db82c;
}

.index-name {
  font-size: 13px;
  color: var(--van-text-color-2, #666);
  margin-bottom: 6px;
}

.index-region {
  font-size: 11px;
  color: var(--van-text-color-3, #999);
  margin-top: -4px;
  margin-bottom: 6px;
}

.index-price {
  font-size: 20px;
  font-weight: 700;
  color: var(--van-text-color, #333);
  font-variant-numeric: tabular-nums;
  margin-bottom: 4px;
}

.index-change {
  font-size: 13px;
  font-weight: 500;
}

.index-card.up .index-change {
  color: #e4393c;
}

.index-card.down .index-change {
  color: #1db82c;
}

.index-points {
  margin-left: 6px;
  font-size: 12px;
  opacity: 0.7;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.empty-text {
  margin: 12px 0 20px;
  font-size: 14px;
  color: var(--van-text-color-3, #999);
}
</style>