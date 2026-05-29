<template>
  <div class="ai-tracking-page">
    <div class="page-header">
      <h1 class="page-title">
        AI 追踪
        <span class="success-rate-title" v-if="records.length > 0">调仓成功率</span>
        <span class="success-rate" v-if="records.length > 0">({{ successRate }}%)</span>
      </h1>
      <div class="header-actions">
        <van-icon name="replay" size="20" @click="refreshPrices" />
        <van-button size="small" type="primary" @click="showAddModal = true" style="margin-left: 8px;">
          <van-icon name="plus" /> 添加
        </van-button>
      </div>
    </div>

    <div class="records-list" v-if="records.length > 0">
      <div 
        v-for="record in records" 
        :key="record.id" 
        class="record-card"
        @click="selectRecord(record)"
      >
        <div class="record-header">
          <span class="record-date">{{ formatDate(record.date) }}</span>
          <span class="record-status" :class="getStatusClass(record)">{{ getStatusText(record) }}</span>
          <span class="record-calc" v-html="getCalcProcessCombined(record)"></span>
        </div>
        <div class="record-content">
          <div class="fund-item sell">
            <div class="fund-label">卖</div>
            <div class="fund-info">
              <div class="fund-name">{{ record.sellName || record.sellCode }}</div>
              <div class="fund-row">
                <span class="fund-code">{{ record.sellCode }}</span>
                <span class="fund-change-mobile" :class="getChangeClass(record, 'sell')">
                  {{ getChangeText(record, 'sell') }}
                </span>
              </div>
            </div>
            <div class="fund-change-right" :class="getChangeClass(record, 'sell')">
              {{ getChangeText(record, 'sell') }}
            </div>
          </div>
          <div class="fund-item buy">
            <div class="fund-label">买</div>
            <div class="fund-info">
              <div class="fund-name">{{ record.buyName || record.buyCode }}</div>
              <div class="fund-row">
                <span class="fund-code">{{ record.buyCode }}</span>
                <span class="fund-change-mobile" :class="getChangeClass(record, 'buy')">
                  {{ getChangeText(record, 'buy') }}
                </span>
              </div>
            </div>
            <div class="fund-change-right" :class="getChangeClass(record, 'buy')">
              {{ getChangeText(record, 'buy') }}
            </div>
          </div>
        </div>
        <div class="record-actions">
          <van-icon name="delete-o" @click.stop="deleteRecord(record.id)" />
        </div>
      </div>
    </div>

    <van-empty v-else description="暂无调仓记录，点击右上角添加" />

    <van-dialog
      v-model:show="showAddModal"
      title="添加调仓记录"
      show-cancel-button
      @confirm="confirmAddRecord"
    >
      <div class="add-form">
        <div class="form-item">
          <label>调仓日期（可选）</label>
          <van-field
            v-model="newRecord.date"
            type="date"
            placeholder="不填则使用今日最新净值"
          />
        </div>
        <div class="form-item">
          <label>卖出基金代码</label>
          <van-field
            v-model="newRecord.sellCode"
            placeholder="请输入基金代码"
            @blur="fetchFundInfo('sell')"
          />
          <div class="fund-name-preview" v-if="newRecord.sellName">
            {{ newRecord.sellName }}
          </div>
        </div>
        <div class="form-item">
          <label>买入基金代码</label>
          <van-field
            v-model="newRecord.buyCode"
            placeholder="请输入基金代码"
            @blur="fetchFundInfo('buy')"
          />
          <div class="fund-name-preview" v-if="newRecord.buyName">
            {{ newRecord.buyName }}
          </div>
        </div>
      </div>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { showToast, showLoadingToast, closeToast } from 'vant'
import { useAITrackingStore, type AITrackingRecord } from '@/stores/aiTracking'
import { fetchFundAccurateData, fetchNetValueHistoryFast } from '@/api/fundFast'

const aiTrackingStore = useAITrackingStore()

const records = computed(() => aiTrackingStore.records)

