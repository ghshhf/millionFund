import { onMounted, onUnmounted } from 'vue'
import { useAlertsStore } from '@/stores/alerts'
import { useHoldingStore } from '@/stores/holding'
import { fetchFundEstimateFast } from '@/api/fundFast'
import { isTradingTime } from '@/api/tiantianApi'
import { showToast } from 'vant'

const CHECK_INTERVAL = 30000 // 30 秒

export function useAlertChecker() {
  let timer: ReturnType<typeof setInterval> | null = null

  async function checkAlerts() {
    if (!isTradingTime()) {
      // 非交易时间，不检查
      return
    }

    const alertsStore = useAlertsStore()
    const holdingStore = useHoldingStore()

    const { enabledRules } = alertsStore
    const { holdings } = holdingStore

    if (enabledRules.length === 0 || holdings.length === 0) {
      return
    }

    // 获取所有启用规则的基金代码
    const codesToCheck = new Set(enabledRules.map(r => r.fundCode))
    const estimates = new Map<string, { netValue: number; changeRate: number }>()

    // 批量获取估值
    await Promise.all(
      Array.from(codesToCheck).map(async (code) => {
        try {
          const est = await fetchFundEstimateFast(code)
          estimates.set(code, {
            netValue: parseFloat(est.gsz) || 0,
            changeRate: parseFloat(est.gszzl) || 0,
          })
        } catch {
          // 忽略单个基金获取失败
        }
      })
    )

    // 检查每个规则
    for (const rule of enabledRules) {
      const est = estimates.get(rule.fundCode)
      if (!est) continue

      let triggered = false

      if (rule.type === 'threshold' && rule.threshold != null && rule.direction) {
        if (rule.direction === 'above' && est.netValue >= rule.threshold) {
          triggered = true
        } else if (rule.direction === 'below' && est.netValue <= rule.threshold) {
          triggered = true
        }
      } else if (rule.type === 'change' && rule.changePercent != null) {
        if (Math.abs(est.changeRate) >= rule.changePercent) {
          triggered = true
        }
      }

      if (triggered) {
        // 避免重复提醒（同一交易日内只提醒一次）
        const today = new Date().toDateString()
        const lastTriggeredDate = rule.lastTriggered
          ? new Date(rule.lastTriggered).toDateString()
          : null
        if (lastTriggeredDate !== today) {
          showToast(`${rule.fundName} 触发提醒：${rule.type === 'threshold' ? `净值 ${est.netValue.toFixed(4)}` : `涨跌幅 ${est.changeRate.toFixed(2)}%`}`)
          alertsStore.markTriggered(rule.id)
        }
      }
    }
  }

  function start() {
    if (timer) return
    timer = setInterval(checkAlerts, CHECK_INTERVAL)
    // 立即检查一次
    checkAlerts()
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(() => {
    start()
  })

  onUnmounted(() => {
    stop()
  })

  return {
    start,
    stop,
  }
}
