<template>
  <div class="trades-page">
    <!-- 导航栏 -->
    <div class="page-header">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="header-title">交易记录</span>
      <div style="width: 22px"></div>
    </div>

    <div class="scroll-content">
      <!-- 基金信息卡片 -->
      <div class="fund-summary-card" v-if="fundInfo">
        <div class="fund-code-badge">{{ fundCode }}</div>
        <div class="fund-name">{{ fundInfo.name || fundInfo.fundName || fundCode }}</div>
        <div class="fund-meta">
          <span v-if="fundInfo.fundType">{{ fundInfo.fundType }}</span>
          <span v-if="fundInfo.fundScale">规模 {{ fundInfo.fundScale.toFixed(2) }}亿</span>
        </div>
      </div>
      <div class="fund-summary-card loading" v-else-if="isLoading">
        <van-loading size="20" vertical>加载中...</van-loading>
      </div>

      <!-- 交易记录列表 -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">历史交易</span>
        </div>

        <div v-if="tradeRecords.length > 0" class="trade-list">
          <div v-for="item in tradeRecords" :key="item.id" class="trade-item">
            <div class="trade-left">
              <div class="trade-type" :style="{ color: typeConfig[item.type]?.color }">
                {{ typeConfig[item.type]?.label || item.type }}
              </div>
              <div class="trade-date">{{ item.date }}</div>
            </div>
            <div class="trade-right">
              <div class="trade-amount" :style="{ color: item.type === 'sell' ? '#1db82c' : '#e4393c' }">
                {{ item.type === 'sell' ? '-' : '+' }}{{ item.amount.toFixed(2) }}元
              </div>
              <div class="trade-detail">
                净值 {{ item.netValue.toFixed(4) }} · {{ item.shares.toFixed(2) }}份
                <span v-if="item.fee > 0"> · 手续费 {{ item.fee.toFixed(2) }}元</span>
              </div>
              <div class="trade-remark" v-if="item.remark">{{ item.remark }}</div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <van-icon name="notes-o" size="56" :style="{ color: 'var(--van-text-color-3)' }" />
          <p class="empty-text">暂无交易记录</p>
          <van-button type="primary" size="small" round @click="router.push(`/detail/${fundCode}`)">查看基金详情</van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { TradeRecord } from '@/types/fund'
import { TRADE_TYPE_CONFIG } from '@/types/fund'
import { fetchFundAccurateData } from '@/api/fundFast'
import { getHoldings } from '@/utils/storage'
import { logger } from '@/utils/logger'

const route = useRoute()
const router = useRouter()

const fundCode = route.params.code as string
const typeConfig = TRADE_TYPE_CONFIG

const fundInfo = ref<any>(null)
const isLoading = ref(true)
const tradeRecords = ref<TradeRecord[]>([])

onMounted(async () => {
  try {
    // 尝试从持仓中获取交易记录
    const holdings = getHoldings()
    const holding = holdings.find(h => h.code === fundCode)

    // 获取基金基本信息
    const accurateData = await fetchFundAccurateData(fundCode).catch(() => null)
    if (accurateData) {
      fundInfo.value = {
        name: accurateData.name,
        fundName: accurateData.name,
        fundType: accurateData.fundType,
        fundScale: accurateData.fundScale,
      }
    } else if (holding) {
      fundInfo.value = { name: holding.name, fundName: holding.name }
    }
  } catch (err) {
    logger.error('[Trades] 加载基金信息失败', err)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.trades-page {
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

.scroll-content {
  padding: 12px 16px;
  padding-bottom: 40px;
}

.fund-summary-card {
  background: var(--van-background-2, #fff);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.fund-summary-card.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80px;
}

.fund-code-badge {
  display: inline-block;
  font-size: 12px;
  padding: 2px 8px;
  background: var(--van-primary-color, #1989fa);
  color: #fff;
  border-radius: 4px;
  margin-bottom: 8px;
}

.fund-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--van-text-color, #333);
  margin-bottom: 6px;
}

.fund-meta {
  font-size: 13px;
  color: var(--van-text-color-2, #666);
  display: flex;
  gap: 12px;
}

.section {
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--van-text-color, #333);
}

.trade-list {
  background: var(--van-background-2, #fff);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.trade-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--van-border-color, #f0f0f0);
}

.trade-item:last-child {
  border-bottom: none;
}

.trade-left {
  flex-shrink: 0;
}

.trade-type {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.trade-date {
  font-size: 12px;
  color: var(--van-text-color-3, #999);
}

.trade-right {
  text-align: right;
}

.trade-amount {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.trade-detail {
  font-size: 12px;
  color: var(--van-text-color-2, #666);
}

.trade-remark {
  font-size: 12px;
  color: var(--van-text-color-3, #999);
  margin-top: 2px;
  font-style: italic;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background: var(--van-background-2, #fff);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.empty-text {
  margin: 12px 0 20px;
  font-size: 14px;
  color: var(--van-text-color-3, #999);
}
</style>