const successRate = computed(() => {
  if (records.value.length === 0) return 0
  
  let successCount = 0
  for (const record of records.value) {
    const sellPrice = fundPrices.value[record.sellCode]
    const buyPrice = fundPrices.value[record.buyCode]
    
    if (!sellPrice || !buyPrice || !record.sellNav || !record.buyNav) continue
    
    const sellChange = ((sellPrice - record.sellNav) / record.sellNav) * 100
    const buyChange = ((buyPrice - record.buyNav) / record.buyNav) * 100
    
    if (buyChange >= sellChange) {
      successCount++
    }
  }
  
  return Math.round((successCount / records.value.length) * 100)
})

const showAddModal = ref(false)

interface NewRecord {
  date: string
  sellCode: string
  sellName: string
  buyCode: string
  buyName: string
}

const newRecord = ref<NewRecord>({
  date: '',
  sellCode: '',
  sellName: '',
  buyCode: '',
  buyName: ''
})

function resetNewRecord() {
  newRecord.value = {
    date: '',
    sellCode: '',
    sellName: '',
    buyCode: '',
    buyName: ''
  }
}

async function fetchFundInfo(type: 'sell' | 'buy') {
  const code = type === 'sell' ? newRecord.value.sellCode : newRecord.value.buyCode
  if (!code) return

  try {
    const fundInfo = await fetchFundAccurateData(code)
    if (fundInfo) {
      if (type === 'sell') {
        newRecord.value.sellName = fundInfo.name
      } else {
        newRecord.value.buyName = fundInfo.name
      }
    }
  } catch (e) {
    console.error('Failed to fetch fund info:', e)
  }
}

async function confirmAddRecord() {
  if (!newRecord.value.sellCode || !newRecord.value.buyCode) {
    showToast('请填写基金代码')
    return
  }

  showLoadingToast('添加中...')

  try {
    let sellName = newRecord.value.sellName
    let buyName = newRecord.value.buyName
    let sellNav = 0
    let buyNav = 0
    const targetDate = newRecord.value.date || new Date().toISOString().split('T')[0]

    if (newRecord.value.date) {
      const historyDays = Math.ceil((new Date().getTime() - new Date(newRecord.value.date).getTime()) / (1000 * 60 * 60 * 24)) + 10
      
      const [sellHistory, buyHistory] = await Promise.all([
        fetchNetValueHistoryFast(newRecord.value.sellCode, historyDays),
        fetchNetValueHistoryFast(newRecord.value.buyCode, historyDays)
      ])

      const sellRecord = sellHistory.find(r => r.date === newRecord.value.date)
      const buyRecord = buyHistory.find(r => r.date === newRecord.value.date)

      if (sellRecord && buyRecord) {
        sellName = sellName || newRecord.value.sellCode
        buyName = buyName || newRecord.value.buyCode
        sellNav = sellRecord.netValue
        buyNav = buyRecord.netValue
      } else {
        if (!sellRecord) {
          sellName = (newRecord.value.sellName || newRecord.value.sellCode) + ' (未查询到净值)'
        }
        if (!buyRecord) {
          buyName = (newRecord.value.buyName || newRecord.value.buyCode) + ' (未查询到净值)'
        }
        if (!sellRecord && !buyRecord) {
          showToast('两只基金的净值都未查询到')
          closeToast()
          return
        }
        showToast('部分基金净值未查询到')
      }
    } else {
      const [sellInfo, buyInfo] = await Promise.all([
        fetchFundAccurateData(newRecord.value.sellCode),
        fetchFundAccurateData(newRecord.value.buyCode)
      ])
      if (sellInfo) {
        sellName = sellInfo.name
        sellNav = sellInfo.currentValue
      } else {
        showToast('获取卖出基金信息失败')
        closeToast()
        return
      }
      if (buyInfo) {
        buyName = buyInfo.name
        buyNav = buyInfo.currentValue
      } else {
        showToast('获取买入基金信息失败')
        closeToast()
        return
      }
    }

    aiTrackingStore.addRecord({
      sellCode: newRecord.value.sellCode,
      sellName: sellName,
      sellNav: sellNav,
      buyCode: newRecord.value.buyCode,
      buyName: buyName,
      buyNav: buyNav,
      date: targetDate
    })

    showToast('添加成功')
    resetNewRecord()
    showAddModal.value = false
  } catch (e) {
    showToast('添加失败')
    console.error(e)
  }
}

