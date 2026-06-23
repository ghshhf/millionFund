import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAlertsStore } from '@/stores/alerts'

describe('alerts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 清除 localStorage，避免旧数据干扰
    localStorage.removeItem('alert_rules')
  })

  it('添加提醒规则', () => {
    const store = useAlertsStore()
    expect(store.rules).toHaveLength(0)

    store.addRule({
      fundCode: '000001',
      fundName: '华夏上证50ETF',
      type: 'threshold',
      threshold: 1.2,
      direction: 'above',
      enabled: true,
    })

    expect(store.rules).toHaveLength(1)
    expect(store.rules[0].fundCode).toBe('000001')
    expect(store.rules[0].enabled).toBe(true)
  })

  it('删除提醒规则', () => {
    const store = useAlertsStore()
    store.addRule({
      fundCode: '000001',
      fundName: '华夏上证50ETF',
      type: 'threshold',
      threshold: 1.2,
      direction: 'above',
      enabled: true,
    })

    const id = store.rules[0].id
    store.removeRule(id)

    expect(store.rules).toHaveLength(0)
  })

  it('启用/禁用提醒规则', () => {
    const store = useAlertsStore()
    store.addRule({
      fundCode: '000001',
      fundName: '华夏上证50ETF',
      type: 'threshold',
      threshold: 1.2,
      direction: 'above',
      enabled: true,
    })

    const id = store.rules[0].id
    store.toggleRule(id)

    expect(store.rules[0].enabled).toBe(false)

    store.toggleRule(id)
    expect(store.rules[0].enabled).toBe(true)
  })

  it('更新提醒规则', () => {
    const store = useAlertsStore()
    store.addRule({
      fundCode: '000001',
      fundName: '华夏上证50ETF',
      type: 'threshold',
      threshold: 1.2,
      direction: 'above',
      enabled: true,
    })

    const id = store.rules[0].id
    store.updateRule(id, { threshold: 1.5 })

    expect(store.rules[0].threshold).toBe(1.5)
  })

  it('标记提醒已触发', () => {
    const store = useAlertsStore()
    store.addRule({
      fundCode: '000001',
      fundName: '华夏上证50ETF',
      type: 'threshold',
      threshold: 1.2,
      direction: 'above',
      enabled: true,
    })

    const id = store.rules[0].id
    store.markTriggered(id)

    expect(store.rules[0].lastTriggered).toBeDefined()
  })
})
