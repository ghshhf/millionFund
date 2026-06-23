<template>
  <div class="trades-page">
    <!-- 导航栏 -->
    <div class="page-header">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="header-title">交易记录</span>
      <van-icon name="plus" size="22" @click="showPopup = true" />
    </div>

    <div class="scroll-content">
      <!-- 基金信息 -->
      <div class="fund-info" v-if="fundName">
        <span class="fund-name">{{ fundName }}</span>
        <span class="fund-code">{{ fundCode }}</span>
      </div>

      <!-- 空状态 -->
      <div v-if="fundTrades.length === 0" class="empty-state">
        <van-icon name="records-o" size="48" :style="{ color: 'var(--van-text-color-3)' }" />
        <p class="empty-text">暂无交易记录</p>
        <p class="empty-hint">点击右上角 + 添加第一条记录</p>
      </div>

      <!-- 交易记录列表 -->
      <div v-else class="trade-list">
        <div
          v-for="trade in fundTrades"
          :key="trade.id"
          class="trade-card"
        >
          <div class="trade-header">
            <span :class="['trade-type', trade.type]">{{ typeLabel(trade.type) }}</span>
            <span class="trade-date">{{ trade.date }}</span>
          </div>
          <div class="trade-body">
            <div class="trade-item">
              <span class="label">金额</span>
              <span class="value">¥{{ trade.amount.toFixed(2) }}</span>
            </div>
            <div class="trade-item" v-if="trade.price">
              <span class="label">净值</span>
              <span class="value">{{ trade.price.toFixed(4) }}</span>
            </div>
            <div class="trade-item" v-if="trade.shares">
              <span class="label">份额</span>
              <span class="value">{{ trade.shares.toFixed(2) }}</span>
            </div>
            <div class="trade-item" v-if="trade.note">
              <span class="label">备注</span>
              <span class="value">{{ trade.note }}</span>
            </div>
          </div>
          <div class="trade-actions">
            <van-button size="mini" type="danger" plain round @click="onDelete(trade.id)">删除</van-button>
          </div>
        </div>
      </div>

      <div class="bottom-spacer"></div>
    </div>

    <!-- 添加记录弹窗 -->
    <van-popup
      v-model:show="showPopup"
      position="bottom"
      round
      :style="{ height: '75%' }"
    >
      <div class="popup-header">
        <span>添加交易记录</span>
        <van-icon name="cross" @click="showPopup = false" />
      </div>
      <div class="popup-body">
        <van-form @submit="onSubmit">
          <van-field
            v-model="form.type"
            name="type"
            label="类型"
            :rules="[{ required: true, message: '请选择类型' }]"
          >
            <template #input>
              <van-radio-group v-model="form.type" direction="horizontal">
                <van-radio name="buy">买入</van-radio>
                <van-radio name="sell">卖出</van-radio>
                <van-radio name="dividend">分红</van-radio>
              </van-radio-group>
            </template>
          </van-field>

          <van-field
            v-model="form.amount"
            type="number"
            name="amount"
            label="金额 (¥)"
            placeholder="请输入金额"
            :rules="[{ required: true, message: '请输入金额' }]"
          />

          <van-field
            v-model="form.price"
            type="number"
            name="price"
            label="净值"
            placeholder="请输入净值"
          />

          <van-field
            v-model="form.shares"
            type="number"
            name="shares"
            label="份额"
            placeholder="请输入份额"
          />

          <van-field
            v-model="form.date"
            name="date"
            label="日期"
            placeholder="请选择日期"
            :rules="[{ required: true, message: '请选择日期' }]"
            @click="showDatePicker = true"
          />
          <van-popup v-model:show="showDatePicker" position="bottom">
            <van-datetime-picker
              v-model="currentDate"
              type="date"
              title="选择日期"
              @confirm="onDateConfirm"
              @cancel="showDatePicker = false"
            />
          </van-popup>

          <van-field
            v-model="form.note"
            name="note"
            label="备注"
            placeholder="可选备注"
          />

          <div style="margin: 16px;">
            <van-button round block type="primary" native-type="submit">提交</van-button>
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { useTradeStore } from '@/stores/trade'
import { useHoldingStore } from '@/stores/holding'
import type { TradeRecord } from '@/utils/storage'

const router = useRouter()
const route = useRoute()
const tradeStore = useTradeStore()
const holdingStore = useHoldingStore()

const fundCode = route.params.code as string
const fund = holdingStore.holdings.find(h => h.code === fundCode)
const fundName = fund?.name || ''

const fundTrades = computed(() => {
  return tradeStore.trades.filter(t => t.fundCode === fundCode)
})

const showPopup = ref(false)
const showDatePicker = ref(false)
const currentDate = ref(new Date())

const form = ref({
  type: 'buy' as 'buy' | 'sell' | 'dividend',
  amount: '',
  price: '',
  shares: '',
  date: '',
  note: '',
})

function typeLabel(type: string) {
  switch (type) {
    case 'buy': return '买入'
    case 'sell': return '卖出'
    case 'dividend': return '分红'
    default: return type
  }
}

function onDateConfirm(val: Date) {
  const y = val.getFullYear()
  const m = String(val.getMonth() + 1).padStart(2, '0')
  const d = String(val.getDate()).padStart(2, '0')
  form.value.date = `${y}-${m}-${d}`
  showDatePicker.value = false
}

function onSubmit() {
  const trade: TradeRecord = {
    id: Date.now().toString(),
    fundCode,
    fundName,
    type: form.value.type,
    amount: parseFloat(form.value.amount) || 0,
    price: parseFloat(form.value.price) || 0,
    shares: parseFloat(form.value.shares) || 0,
    date: form.value.date,
    note: form.value.note,
  }
  tradeStore.addTrade(trade)
  showPopup.value = false
  form.value = { type: 'buy', amount: '', price: '', shares: '', date: '', note: '' }
}

function onDelete(id: string) {
  showConfirmDialog({
    title: '确认删除',
    message: '确定要删除这条交易记录吗？',
  }).then(() => {
    tradeStore.deleteTrade(id)
  }).catch(() => {})
}

onMounted(() => {
  tradeStore.loadTrades()
})
</script>

<style scoped>
.trades-page {
  height: 100%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  padding-top: max(12px, env(safe-area-inset-top, 0px));
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.scroll-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 16px;
}

.fund-info {
  margin-bottom: 12px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.fund-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.fund-code {
  font-size: 12px;
  color: var(--text-muted);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-text {
  margin: 12px 0 4px;
  font-size: 15px;
  color: var(--text-primary);
}

.empty-hint {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--text-muted);
}

.trade-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trade-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px;
}

.trade-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.trade-type {
  font-size: 13px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.trade-type.buy {
  color: #e4393c;
  background: #fef0ef;
}

.trade-type.sell {
  color: #1db82c;
  background: #e8f8ed;
}

.trade-type.dividend {
  color: #1677ff;
  background: #e6f0ff;
}

.trade-date {
  font-size: 12px;
  color: var(--text-muted);
}

.trade-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.trade-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.trade-item .label {
  font-size: 11px;
  color: var(--text-muted);
}

.trade-item .value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.trade-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.popup-body {
  padding: 12px 16px;
  overflow-y: auto;
}

.bottom-spacer {
  height: 40px;
}
</style>