function deleteRecord(id: string) {
  aiTrackingStore.removeRecord(id)
  showToast('删除成功')
}

function selectRecord(record: AITrackingRecord) {
  // 可以跳转到详情页或者显示更多信息
}

function formatDate(dateStr: string) {
  return dateStr
}

const fundPrices = ref<Record<string, number>>({})
const isRefreshing = ref(false)
const autoRefreshEnabled = ref(false)
let autoRefreshInterval: number | null = null

async function refreshPrices() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  showLoadingToast('刷新中...')
  
  try {
    await fetchCurrentPrices()
    showToast('刷新成功')
  } catch (e) {
    showToast('刷新失败')
  } finally {
    isRefreshing.value = false
    closeToast()
  }
}

watch(autoRefreshEnabled, (newValue) => {
  if (newValue) {
    autoRefreshInterval = window.setInterval(() => {
      fetchCurrentPrices()
    }, 60000)
    showToast('自动刷新已开启')
  } else {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval)
      autoRefreshInterval = null
    }
    showToast('自动刷新已关闭')
  }
})

async function fetchCurrentPrices() {
  const codes = new Set<string>()
  records.value.forEach(r => {
    codes.add(r.sellCode)
    codes.add(r.buyCode)
  })

  for (const code of codes) {
    try {
      const info = await fetchFundAccurateData(code)
      fundPrices.value[code] = info?.currentValue || 0
    } catch (e) {
      console.error(`Failed to fetch price for ${code}:`, e)
    }
  }
}

function getChangeText(record: AITrackingRecord, type: 'sell' | 'buy') {
  const code = type === 'sell' ? record.sellCode : record.buyCode
  const nav = type === 'sell' ? record.sellNav : record.buyNav
  const currentPrice = fundPrices.value[code]
  
  if (!currentPrice || !nav) return '--'
  const change = ((currentPrice - nav) / nav) * 100
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
}

