// [WHY] storage 工具单元测试：验证自选、持仓和版本迁移行为
// [WHAT] 使用 happy-dom 提供的 mock localStorage 进行黑盒测试
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getWatchlist,
  saveWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  getHoldings,
  saveHoldings,
  upsertHolding,
  removeHolding,
  getHolding,
  getFundNetValues,
  saveFundNetValues,
  updateFundNetValue,
  getFundNetValue,
  getSourceFilter,
  saveSourceFilter,
  getAITrackingRecords,
  saveAITrackingRecords,
  checkVersionAndClearCache,
  checkSchemaAndMigrate,
} from '@/utils/storage'

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('自选列表', () => {
  it('读取空数据时返回空数组', () => {
    expect(getWatchlist()).toEqual([])
  })

  it('可以保存并读取自选列表', () => {
    saveWatchlist(['000001', '000002'])
    expect(getWatchlist()).toEqual(['000001', '000002'])
  })

  it('addToWatchlist 添加新基金时排到前面', () => {
    saveWatchlist(['000001'])
    addToWatchlist('000002')
    expect(getWatchlist()).toEqual(['000002', '000001'])
  })

  it('addToWatchlist 不会重复添加', () => {
    saveWatchlist(['000001', '000002'])
    addToWatchlist('000001')
    expect(getWatchlist()).toEqual(['000001', '000002'])
  })

  it('removeFromWatchlist 正确删除', () => {
    saveWatchlist(['000001', '000002'])
    removeFromWatchlist('000001')
    expect(getWatchlist()).toEqual(['000002'])
  })

  it('removeFromWatchlist 删除不存在的基金时保持不变', () => {
    saveWatchlist(['000001'])
    removeFromWatchlist('000002')
    expect(getWatchlist()).toEqual(['000001'])
  })

  it('isInWatchlist 正确识别是否在自选中', () => {
    saveWatchlist(['000001'])
    expect(isInWatchlist('000001')).toBe(true)
    expect(isInWatchlist('999999')).toBe(false)
  })
})

describe('持仓数据', () => {
  const sample = {
    code: '000001',
    name: '测试基金',
    buyNetValue: 1.12,
    shares: 1000,
    buyDate: '2024-01-01',
    holdingDays: 10,
    source: '手动',
    isQDII: false,
    createdAt: 123456,
  }

  it('读取空数据时返回空数组', () => {
    expect(getHoldings()).toEqual([])
  })

  it('可以保存和读取持仓数据', () => {
    saveHoldings([sample])
    expect(getHoldings()).toEqual([sample])
  })

  it('upsertHolding 新增持仓', () => {
    upsertHolding(sample)
    expect(getHoldings()).toHaveLength(1)
    expect(getHoldings()[0]?.code).toBe('000001')
  })

  it('upsertHolding 更新已有持仓', () => {
    upsertHolding(sample)
    upsertHolding({ ...sample, shares: 2000 })
    expect(getHoldings()).toHaveLength(1)
    expect(getHoldings()[0]?.shares).toBe(2000)
  })

  it('removeHolding 删除指定代码', () => {
    saveHoldings([sample, { ...sample, code: '000002', name: '另一基金' }])
    removeHolding('000001')
    const holdings = getHoldings()
    expect(holdings).toHaveLength(1)
    expect(holdings[0]?.code).toBe('000002')
  })

  it('getHolding 可以获取单个持仓', () => {
    saveHoldings([sample])
    expect(getHolding('000001')?.name).toBe('测试基金')
    expect(getHolding('999999')).toBeUndefined()
  })

  it('损坏的 JSON 数据返回默认值', () => {
    window.localStorage.setItem('fund_holdings', '{invalid json')
    expect(getHoldings()).toEqual([])
  })
})

describe('净值存储', () => {
  it('可以保存和读取净值映射', () => {
    saveFundNetValues({ '000001': 1.2345 })
    expect(getFundNetValues()).toEqual({ '000001': 1.2345 })
  })

  it('updateFundNetValue 可以更新单个净值', () => {
    updateFundNetValue('000001', 1.2)
    updateFundNetValue('000002', 1.3)
    expect(getFundNetValue('000001')).toBe(1.2)
    expect(getFundNetValue('000002')).toBe(1.3)
  })

  it('getFundNetValue 读取不存在的代码返回 undefined', () => {
    expect(getFundNetValue('999999')).toBeUndefined()
  })
})

describe('来源筛选存储', () => {
  it('保存和读取来源筛选', () => {
    saveSourceFilter('ali')
    expect(getSourceFilter()).toBe('ali')
  })
})

describe('AI 调仓追踪存储', () => {
  it('保存和读取 AI 追踪记录', () => {
    const records = [
      { id: '1', sellCode: '000001', buyCode: '000002', date: '2024-01-01' }
    ]
    saveAITrackingRecords(records)
    expect(getAITrackingRecords()).toEqual(records)
  })

  it('读取空数据时返回空数组', () => {
    expect(getAITrackingRecords()).toEqual([])
  })
})

describe('版本与 schema 检查', () => {
  it('首次调用 checkVersionAndClearCache 会写入当前版本号', () => {
    checkVersionAndClearCache()
    expect(window.localStorage.getItem('app_version')).toBeTruthy()
  })

  it('首次调用 checkSchemaAndMigrate 会写入 schema meta', () => {
    checkSchemaAndMigrate()
    const meta = JSON.parse(window.localStorage.getItem('storage_schema_meta') || '{}')
    expect(meta.version).toBe(1)
    expect(meta.lastMigratedAt).toBeGreaterThan(0)
  })

  it('checkSchemaAndMigrate 对已存在的持仓数据填充默认字段', () => {
    window.localStorage.setItem('fund_holdings', JSON.stringify([
      { code: '000001', name: '老基金', buyNetValue: 1, shares: 100, buyDate: '2024-01-01', holdingDays: 1 }
    ]))
    checkSchemaAndMigrate()
    const holdings = getHoldings()
    expect(holdings).toHaveLength(1)
    expect(holdings[0]?.source).toBe('其他')
    expect(holdings[0]?.isQDII).toBe(false)
    expect(typeof holdings[0]?.createdAt).toBe('number')
  })

  it('checkSchemaAndMigrate 在 localStorage 抛出异常时不崩溃', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => checkSchemaAndMigrate()).not.toThrow()
    spy.mockRestore()
  })

  it('checkVersionAndClearCache 在 localStorage 抛出异常时不崩溃', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => checkVersionAndClearCache()).not.toThrow()
    spy.mockRestore()
  })
})
