<template>
  <div class="trades-page">
    <div class="page-header">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="header-title">交易记录</span>
      <span></span>
    </div>

    <div class="scroll-content">
      <!-- 快捷入口 -->
      <div class="quick-actions">
        <div class="action-card" @click="router.push('/search')">
          <van-icon name="plus" size="24" color="#1989fa" />
          <span>添加交易</span>
        </div>
        <div class="action-card" @click="router.push('/holding')">
          <van-icon name="balance-list-o" size="24" color="#07c160" />
          <span>查看持仓</span>
        </div>
      </div>

      <!-- 持仓基金列表 -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">持仓基金（{{ holdings.length }}）</span>
        </div>

        <div v-if="holdings.length === 0" class="empty-state">
          <van-icon name="info-o" size="48" :style="{ color: 'var(--van-text-color-3)' }" />
          <p class="empty-text">暂无交易记录</p>
          <p class="empty-hint">添加持仓后，交易记录将自动显示在这里</p>
          <van-button type="primary" size="small" round @click="router.push('/search')">去添加基金</van-button>
        </div>

        <div v-else class="holding-list">
          <div
            v-for="h in holdings"
            :key="h.code"
            class="holding-card"
            @click="router.push(`/detail/${h.code}`)"
          >
            <div class="holding-header">
              <span class="holding-name">{{ h.name || h.code }}</span>
              <span class="holding-code">{{ h.code }}</span>
            </div>
            <div class="holding-body">
              <div class="holding-item">
                <span class="label">持有份额</span>
                <span class="value">{{ formatNum(h.shares) }}</span>
              </div>
              <div class="holding-item">
                <span class="label">成本净值</span>
                <span class="value">{{ formatPrice(h.buyNetValue) }}</span>
              </div>
              <div class="holding-item">
                <span class="label">市值</span>
                <span class="value">{{ formatPrice(h.marketValue) }}</span>
              </div>
              <div class="holding-item">
                <span class="label">收益</span>
                <span class="value" :class="(h.profit ?? 0) >= 0 ? 'profit' : 'loss'">
                  {{ (h.profit ?? 0) >= 0 ? '+' : '' }}{{ formatPrice(h.profit) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 买入记录 -->
      <div class="section" v-if="holdings.length > 0">
        <div class="section-header">
          <span class="section-title">持仓详情</span>
        </div>
        <div class="record-list">
          <div
            v-for="(h, i) in holdings"
            :key="i"
            class="record-card"
          >
            <div class="record-header">
              <span class="record-fund">{{ h.name || h.code }}</span>
              <span class="record-type buy">持有中</span>
            </div>
            <div class="record-body">
              <span>成本: {{ formatPrice(h.buyNetValue) }}</span>
              <span v-if="h.shares">份额: {{ formatNum(h.shares) }}</span>
              <span v-if="h.buyDate">日期: {{ h.buyDate }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useHoldingStore } from '@/stores/holding'

const router = useRouter()
const holdingStore = useHoldingStore()

const holdings = holdingStore.holdings

function formatPrice(v: number | undefined | null): string {
  if (v === undefined || v === null) return '--'
  return '¥' + v.toFixed(2)
}

function formatNum(v: number | undefined | null): string {
  if (v === undefined || v === null) return '--'
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
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

.quick-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.action-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: var(--van-background-2, #fff);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  font-size: 13px;
  color: var(--van-text-color, #333);
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
}
.empty-state.small {
  padding: 24px;
}

.empty-text {
  margin: 12px 0 4px;
  font-size: 15px;
  color: var(--van-text-color, #333);
}

.empty-hint {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--van-text-color-3, #999);
}

.holding-card {
  background: var(--van-background-2, #fff);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.holding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.holding-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--van-text-color, #333);
}

.holding-code {
  font-size: 12px;
  color: var(--van-text-color-3, #999);
}

.holding-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.holding-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.holding-item .label {
  font-size: 12px;
  color: var(--van-text-color-3, #999);
}

.holding-item .value {
  font-size: 14px;
  font-weight: 500;
  color: var(--van-text-color, #333);
}

.holding-item .value.profit {
  color: #e4393c;
}

.holding-item .value.loss {
  color: #1db82c;
}

.record-card {
  background: var(--van-background-2, #fff);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.record-fund {
  font-size: 14px;
  font-weight: 500;
  color: var(--van-text-color, #333);
}

.record-type {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}
.record-type.buy { color: #e4393c; background: #fef0ef; }
.record-type.sell { color: #1db82c; background: #e8f8ed; }

.record-body {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--van-text-color-2, #666);
}
</style>