function getCalcProcess(record: AITrackingRecord, type: 'sell' | 'buy') {
  const code = type === 'sell' ? record.sellCode : record.buyCode
  const nav = type === 'sell' ? record.sellNav : record.buyNav
  const currentPrice = fundPrices.value[code]
  
  if (!currentPrice || !nav) return '--'
  const change = ((currentPrice - nav) / nav) * 100
  return `${currentPrice.toFixed(4)} - ${nav.toFixed(4)} = ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
}

function getMiddleText(text: string, len: number = 5): string {
  if (!text) return ''
  if (text.length <= len) return text
  const start = Math.floor((text.length - len) / 2)
  return text.substring(start, start + len)
}

function getCalcProcessCombined(record: AITrackingRecord) {
  const sellCode = record.sellCode
  const buyCode = record.buyCode
  const sellNav = record.sellNav
  const buyNav = record.buyNav
  const sellPrice = fundPrices.value[sellCode]
  const buyPrice = fundPrices.value[buyCode]
  
  if (!sellPrice || !buyPrice || !sellNav || !buyNav) return '--'
  
  const sellChange = ((sellPrice - sellNav) / sellNav) * 100
  const buyChange = ((buyPrice - buyNav) / buyNav) * 100
  
  return `卖出: ${sellPrice.toFixed(4)} - <span style="color:#1989fa">${sellNav.toFixed(4)}</span> = ${sellChange >= 0 ? '+' : ''}${sellChange.toFixed(2)}% 买入: ${buyPrice.toFixed(4)} - <span style="color:#1989fa">${buyNav.toFixed(4)}</span> = ${buyChange >= 0 ? '+' : ''}${buyChange.toFixed(2)}%`
}

function getStatusText(record: AITrackingRecord): string {
  const sellPrice = fundPrices.value[record.sellCode]
  const buyPrice = fundPrices.value[record.buyCode]
  
  if (!sellPrice || !buyPrice || !record.sellNav || !record.buyNav) return '--'
  
  const sellChange = ((sellPrice - record.sellNav) / record.sellNav) * 100
  const buyChange = ((buyPrice - record.buyNav) / record.buyNav) * 100
  
  return buyChange >= sellChange ? '调仓成功' : '调仓失败'
}

function getStatusClass(record: AITrackingRecord): string {
  const sellPrice = fundPrices.value[record.sellCode]
  const buyPrice = fundPrices.value[record.buyCode]
  
  if (!sellPrice || !buyPrice || !record.sellNav || !record.buyNav) return ''
  
  const sellChange = ((sellPrice - record.sellNav) / record.sellNav) * 100
  const buyChange = ((buyPrice - record.buyNav) / record.buyNav) * 100
  
  return buyChange >= sellChange ? 'success' : 'fail'
}

function getChangeClass(record: AITrackingRecord, type: 'sell' | 'buy') {
  const code = type === 'sell' ? record.sellCode : record.buyCode
  const nav = type === 'sell' ? record.sellNav : record.buyNav
  const currentPrice = fundPrices.value[code]
  
  if (!currentPrice || !nav) return ''
  return currentPrice > nav ? 'up' : 'down'
}

fetchCurrentPrices()

onUnmounted(() => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval)
  }
})
</script>

<style scoped>
.ai-tracking-page {
  height: 100%;
  background: var(--bg-primary);
  padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 16px 16px;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
  flex-shrink: 0;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.success-rate-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 16px;
}

.success-rate {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-refresh-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1;
  padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
}

.record-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 12px;
  position: relative;
}

.record-date {
  font-size: 12px;
  color: var(--text-muted);
}

.record-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.record-status {
  font-size: 12px;
  font-weight: 500;
}

.record-calc {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-number);
  display: block;
  margin-top: 4px;
}

.record-status.success {
  color: #ee0a24;
}

.record-status.fail {
  color: #07c160;
}

.record-content {
  display: flex;
  gap: 8px;
}

.fund-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  background: var(--bg-tertiary);
}

.fund-item.sell {
  border-left: 3px solid var(--color-down);
}

.fund-item.buy {
  border-left: 3px solid var(--color-up);
}

.fund-label {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

.sell .fund-label {
  background: var(--color-down);
}

.buy .fund-label {
  background: var(--color-up);
}

.fund-info {
  flex: 1;
  min-width: 0;
}

.fund-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  margin-bottom: 4px;
}

.fund-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fund-code {
  font-size: 10px;
  color: var(--text-muted);
}

.fund-change {
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font-number);
  flex-shrink: 0;
}

.fund-change.up,
.fund-change-mobile.up,
.fund-change-right.up {
  color: var(--color-up);
}

.fund-change.down,
.fund-change-mobile.down,
.fund-change-right.down {
  color: var(--color-down);
}

@media (min-width: 768px) {
  .fund-item {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 16px;
  }

  .fund-label {
    width: 24px;
    height: 24px;
    font-size: 13px;
    align-self: center;
    flex-shrink: 0;
  }

  .fund-info {
    flex: 1;
    min-width: 0;
  }

  .fund-name {
    font-size: 14px;
    max-width: 160px;
  }

  .fund-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .fund-change-mobile {
    display: none;
  }

  .fund-change-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    font-size: 28px;
    font-weight: 600;
    flex-shrink: 0;
    min-width: 100px;
  }
}

.fund-change-mobile {
  display: inline;
}

.fund-change-right {
  display: none;
}

.calc-process {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
  font-family: var(--font-number);
}

.fund-nav {
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-number);
  color: #1989fa;
  margin: 0 6px;
}

.record-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  color: var(--text-muted);
  font-size: 18px;
}

.add-form {
  padding: 16px;
}

.form-item {
  margin-bottom: 16px;
}

.form-item label {
  display: block;
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.fund-name-preview {
  font-size: 12px;
  color: var(--color-primary);
  margin-top: 4px;
}

@media (max-width: 767px) {
  .record-calc {
    display: none;
  }
}
</style>


